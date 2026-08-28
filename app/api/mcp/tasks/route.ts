import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { validateMcpKey } from '@/app/lib/mcp-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');
  const groupId = searchParams.get('groupId');
  const status = searchParams.get('status'); // comma-separated: "todo,in_progress"
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  // Match dashboard: show tasks where user is owner OR assignee
  const userFilter = { OR: [{ userId: key.userId }, { assignedToId: key.userId }] };
  const extraFilters: Record<string, unknown> = {};
  if (projectId) extraFilters.projectId = projectId;
  if (groupId) extraFilters.groupId = groupId;

  // Default: exclude done. Pass status=all or status=done,todo,in_progress to override.
  if (status === 'all') {
    // no filter
  } else if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    extraFilters.status = { in: statuses };
  } else {
    extraFilters.status = { in: ['todo', 'in_progress'] };
  }

  const where = { ...userFilter, ...extraFilters };

  const allTasks = await prisma.task.findMany({
    where,
    include: {
      group: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Sort: todo → in_progress → done, then by createdAt desc within each bucket
  const statusOrder: Record<string, number> = { todo: 0, in_progress: 1, done: 2 };
  const tasks = allTasks
    .sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))
    .slice(0, limit);

  return NextResponse.json(tasks.map(serializeTask));
}

function serializeTask(t: ReturnType<typeof Object.assign>) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    requester: t.requester,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    group: t.group,
    project: t.project,
    assignedTo: t.assignedTo,
    imageUrls: t.imageUrls ?? [],
  };
}
