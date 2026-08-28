import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { createCalendarEvent, isConnected } from '@/app/lib/google-calendar';
import { defaultTaskDates } from '@/app/lib/task-defaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, description, status, priority, startDate, dueDate, projectId, groupId, mentionId, assignedToId, imageUrls } = body as {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    startDate?: string | null;
    dueDate?: string | null;
    projectId?: string;
    groupId?: string | null;
    mentionId?: string | null;
    assignedToId?: string | null;
    imageUrls?: string[];
  };

  const validPriorities = ['urgent', 'high', 'medium', 'low', 'none'];
  const taskPriority = priority && validPriorities.includes(priority) ? priority : 'none';

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  // Verify user is a member of this project
  const [member, projectStatuses] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    }),
    prisma.projectStatus.findMany({ where: { projectId }, orderBy: { order: 'asc' } }),
  ]);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const validSlugs = projectStatuses.map((s) => s.slug);
  const defaultSlug = validSlugs[0] ?? 'todo';
  const taskStatus = status && validSlugs.includes(status) ? status : defaultSlug;

  // If groupId provided, verify it belongs to this project
  if (groupId) {
    const link = await prisma.projectGroup.findUnique({
      where: { projectId_groupId: { projectId, groupId } },
    });
    if (!link) return NextResponse.json({ error: 'Group not in project' }, { status: 400 });
  }

  // If assignedToId provided, verify they are a project member
  if (assignedToId) {
    const assigneeMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: assignedToId } },
    });
    if (!assigneeMember) return NextResponse.json({ error: 'Assignee not in project' }, { status: 400 });
  }

  // If creating from a mention and no imageUrls passed, pull from mention (handles stale client state)
  let resolvedImageUrls = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === 'string') : [];
  if (mentionId && resolvedImageUrls.length === 0) {
    const mention = await prisma.mention.findUnique({ where: { id: mentionId }, select: { imageUrls: true } });
    if (mention?.imageUrls?.length) resolvedImageUrls = mention.imageUrls;
  }

  const task = await prisma.task.create({
    data: {
      user: { connect: { id: session.user.id } },
      project: { connect: { id: projectId } },
      ...(groupId ? { group: { connect: { id: groupId } } } : {}),
      title: title.trim(),
      description: description?.trim() || null,
      status: taskStatus,
      priority: taskPriority,
      imageUrls: resolvedImageUrls,
      ...defaultTaskDates(startDate, dueDate),
      ...(mentionId ? { mention: { connect: { id: mentionId } } } : {}),
      ...(assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : {}),
    },
    include: {
      group: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, image: true } },
    },
  });

  // Sync to Google Calendar if user has it connected and task has a date
  if ((task.startDate || task.dueDate) && await isConnected(session.user.id)) {
    const googleEventId = await createCalendarEvent(session.user.id, {
      id:          task.id,
      title:       task.title,
      description: task.description,
      startDate:   task.startDate?.toISOString() ?? null,
      dueDate:     task.dueDate?.toISOString()   ?? null,
    });
    if (googleEventId) {
      await prisma.task.update({ where: { id: task.id }, data: { googleEventId } });
    }
  }

  return NextResponse.json({
    ...task,
    createdAt:  task.createdAt.toISOString(),
    startDate:  task.startDate ? task.startDate.toISOString() : null,
    dueDate:    task.dueDate   ? task.dueDate.toISOString()   : null,
  });
}
