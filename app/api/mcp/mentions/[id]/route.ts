import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { validateMcpKey, requireScope } from '@/app/lib/mcp-auth';
import { defaultTaskDates } from '@/app/lib/task-defaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mention = await prisma.mention.findUnique({
    where: { id: params.id },
    include: {
      group: { select: { id: true, name: true } },
      tasks: { select: { id: true, title: true, status: true } },
    },
  });

  if (!mention || mention.userId !== key.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Surrounding messages (±10) from same group, same time window
  const surrounding = await prisma.mention.findMany({
    where: {
      groupId: mention.groupId,
      userId: key.userId,
      timestamp: {
        gte: new Date(mention.timestamp.getTime() - 30 * 60 * 1000),
        lte: new Date(mention.timestamp.getTime() + 30 * 60 * 1000),
      },
      NOT: { id: mention.id },
    },
    orderBy: { timestamp: 'asc' },
    take: 20,
    select: { id: true, senderName: true, text: true, timestamp: true },
  });

  return NextResponse.json({
    id: mention.id,
    text: mention.text,
    senderName: mention.senderName,
    senderJid: mention.senderJid,
    timestamp: mention.timestamp.toISOString(),
    processed: mention.processed,
    group: mention.group,
    tasks: mention.tasks,
    surrounding: surrounding.map((m) => ({
      id: m.id,
      senderName: m.senderName,
      text: m.text,
      timestamp: m.timestamp.toISOString(),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireScope(key, 'write')) return NextResponse.json({ error: 'Forbidden: write scope required' }, { status: 403 });

  const mention = await prisma.mention.findUnique({ where: { id: params.id } });
  if (!mention || mention.userId !== key.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const { createTask, title, description, assignedToId } = body as {
    createTask?: boolean;
    title?: string;
    description?: string;
    assignedToId?: string;
  };

  if (createTask) {
    if (!title?.trim()) return NextResponse.json({ error: 'title required for createTask' }, { status: 400 });

    // Find a project this group belongs to (or first project of user)
    const projectGroup = await prisma.projectGroup.findFirst({
      where: { groupId: mention.groupId },
      include: { project: { select: { id: true } } },
    });
    const projectId = projectGroup?.project.id;
    if (!projectId) return NextResponse.json({ error: 'No project linked to this group' }, { status: 400 });

    // Validate assignee is a member of this project
    if (assignedToId) {
      const assigneeMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: assignedToId } },
      });
      if (!assigneeMember) {
        return NextResponse.json({ error: 'Assignee is not a member of this project' }, { status: 400 });
      }
    }

    const task = await prisma.task.create({
      data: {
        userId: key.userId,
        projectId,
        groupId: mention.groupId,
        mentionId: mention.id,
        title: title.trim(),
        description: description?.trim() ?? null,
        status: 'todo',
        ...(assignedToId ? { assignedToId } : {}),
        ...defaultTaskDates(),
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    return NextResponse.json(task, { status: 201 });
  }

  return NextResponse.json({ error: 'No action specified' }, { status: 400 });
}
