import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/tasks/route';
import { getSession } from '@/app/lib/session';
import { prismaMock } from '../setup';

const mockSession = (overrides = {}) =>
  vi.mocked(getSession).mockResolvedValue({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    ...overrides,
  } as any);

const makeTask = (overrides = {}) => ({
  id: 'task-1',
  title: 'Fix bug',
  description: null,
  status: 'todo',
  userId: 'user-1',
  groupId: null,
  projectId: 'proj-1',
  requester: null,
  requesterJid: null,
  summaryId: null,
  dueDate: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  group: null,
  ...overrides,
});

describe('POST /api/tasks', () => {
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

  it('returns 400 when title is missing', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ projectId: 'proj-1' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Title required');
      },
    });
  });

  it('returns 400 when title is blank whitespace', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ title: '   ', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(400);
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
          body: JSON.stringify({ title: 'Fix bug' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('projectId required');
      },
    });
  });

  it('returns 403 when user is not a project member', async () => {
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue(null);
    prismaMock.projectStatus.findMany.mockResolvedValue([]);
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(403);
      },
    });
  });

  it('creates task and returns 200 with correct shape', async () => {
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
      { id: 'ps-2', slug: 'in_progress', name: 'In Progress', projectId: 'proj-1', order: 1, isDone: false, color: null },
      { id: 'ps-3', slug: 'done', name: 'Done', projectId: 'proj-1', order: 2, isDone: true, color: null },
    ] as any);
    prismaMock.task.create.mockResolvedValue(makeTask() as any);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe('task-1');
        expect(body.title).toBe('Fix bug');
        expect(body.status).toBe('todo');
        expect(typeof body.createdAt).toBe('string'); // serialized to ISO string
      },
    });
  });

  it('creates task with groupId when group is in project', async () => {
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
    ] as any);
    prismaMock.projectGroup.findUnique.mockResolvedValue({ projectId: 'proj-1', groupId: 'grp-1' } as any);
    prismaMock.task.create.mockResolvedValue(
      makeTask({ groupId: 'grp-1', group: { id: 'grp-1', name: 'Dev Team' } }) as any
    );

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1', groupId: 'grp-1' }),
        });
        expect(res.status).toBe(200);
        const callArg = prismaMock.task.create.mock.calls[0][0];
        expect(callArg.data.group).toEqual({ connect: { id: 'grp-1' } });
      },
    });
  });

  it('returns 400 when groupId is not in project', async () => {
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
    ] as any);
    prismaMock.projectGroup.findUnique.mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1', groupId: 'grp-other' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Group not in project');
      },
    });
  });

  it('defaults status to todo when invalid status is provided', async () => {
    mockSession();
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
    ] as any);
    prismaMock.task.create.mockResolvedValue(makeTask() as any);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        await fetch({
          method: 'POST',
          body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1', status: 'invalid' }),
        });
        const callArg = prismaMock.task.create.mock.calls[0][0];
        expect(callArg.data.status).toBe('todo');
      },
    });
  });

  it('returns 400 when assignedToId is not a project member', async () => {
    mockSession();
    prismaMock.projectMember.findUnique
      .mockResolvedValueOnce({ id: 'm1' } as any) // caller is a member
      .mockResolvedValueOnce(null);               // assignee is NOT a member
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
    ] as any);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1', assignedToId: 'outsider' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Assignee not in project');
      },
    });
  });

  it('creates task with assignedToId when assignee is a project member', async () => {
    mockSession();
    prismaMock.projectMember.findUnique
      .mockResolvedValueOnce({ id: 'm1' } as any) // caller is member
      .mockResolvedValueOnce({ id: 'm2' } as any); // assignee is member
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
    ] as any);
    prismaMock.task.create.mockResolvedValue(
      makeTask({ assignedToId: 'user-2', assignedTo: { id: 'user-2', name: 'Member 2', image: null } }) as any
    );

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1', assignedToId: 'user-2' }),
        });
        expect(res.status).toBe(200);
        const callArg = prismaMock.task.create.mock.calls[0][0];
        expect(callArg.data.assignedTo).toEqual({ connect: { id: 'user-2' } });
      },
    });
  });

  it('accepts valid status values', async () => {
    for (const status of ['todo', 'in_progress', 'done']) {
      mockSession();
      prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'm1' } as any);
      prismaMock.projectStatus.findMany.mockResolvedValue([
        { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
        { id: 'ps-2', slug: 'in_progress', name: 'In Progress', projectId: 'proj-1', order: 1, isDone: false, color: null },
        { id: 'ps-3', slug: 'done', name: 'Done', projectId: 'proj-1', order: 2, isDone: true, color: null },
      ] as any);
      prismaMock.task.create.mockResolvedValue(makeTask({ status }) as any);

      await testApiHandler({
        appHandler: handler,
        test: async ({ fetch }) => {
          const res = await fetch({
            method: 'POST',
            body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1', status }),
          });
          expect(res.status).toBe(200);
        },
      });
    }
  });
});
