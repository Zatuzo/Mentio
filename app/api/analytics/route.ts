import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function startOf(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const range   = searchParams.get('range') === '30' ? 30 : 7;
    const projectId = searchParams.get('projectId');
    const scope   = searchParams.get('scope') === 'team' ? 'team' : 'personal';
    const groupId = searchParams.get('groupId') || null;

    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
    });
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const since = startOf(range);

    // personal scope filters to current user; team scope fetches all members
    const taskWhere: Record<string, unknown> = {
      projectId,
      ...(scope === 'personal' && { userId: session.user.id }),
      // groupId filter only in personal scope (team shows all groups)
      ...(scope === 'personal' && groupId && { groupId }),
    };

    const [allTasks, myMentions, projectGroupsRaw] = await Promise.all([
      prisma.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          userId: true,
          status: true,
          priority: true,
          createdAt: true,
          completedAt: true,
          dueDate: true,
          title: true,
          group: { select: { id: true, name: true } },
        },
      }),
      prisma.mention.count({
        where: {
          userId: session.user.id,
          timestamp: { gte: since },
          group: { projectGroups: { some: { projectId } } },
        },
      }),
      prisma.projectGroup.findMany({
        where: { projectId },
        include: { group: { select: { id: true, name: true } } },
        orderBy: { group: { name: 'asc' } },
      }),
    ]);

    const groups = projectGroupsRaw.map((pg) => ({ id: pg.group.id, name: pg.group.name }));

    // ── Overview ─────────────────────────────────────────────────────────────

    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter((t) => t.status === 'done');
    const completedInRange = doneTasks.filter((t) => t.completedAt && t.completedAt >= since);
    const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

    const cycleTimes = completedInRange
      .map((t) => (!t.completedAt ? null : (t.completedAt.getTime() - t.createdAt.getTime()) / 86400000))
      .filter((v): v is number => v !== null && v >= 0);
    const avgCycleTime =
      cycleTimes.length > 0
        ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
        : null;

    // ── Daily volume ─────────────────────────────────────────────────────────

    const days: string[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(toDateKey(d));
    }
    const createdByDay: Record<string, number> = {};
    const completedByDay: Record<string, number> = {};
    days.forEach((d) => { createdByDay[d] = 0; completedByDay[d] = 0; });
    allTasks.forEach((t) => {
      const cKey = toDateKey(t.createdAt);
      if (cKey in createdByDay) createdByDay[cKey]++;
      if (t.completedAt) {
        const dKey = toDateKey(t.completedAt);
        if (dKey in completedByDay) completedByDay[dKey]++;
      }
    });
    const dailyVolume = days.map((day) => ({ date: day, created: createdByDay[day], completed: completedByDay[day] }));

    // ── By group ─────────────────────────────────────────────────────────────

    const groupMap: Record<string, { id: string; name: string; todo: number; in_progress: number; done: number }> = {};
    allTasks.forEach((t) => {
      if (!t.group) return;
      if (!groupMap[t.group.id]) {
        groupMap[t.group.id] = { id: t.group.id, name: t.group.name, todo: 0, in_progress: 0, done: 0 };
      }
      const key = t.status as 'todo' | 'in_progress' | 'done';
      if (key in groupMap[t.group.id]) groupMap[t.group.id][key]++;
    });
    const byGroup = Object.values(groupMap).sort((a, b) => (b.todo + b.in_progress) - (a.todo + a.in_progress));

    // ── By priority ──────────────────────────────────────────────────────────

    const priorityOrder = ['urgent', 'high', 'medium', 'low', 'none'];
    const priorityMap: Record<string, { todo: number; in_progress: number; done: number }> = {};
    priorityOrder.forEach((p) => { priorityMap[p] = { todo: 0, in_progress: 0, done: 0 }; });
    allTasks.forEach((t) => {
      const p = t.priority ?? 'none';
      const s = t.status as 'todo' | 'in_progress' | 'done';
      if (priorityMap[p] && s in priorityMap[p]) priorityMap[p][s]++;
    });
    const byPriority = priorityOrder.map((p) => ({ priority: p, ...priorityMap[p] }));

    // ── Open tasks ────────────────────────────────────────────────────────────

    const openTasks = allTasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        group: t.group,
        ageDays: Math.floor((Date.now() - t.createdAt.getTime()) / 86400000),
      }));

    return NextResponse.json({
      overview: { completedInRange: completedInRange.length, completionRate, avgCycleTime, mentionCount: myMentions },
      dailyVolume,
      byGroup,
      byPriority,
      openTasks,
    });
  } catch (err) {
    console.error('[api] GET /api/analytics error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
