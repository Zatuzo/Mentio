import { describe, it, expect, vi } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/tasks/ai-refine/route';
import { getSession } from '@/app/lib/session';
import { prismaMock } from '../setup';

// ── Stream mock ───────────────────────────────────────────────────────────────

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

const sampleTasks = [
  { title: 'Fix login crash', description: null, priority: 'urgent', suggestedAssigneeId: null, isDuplicate: false },
  { title: 'Add dark mode', description: null, priority: 'medium', suggestedAssigneeId: null, isDuplicate: false },
];

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

describe('POST /api/tasks/ai-refine', () => {
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

  it('returns 400 when tasks is missing', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ instruction: 'Make urgent', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('tasks is required');
      },
    });
  });

  it('returns 400 when tasks is empty array', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ tasks: [], instruction: 'Make urgent', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it('returns 400 when instruction is missing', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ tasks: sampleTasks, projectId: 'proj-1' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('instruction is required');
      },
    });
  });

  it('returns 400 when projectId is missing', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ tasks: sampleTasks, instruction: 'Make urgent' }),
        });
        expect(res.status).toBe(400);
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
          body: JSON.stringify({ tasks: sampleTasks, instruction: 'Make all urgent', projectId: 'proj-1' }),
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
          body: JSON.stringify({ tasks: sampleTasks, instruction: 'Make urgent', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(503);
      },
    });
    process.env.DEEPSEEK_API_KEY = original ?? 'test-key';
  });

  it('streams refined task list as NDJSON', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
    prismaMock.projectMember.findMany.mockResolvedValue([
      { user: { id: 'user-1', name: 'Test User' } },
    ] as any);
    mockChatCreate.mockResolvedValue(makeNdjsonStream([
      '{"type":"task","data":{"title":"Fix login crash","priority":"urgent","description":null,"suggestedAssigneeId":"user-1","isDuplicate":false,"confidence":"high"}}',
      '{"type":"task","data":{"title":"Add dark mode","priority":"urgent","description":null,"suggestedAssigneeId":"user-1","isDuplicate":false,"confidence":"high"}}',
    ]));

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({
            tasks: sampleTasks,
            instruction: 'Make all urgent and assign to Test User',
            projectId: 'proj-1',
          }),
        });
        expect(res.status).toBe(200);
        const raw = await readStream(res);
        const lines = raw.trim().split('\n').map((l) => JSON.parse(l));
        expect(lines).toHaveLength(2);
        expect(lines[0].data.priority).toBe('urgent');
        expect(lines[0].data.suggestedAssigneeId).toBe('user-1');
        expect(lines[1].data.priority).toBe('urgent');
      },
    });
  });

  it('includes current tasks and instruction in prompt sent to DeepSeek', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
    prismaMock.projectMember.findMany.mockResolvedValue([
      { user: { id: 'user-1', name: 'Test User' } },
    ] as any);
    mockChatCreate.mockResolvedValue(makeNdjsonStream([]));

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        await fetch({
          method: 'POST',
          body: JSON.stringify({
            tasks: sampleTasks,
            instruction: 'Split the login task',
            projectId: 'proj-1',
          }),
        });
        const callArg = mockChatCreate.mock.calls[0][0];
        const systemContent = callArg.messages[0].content as string;
        expect(systemContent).toContain('Fix login crash');
        expect(systemContent).toContain('Add dark mode');
        expect(systemContent).toContain('Split the login task');
        expect(systemContent).toContain('Test User');
        expect(callArg.stream).toBe(true);
      },
    });
  });
});
