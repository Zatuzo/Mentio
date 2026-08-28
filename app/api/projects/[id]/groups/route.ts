import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';

export const runtime = 'nodejs';

async function memberRole(projectId: string, userId: string) {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return m?.role ?? null;
}

// GET /api/projects/[id]/groups — list groups linked to this project
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await memberRole(params.id, session.user.id);
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const linked = await prisma.projectGroup.findMany({
    where: { projectId: params.id },
    include: { group: true },
    orderBy: { group: { name: 'asc' } },
  });

  // All groups this user has claimed (for the "available to add" list)
  const claimed = await prisma.userGroup.findMany({
    where: { userId: session.user.id },
    include: { group: true },
    orderBy: { group: { name: 'asc' } },
  });

  const linkedIds = new Set(linked.map((pg) => pg.groupId));

  return NextResponse.json({
    linked: linked.map((pg) => ({ id: pg.group.id, name: pg.group.name })),
    available: claimed
      .filter((ug) => !linkedIds.has(ug.groupId))
      .map((ug) => ({ id: ug.group.id, name: ug.group.name })),
  });
}

// POST /api/projects/[id]/groups — link a claimed group to this project
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await memberRole(params.id, session.user.id);
  if (role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const { groupId } = await req.json().catch(() => ({}));
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  // Only allow linking groups the user has actually claimed
  const claimed = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!claimed) return NextResponse.json({ error: 'Group not claimed by you' }, { status: 403 });

  await prisma.projectGroup.upsert({
    where: { projectId_groupId: { projectId: params.id, groupId } },
    create: { projectId: params.id, groupId },
    update: {},
  });

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  return NextResponse.json({ id: group!.id, name: group!.name });
}

// DELETE /api/projects/[id]/groups?groupId=xxx — unlink a group from this project
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await memberRole(params.id, session.user.id);
  if (role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  await prisma.projectGroup.deleteMany({
    where: { projectId: params.id, groupId },
  });

  return NextResponse.json({ ok: true });
}
