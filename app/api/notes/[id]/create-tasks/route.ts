import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { defaultTaskDates } from '@/app/lib/task-defaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note || note.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const tasks: Array<{ title: string; priority: string }> = body.tasks ?? [];
  if (!tasks.length) return NextResponse.json({ created: 0 });

  // Find user's first available project
  const membership = await prisma.projectMember.findFirst({
    where: { userId: session.user.id },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { project: { createdAt: 'asc' } },
  });

  if (!membership) return NextResponse.json({ error: 'No project found' }, { status: 400 });

  const projectId = membership.project.id;
  const statuses = await prisma.projectStatus.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    take: 1,
  });
  const defaultStatus = statuses[0]?.slug ?? 'todo';

  const created = await Promise.all(
    tasks.map((t) =>
      prisma.task.create({
        data: {
          userId: session.user.id,
          assignedToId: session.user.id,
          projectId,
          title: t.title.trim(),
          priority: (['urgent', 'high', 'medium', 'low', 'none'].includes(t.priority)
            ? t.priority
            : 'none') as string,
          status: defaultStatus,
          description: `Extracted from note: "${note.title}"`,
          ...defaultTaskDates(),
        },
      }),
    ),
  );

  return NextResponse.json({
    created: created.length,
    projectName: membership.project.name,
    taskIds: created.map((t) => t.id),
  });
}
