import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/clip/route';
import { prismaMock } from '../setup';

const mockUser = { id: 'user-1' };
const mockSpace = { id: 'space-1', userId: 'user-1', name: 'Inbox', isInbox: true, icon: '📥', isArchived: false, order: 0, description: null, createdAt: new Date(), updatedAt: new Date() };
const mockNote = { id: 'note-1', title: 'Test clip', content: '', sourceType: 'web_clip', sourceUrl: 'https://example.com', userId: 'user-1', spaceId: 'space-1', createdAt: new Date(), updatedAt: new Date() };

describe('POST /api/clip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without Authorization header', async () => {
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: JSON.stringify({ title: 'Test', url: 'https://example.com' }) });
        expect(res.status).toBe(401);
      },
    });
  });

  it('returns 401 with invalid token', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { Authorization: 'Bearer invalid-token', 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', url: 'https://example.com' }),
        });
        expect(res.status).toBe(401);
      },
    });
  });

  it('creates note in inbox with valid token', async () => {
    prismaMock.user.findFirst.mockResolvedValue(mockUser as any);
    prismaMock.space.findFirst.mockResolvedValue(mockSpace as any);
    prismaMock.note.create.mockResolvedValue(mockNote as any);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { Authorization: 'Bearer valid-token-64chars', 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test clip', url: 'https://example.com', selection: '', description: '' }),
        });
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.ok).toBe(true);
        expect(data.id).toBe('note-1');
      },
    });
  });

  it('saves selected text as blockquote in content', async () => {
    prismaMock.user.findFirst.mockResolvedValue(mockUser as any);
    prismaMock.space.findFirst.mockResolvedValue(mockSpace as any);
    prismaMock.note.create.mockResolvedValue(mockNote as any);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        await fetch({
          method: 'POST',
          headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', url: 'https://example.com', selection: 'Important quote' }),
        });

        expect(prismaMock.note.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              content: expect.stringContaining('> Important quote'),
            }),
          }),
        );
      },
    });
  });
});
