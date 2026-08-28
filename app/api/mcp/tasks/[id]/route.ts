import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { validateMcpKey, requireScope } from '@/app/lib/mcp-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TASK_INCLUDE = {
  group: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  mention: { select: { id: true, text: true, senderName: true, timestamp: true } },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: TASK_INCLUDE,
  });

  if (!task || task.userId !== key.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(serializeTask(task));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireScope(key, 'write')) {
    return NextResponse.json({ error: 'Forbidden: write scope required' }, { status: 403 });
  }

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || task.userId !== key.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const { status, priority, assignedToId } = body as {
    status?: string;
    priority?: string;
    assignedToId?: string;
  };

  const validStatuses = ['todo', 'in_progress', 'done'];
  const validPriorities = ['urgent', 'high', 'medium', 'low', 'none'];

  const data: Record<string, unknown> = {};
  if (status && validStatuses.includes(status)) data.status = status;
  if (priority && validPriorities.includes(priority)) data.priority = priority;
  if (data.status === 'done' && !task.completedAt) data.completedAt = new Date();

  // assignedToId: "" = unassign, "<userId>" = assign
  if (assignedToId !== undefined) {
    if (assignedToId === '') {
      data.assignedTo = { disconnect: true };
    } else {
      // Validate assignee is in the same project
      const assigneeMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId ?? '', userId: assignedToId } },
      });
      if (!assigneeMember) {
        return NextResponse.json({ error: 'Assignee is not a member of this project' }, { status: 400 });
      }
      data.assignedTo = { connect: { id: assignedToId } };
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.task.update({
    where: { id: params.id },
    data,
    include: TASK_INCLUDE,
  });

  return NextResponse.json(serializeTask(updated));
}

function serializeTask(t: Record<string, unknown>) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    requester: t.requester,
    startDate: t.startDate ? (t.startDate as Date).toISOString() : null,
    dueDate: t.dueDate ? (t.dueDate as Date).toISOString() : null,
    completedAt: t.completedAt ? (t.completedAt as Date).toISOString() : null,
    createdAt: (t.createdAt as Date).toISOString(),
    group: t.group,
    project: t.project,
    assignedTo: t.assignedTo,
    mention: t.mention,
    imageUrls: (t.imageUrls as string[]) ?? [],
  };
}
