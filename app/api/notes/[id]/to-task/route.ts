import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { defaultTaskDates } from '@/app/lib/task-defaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.note.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, title: true, content: true },
  });
  if (!note || note.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { title, projectId, priority } = await req.json() as {
    title?: string;
    projectId?: string;
    priority?: string;
  };

  const taskTitle = (title ?? note.title).trim();
  if (!taskTitle) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  // Validate project membership if provided
  let resolvedProjectId: string | null = null;
  if (projectId) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    });
    if (!member) return NextResponse.json({ error: 'Not a member of that project' }, { status: 403 });
    resolvedProjectId = projectId;
  } else {
    // Fall back to first project
    const first = await prisma.projectMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { project: { createdAt: 'asc' } },
      select: { projectId: true },
    });
    resolvedProjectId = first?.projectId ?? null;
  }

  const defaultStatus = resolvedProjectId
    ? ((await prisma.projectStatus.findFirst({
        where: { projectId: resolvedProjectId },
        orderBy: { order: 'asc' },
      }))?.slug ?? 'todo')
    : 'todo';

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      assignedToId: session.user.id,
      projectId: resolvedProjectId,
      sourceNoteId: note.id,
      title: taskTitle,
      description: note.content?.slice(0, 2000) || null,
      priority: (['urgent', 'high', 'medium', 'low', 'none'].includes(priority ?? '')
        ? priority!
        : 'none'),
      status: defaultStatus,
      ...defaultTaskDates(),
    },
  });

  return NextResponse.json({ task });
}
