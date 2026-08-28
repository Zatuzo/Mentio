import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskIds, assignedToId, groupId, startDate, dueDate } = await req.json() as {
    taskIds: string[];
    assignedToId?: string | null;
    groupId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
  };

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: 'taskIds required' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (assignedToId !== undefined) data.assignedToId = assignedToId;
  if (groupId !== undefined) data.groupId = groupId;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  // Only update tasks owned by the session user
  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds }, userId: session.user.id },
    data,
  });

  return NextResponse.json({ updated: result.count });
}
