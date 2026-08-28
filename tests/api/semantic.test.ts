import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/search/semantic/route';
import { getSession } from '@/app/lib/session';

vi.mock('@/app/lib/embeddings', () => ({
  searchSemantic: vi.fn().mockResolvedValue([
    {
      id: 'note-1',
      type: 'note',
      title: 'Test note',
      snippet: 'Some content',
      similarity: 87,
      url: '/brain/notes/note-1',
      meta: '📥 Inbox',
      date: new Date('2026-06-10').toISOString(),
    },
  ]),
  embedNote: vi.fn().mockResolvedValue(undefined),
}));

const mockSession = () =>
  vi.mocked(getSession).mockResolvedValue({
    user: { id: 'user-1', name: 'Test', email: 'test@example.com' },
  } as any);

describe('GET /api/search/semantic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = 'test-key';
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      url: '/api/search/semantic?q=test',
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(401);
      },
    });
  });

  it('returns empty array for short query', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      url: '/api/search/semantic?q=a',
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual([]);
      },
    });
  });

  it('returns 503 when DEEPSEEK_API_KEY is missing', async () => {
    mockSession();
    delete process.env.DEEPSEEK_API_KEY;
    await testApiHandler({
      appHandler: handler,
      url: '/api/search/semantic?q=test query',
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(503);
      },
    });
  });

  it('returns semantic results for valid query', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      url: '/api/search/semantic?q=test query',
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data[0]).toMatchObject({ title: 'Test note', similarity: 87 });
      },
    });
  });
});
