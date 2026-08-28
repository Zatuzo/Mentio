import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return member?.role === 'admin' ? member : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; slug: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await requireAdmin(params.id, session.user.id);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { label, color, isDone } = await req.json() as {
    label?: string;
    color?: string;
    isDone?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (label !== undefined) {
    if (!label.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 });
    data.label = label.trim();
  }
  if (color !== undefined) data.color = color;
  if (isDone !== undefined) data.isDone = isDone;

  const updated = await prisma.projectStatus.updateMany({
    where: { projectId: params.id, slug: params.slug },
    data,
  });

  if (updated.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const status = await prisma.projectStatus.findUnique({
    where: { projectId_slug: { projectId: params.id, slug: params.slug } },
  });
  return NextResponse.json(status);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; slug: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await requireAdmin(params.id, session.user.id);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Cannot delete if it's the last status
  const total = await prisma.projectStatus.count({ where: { projectId: params.id } });
  if (total <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last status' }, { status: 400 });
  }

  // Cannot delete if tasks are still using this status
  const taskCount = await prisma.task.count({
    where: { projectId: params.id, status: params.slug },
  });
  if (taskCount > 0) {
    return NextResponse.json(
      { error: `Move ${taskCount} task${taskCount > 1 ? 's' : ''} out of this status first` },
      { status: 409 }
    );
  }

  await prisma.projectStatus.deleteMany({
    where: { projectId: params.id, slug: params.slug },
  });

  return NextResponse.json({ ok: true });
}
