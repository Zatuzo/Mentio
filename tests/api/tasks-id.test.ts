import { describe, it, expect, vi } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/tasks/[id]/route';
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
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  group: null,
  ...overrides,
});

// ── PATCH ──────────────────────────────────────────────────────────────────────

describe('PATCH /api/tasks/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
        expect(res.status).toBe(401);
      },
    });
  });

  it('returns 400 for invalid status value', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(makeTask({ userId: 'user-1' }) as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
      { id: 'ps-2', slug: 'in_progress', name: 'In Progress', projectId: 'proj-1', order: 1, isDone: false, color: null },
      { id: 'ps-3', slug: 'done', name: 'Done', projectId: 'proj-1', order: 2, isDone: true, color: null },
    ] as any);
    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ status: 'invalid' }) });
        expect(res.status).toBe(400);
      },
    });
  });

  it('returns 400 when title is empty string', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ title: '' }) });
        expect(res.status).toBe(400);
      },
    });
  });

  it('returns 404 when task does not exist', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-ghost' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
        expect(res.status).toBe(404);
      },
    });
  });

  it('returns 403 when user is not owner or project member', async () => {
    mockSession({ user: { id: 'other-user', name: 'Other' } });
    prismaMock.task.findUnique.mockResolvedValue(makeTask({ userId: 'user-1' }) as any);
    prismaMock.projectMember.findUnique.mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
        expect(res.status).toBe(403);
      },
    });
  });

  it('allows project member (not owner) to update task', async () => {
    mockSession({ user: { id: 'member-2', name: 'Member' } });
    prismaMock.task.findUnique.mockResolvedValue(makeTask({ userId: 'user-1' }) as any);
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'pm-1' } as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
      { id: 'ps-2', slug: 'in_progress', name: 'In Progress', projectId: 'proj-1', order: 1, isDone: false, color: null },
      { id: 'ps-3', slug: 'done', name: 'Done', projectId: 'proj-1', order: 2, isDone: true, color: null },
    ] as any);
    prismaMock.task.update.mockResolvedValue(makeTask({ status: 'in_progress' }) as any);

    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) });
        expect(res.status).toBe(200);
      },
    });
  });

  it('queues WA notification when task is marked done and has groupId', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(
      makeTask({ userId: 'user-1', groupId: 'group-1', status: 'todo' }) as any
    );
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
      { id: 'ps-2', slug: 'in_progress', name: 'In Progress', projectId: 'proj-1', order: 1, isDone: false, color: null },
      { id: 'ps-3', slug: 'done', name: 'Done', projectId: 'proj-1', order: 2, isDone: true, color: null },
    ] as any);
    prismaMock.task.update.mockResolvedValue(makeTask({ status: 'done', groupId: 'group-1' }) as any);
    prismaMock.project.findUnique.mockResolvedValue({ taskDoneMessage: null } as any);
    prismaMock.messageQueue.create.mockResolvedValue({ id: 'mq-1' } as any);

    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
        expect(res.status).toBe(200);
        expect(prismaMock.messageQueue.create).toHaveBeenCalledOnce();
      },
    });
  });

  it('does NOT queue WA notification when task has no groupId and no project group', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(
      makeTask({ userId: 'user-1', groupId: null, projectId: 'proj-1', status: 'todo' }) as any
    );
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
      { id: 'ps-2', slug: 'in_progress', name: 'In Progress', projectId: 'proj-1', order: 1, isDone: false, color: null },
      { id: 'ps-3', slug: 'done', name: 'Done', projectId: 'proj-1', order: 2, isDone: true, color: null },
    ] as any);
    prismaMock.task.update.mockResolvedValue(makeTask({ status: 'done' }) as any);
    prismaMock.projectGroup.findFirst.mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        await fetch({ method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
        expect(prismaMock.messageQueue.create).not.toHaveBeenCalled();
      },
    });
  });

  it('returns 400 when assignedToId is not a project member', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(makeTask({ userId: 'user-1' }) as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([]);
    prismaMock.projectMember.findUnique.mockResolvedValue(null); // assignee check fails

    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ assignedToId: 'outsider' }) });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Assignee not in project');
      },
    });
  });

  it('updates assignedToId when assignee is a project member', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(makeTask({ userId: 'user-1' }) as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([]);
    prismaMock.projectMember.findUnique.mockResolvedValue({ id: 'pm-2' } as any);
    prismaMock.task.update.mockResolvedValue(
      makeTask({ assignedToId: 'user-2', assignedTo: { id: 'user-2', name: 'Bob', image: null } }) as any
    );

    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ assignedToId: 'user-2' }) });
        expect(res.status).toBe(200);
        const callArg = prismaMock.task.update.mock.calls[0][0];
        expect(callArg.data.assignedToId).toBe('user-2');
      },
    });
  });

  it('clears assignee when assignedToId is null', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(makeTask({ userId: 'user-1', assignedToId: 'user-2' }) as any);
    prismaMock.projectStatus.findMany.mockResolvedValue([]);
    prismaMock.task.update.mockResolvedValue(makeTask({ assignedToId: null }) as any);

    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'PATCH', body: JSON.stringify({ assignedToId: null }) });
        expect(res.status).toBe(200);
        const callArg = prismaMock.task.update.mock.calls[0][0];
        expect(callArg.data.assignedToId).toBeNull();
      },
    });
  });

  it('falls back to project group for WA notification when task has no groupId', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(
      makeTask({ userId: 'user-1', groupId: null, projectId: 'proj-1', status: 'todo' }) as any
    );
    prismaMock.projectStatus.findMany.mockResolvedValue([
      { id: 'ps-1', slug: 'todo', name: 'To Do', projectId: 'proj-1', order: 0, isDone: false, color: null },
      { id: 'ps-2', slug: 'in_progress', name: 'In Progress', projectId: 'proj-1', order: 1, isDone: false, color: null },
      { id: 'ps-3', slug: 'done', name: 'Done', projectId: 'proj-1', order: 2, isDone: true, color: null },
    ] as any);
    prismaMock.task.update.mockResolvedValue(makeTask({ status: 'done' }) as any);
    prismaMock.projectGroup.findFirst.mockResolvedValue({ groupId: 'group-fallback' } as any);
    prismaMock.project.findUnique.mockResolvedValue({ taskDoneMessage: null } as any);
    prismaMock.messageQueue.create.mockResolvedValue({ id: 'mq-1' } as any);

    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        await fetch({ method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
        expect(prismaMock.messageQueue.create).toHaveBeenCalledOnce();
        const callArg = prismaMock.messageQueue.create.mock.calls[0][0];
        expect(callArg.data.groupId).toBe('group-fallback');
      },
    });
  });
});

// ── DELETE ─────────────────────────────────────────────────────────────────────

describe('DELETE /api/tasks/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(401);
      },
    });
  });

  it('returns 404 when task does not exist', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      params: { id: 'ghost' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(404);
      },
    });
  });

  it('returns 403 when user is not owner or project member', async () => {
    mockSession({ user: { id: 'other-user', name: 'Other' } });
    prismaMock.task.findUnique.mockResolvedValue(makeTask({ userId: 'user-1' }) as any);
    prismaMock.projectMember.findUnique.mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(403);
      },
    });
  });

  it('deletes task and returns ok', async () => {
    mockSession();
    prismaMock.task.findUnique.mockResolvedValue(makeTask() as any);
    prismaMock.task.delete.mockResolvedValue(makeTask() as any);

    await testApiHandler({
      appHandler: handler,
      params: { id: 'task-1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
      },
    });
  });
});
