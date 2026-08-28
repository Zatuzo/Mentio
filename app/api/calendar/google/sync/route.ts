import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { createCalendarEvent, isConnected } from '@/app/lib/google-calendar';
import { defaultTaskDates } from '@/app/lib/task-defaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/calendar/google/sync
// 1. Backfills default dates (today → +3 days) for tasks that have none.
// 2. Syncs all tasks with dates but no googleEventId to Google Calendar.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  if (!(await isConnected(userId))) {
    return NextResponse.json({ error: 'Google Calendar not connected or sync disabled' }, { status: 400 });
  }

  // Step 1: backfill tasks that have no dates at all
  const undated = await prisma.task.findMany({
    where: { userId, startDate: null, dueDate: null, status: { not: 'done' } },
    select: { id: true },
  });

  if (undated.length > 0) {
    const { startDate, dueDate } = defaultTaskDates();
    await prisma.task.updateMany({
      where: { id: { in: undated.map((t) => t.id) } },
      data: { startDate, dueDate },
    });
  }

  // Step 2: sync all tasks with dates but no googleEventId
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      googleEventId: null,
      OR: [{ dueDate: { not: null } }, { startDate: { not: null } }],
    },
    select: { id: true, title: true, description: true, startDate: true, dueDate: true },
  });

  let synced = 0;
  let failed = 0;

  for (const task of tasks) {
    const googleEventId = await createCalendarEvent(userId, {
      id: task.id,
      title: task.title,
      description: task.description,
      startDate: task.startDate?.toISOString() ?? null,
      dueDate: task.dueDate?.toISOString() ?? null,
    });

    if (googleEventId) {
      await prisma.task.update({ where: { id: task.id }, data: { googleEventId } });
      synced++;
    } else {
      failed++;
    }
  }

  return NextResponse.json({ synced, failed, backfilled: undated.length, total: tasks.length });
}
