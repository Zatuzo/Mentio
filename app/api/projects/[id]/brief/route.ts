import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';

async function isMember(projectId: string, userId: string) {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  return !!m;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isMember(params.id, session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { brief: true, briefUpdatedAt: true, briefUpdaterName: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    brief: project.brief,
    briefUpdatedAt: project.briefUpdatedAt?.toISOString() ?? null,
    briefUpdaterName: project.briefUpdaterName,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isMember(params.id, session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { brief } = await req.json().catch(() => ({ brief: null }));
  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      brief: typeof brief === 'string' ? brief || null : null,
      briefUpdatedAt: new Date(),
      briefUpdaterName: session.user.name ?? session.user.email ?? 'Unknown',
    },
    select: { brief: true, briefUpdatedAt: true, briefUpdaterName: true },
  });
  return NextResponse.json({
    brief: project.brief,
    briefUpdatedAt: project.briefUpdatedAt?.toISOString() ?? null,
    briefUpdaterName: project.briefUpdaterName,
  });
}
