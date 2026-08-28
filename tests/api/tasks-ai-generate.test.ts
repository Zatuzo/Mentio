import { describe, it, expect, vi } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/tasks/ai-generate/route';
import { getSession } from '@/app/lib/session';
import { prismaMock } from '../setup';

// ── Streaming mock helpers ────────────────────────────────────────────────────

function makeNdjsonStream(lines: string[]) {
  async function* gen() {
    for (const line of lines) {
      yield { choices: [{ delta: { content: line + '\n' } }] };
    }
  }
  return { [Symbol.asyncIterator]: gen };
}

const mockChatCreate = vi.fn();

vi.mock('openai', () => {
  function MockOpenAI() {
    return { chat: { completions: { create: mockChatCreate } } };
  }
  return { default: MockOpenAI };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockSession = (overrides = {}) =>
  vi.mocked(getSession).mockResolvedValue({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    ...overrides,
  } as any);

const mockProjectContext = () => {
  prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
  prismaMock.project.findUnique.mockResolvedValue({
    name: 'Test Project', techStack: 'Next.js', prd: null,
  } as any);
  prismaMock.projectMember.findMany.mockResolvedValue([
    { user: { id: 'user-1', name: 'Test User' } },
  ] as any);
  prismaMock.task.findMany.mockResolvedValue([
    { title: 'Fix login bug', status: 'done' },
  ] as any);
};

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/tasks/ai-generate', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: JSON.stringify({}) });
        expect(res.status).toBe(401);
      },
    });
  });

  it('returns 400 when text is missing', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: JSON.stringify({ projectId: 'proj-1' }) });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('text is required');
      },
    });
  });

  it('returns 400 when text is blank whitespace', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: JSON.stringify({ text: '   ', projectId: 'proj-1' }) });
        expect(res.status).toBe(400);
      },
    });
  });

  it('returns 400 when projectId is missing', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: JSON.stringify({ text: 'Fix login bug' }) });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('projectId is required');
      },
    });
  });

  it('returns 403 when user is not a project member', async () => {
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ text: 'Fix login bug', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(403);
      },
    });
  });

  it('returns 503 when DEEPSEEK_API_KEY is not set', async () => {
    const original = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ text: 'Fix login bug', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(503);
      },
    });
    process.env.DEEPSEEK_API_KEY = original ?? 'test-key';
  });

  it('streams NDJSON with meta + task lines', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockSession();
    mockProjectContext();
    mockChatCreate.mockResolvedValue(makeNdjsonStream([
      '{"type":"meta","inputType":"bug_report"}',
      '{"type":"task","data":{"title":"Fix login crash","priority":"urgent","description":"Crashes on iOS.","suggestedAssigneeId":null,"isDuplicate":false,"confidence":"high"}}',
      '{"type":"task","data":{"title":"Add dark mode","priority":"medium","description":null,"suggestedAssigneeId":null,"isDuplicate":false,"confidence":"high"}}',
    ]));

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ text: 'Login crashes, need dark mode', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(200);
        const raw = await readStream(res);
        const lines = raw.trim().split('\n').map((l) => JSON.parse(l));

        expect(lines[0]).toEqual({ type: 'meta', inputType: 'bug_report' });
        expect(lines[1].type).toBe('task');
        expect(lines[1].data.title).toBe('Fix login crash');
        expect(lines[1].data.priority).toBe('urgent');
        expect(lines[2].type).toBe('task');
        expect(lines[2].data.title).toBe('Add dark mode');
      },
    });
  });

  it('marks duplicate tasks from existing project tasks', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockSession();
    mockProjectContext();
    mockChatCreate.mockResolvedValue(makeNdjsonStream([
      '{"type":"meta","inputType":"general"}',
      '{"type":"task","data":{"title":"Fix login bug","priority":"high","description":null,"suggestedAssigneeId":null,"isDuplicate":true,"confidence":"low"}}',
    ]));

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ text: 'Fix the login bug', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(200);
        const raw = await readStream(res);
        const lines = raw.trim().split('\n').map((l) => JSON.parse(l));
        const taskLine = lines.find((l) => l.type === 'task');
        expect(taskLine?.data.isDuplicate).toBe(true);
      },
    });
  });

  it('includes project context in the prompt sent to DeepSeek', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockSession();
    mockProjectContext();
    mockChatCreate.mockResolvedValue(makeNdjsonStream([
      '{"type":"meta","inputType":"general"}',
    ]));

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        await fetch({
          method: 'POST',
          body: JSON.stringify({ text: 'Some work', projectId: 'proj-1' }),
        });
        const callArg = mockChatCreate.mock.calls[0][0];
        const systemContent = callArg.messages[0].content as string;
        expect(systemContent).toContain('Test Project');
        expect(systemContent).toContain('Next.js');
        expect(systemContent).toContain('Fix login bug'); // existing task
        expect(callArg.stream).toBe(true);
      },
    });
  });
});
