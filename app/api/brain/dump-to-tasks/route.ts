import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { defaultTaskDates } from '@/app/lib/task-defaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/brain/dump-to-tasks
// Converts all wa_dump notes (not yet converted) into tasks assigned to self.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  // Find all dump notes that don't have a task yet
  const notes = await prisma.note.findMany({
    where: {
      userId,
      sourceType: 'wa_dump',
      tasks: { none: {} },
    },
    select: { id: true, title: true },
  });

  if (notes.length === 0) {
    return NextResponse.json({ created: 0, message: 'Semua dump note sudah menjadi task' });
  }

  const { startDate, dueDate } = defaultTaskDates();

  // No projectId — dump tasks are personal, not tied to any project (avoids group notifications)
  await prisma.task.createMany({
    data: notes.map((note) => ({
      userId,
      assignedToId: userId,
      sourceNoteId: note.id,
      title: note.title,
      status: 'todo',
      priority: 'none',
      source: 'wa_dump',
      startDate,
      dueDate,
    })),
  });

  return NextResponse.json({ created: notes.length });
}
