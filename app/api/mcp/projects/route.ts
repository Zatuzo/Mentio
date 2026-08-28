import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { validateMcpKey } from '@/app/lib/mcp-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberships = await prisma.projectMember.findMany({
    where: { userId: key.userId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          techStack: true,
          _count: { select: { tasks: true } },
          groups: {
            include: { group: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const openCountByProject = await Promise.all(
    memberships.map(async (m) => {
      const open = await prisma.task.count({
        where: { projectId: m.projectId, status: { not: 'done' } },
      });
      return { projectId: m.projectId, open };
    })
  );
  const openMap = new Map(openCountByProject.map((r) => [r.projectId, r.open]));

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      role: m.role,
      techStack: m.project.techStack,
      totalTasks: m.project._count.tasks,
      openTasks: openMap.get(m.projectId) ?? 0,
      groups: m.project.groups.map((pg) => ({ id: pg.group.id, name: pg.group.name })),
    }))
  );
}
