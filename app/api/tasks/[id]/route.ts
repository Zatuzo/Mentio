import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { DEFAULT_TASK_DONE_MESSAGE, renderTemplate } from '@/app/lib/messages';
import { updateCalendarEvent, deleteCalendarEvent, isConnected } from '@/app/lib/google-calendar';
import { notifyTaskAssigned } from '@/app/lib/telegram-notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { task, ok } = await authorizeTask(params.id, session.user.id);
  if (!ok || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    agentStatus: task.agentStatus,
    agentResult: task.agentResult,
    agentPrUrl: task.agentPrUrl,
    agentBranch: task.agentBranch,
    agentError: task.agentError,
    agentLog: task.agentLog ?? null,
    agentFinishedAt: task.agentFinishedAt,
  });
}

// A task may be acted on by its owner, or by any member of its project —
// the board is project-scoped, so mutations must be too.
async function authorizeTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { group: true },
  });
  if (!task) return { task: null, ok: false };
  if (task.userId === userId) return { task, ok: true };
  if (task.projectId) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId } },
    });
    if (member) return { task, ok: true };
  }
  return { task, ok: false };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status, title, description, startDate, dueDate, priority, groupId, assignedToId, imageUrls } = body as {
      status?: string;
      title?: string;
      description?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      priority?: string;
      groupId?: string | null;
      assignedToId?: string | null;
      imageUrls?: string[];
    };

    const validPriorities = ['urgent', 'high', 'medium', 'low', 'none'];
    if (priority !== undefined && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const { task, ok } = await authorizeTask(params.id, session.user.id);
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Validate status against project's custom statuses
    const projectStatuses = task.projectId
      ? await prisma.projectStatus.findMany({ where: { projectId: task.projectId } })
      : [];
    const validSlugs = projectStatuses.length > 0
      ? projectStatuses.map((s) => s.slug)
      : ['todo', 'in_progress', 'done'];
    if (status !== undefined && !validSlugs.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    const isNewDone = status !== undefined
      ? (projectStatuses.find((s) => s.slug === status)?.isDone ?? status === 'done')
      : false;
    const isOldDone = projectStatuses.find((s) => s.slug === task.status)?.isDone ?? task.status === 'done';
    if (status !== undefined && isNewDone && !isOldDone) data.completedAt = new Date();
    if (status !== undefined && !isNewDone && isOldDone) data.completedAt = null;

    if (imageUrls !== undefined) {
      data.imageUrls = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === 'string') : [];
    }

    if (groupId !== undefined) {
      if (groupId !== null && task.projectId) {
        const link = await prisma.projectGroup.findUnique({
          where: { projectId_groupId: { projectId: task.projectId, groupId } },
        });
        if (!link) return NextResponse.json({ error: 'Group not in project' }, { status: 400 });
      }
      data.groupId = groupId;
    }

    const prevAssignedToId = task.assignedToId;
    if (assignedToId !== undefined) {
      if (assignedToId !== null && task.projectId) {
        const assigneeMember = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: task.projectId, userId: assignedToId } },
        });
        if (!assigneeMember) return NextResponse.json({ error: 'Assignee not in project' }, { status: 400 });
      }
      data.assignedToId = assignedToId;
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data,
      include: { assignedTo: { select: { id: true, name: true, image: true } } },
    });

    // Notify new assignee via Telegram if assignment changed
    if (assignedToId && assignedToId !== prevAssignedToId) {
      notifyTaskAssigned(params.id, assignedToId, session.user.name ?? 'Someone').catch(() => {});
    }

    // Queue WA notification when task transitions to a "done" status.
    if (status !== undefined && isNewDone && !isOldDone) {
      let notifyGroupId = task.groupId;

      if (!notifyGroupId && task.projectId) {
        const projectGroup = await prisma.projectGroup.findFirst({
          where: { projectId: task.projectId },
        });
        notifyGroupId = projectGroup?.groupId ?? null;
      }

      if (notifyGroupId) {
        const project = task.projectId
          ? await prisma.project.findUnique({
              where: { id: task.projectId },
              select: { taskDoneMessage: true },
            })
          : null;
        const template = project?.taskDoneMessage?.trim() || DEFAULT_TASK_DONE_MESSAGE;
        const message = renderTemplate(template, {
          taskTitle: task.title,
          requester: task.requester ?? '',
          requesterSuffix: task.requester ? ` (diminta oleh ${task.requester})` : '',
          userName: session.user.name ?? '',
        });

        await prisma.messageQueue.create({
          data: {
            userId: task.userId ?? session.user.id,
            groupId: notifyGroupId,
            taskId: task.id,
            message,
          },
        });
        console.log('[api] queued WA notification for task', task.id, 'to group', notifyGroupId);
      }
    }

    // Sync to Google Calendar
    if (await isConnected(session.user.id)) {
      const latestTask = await prisma.task.findUnique({ where: { id: params.id } });
      if (latestTask?.googleEventId) {
        await updateCalendarEvent(session.user.id, latestTask.googleEventId, {
          title:       latestTask.title,
          description: latestTask.description,
          startDate:   latestTask.startDate?.toISOString() ?? null,
          dueDate:     latestTask.dueDate?.toISOString()   ?? null,
        });
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api] PATCH /api/tasks/[id] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task, ok } = await authorizeTask(params.id, session.user.id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Delete from Google Calendar before removing from DB
  if (task.googleEventId && await isConnected(session.user.id)) {
    await deleteCalendarEvent(session.user.id, task.googleEventId);
  }

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
