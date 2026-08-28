import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve the user's active project (cookie, then first membership). */
async function activeProjectId(userId: string): Promise<string | null> {
  const cookieId = cookies().get('mentio_project_id')?.value;
  if (cookieId) {
    const m = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: cookieId, userId } },
    });
    if (m) return cookieId;
  }
  const first = await prisma.projectMember.findFirst({
    where: { userId },
    orderBy: { project: { createdAt: 'asc' } },
  });
  return first?.projectId ?? null;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!(session.user as any).isOwner) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

// GET /api/admin/groups — groups the bot already knows about that this admin hasn't watched yet
export async function GET() {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const groups = await prisma.group.findMany({
    where: { userGroups: { none: { userId: session!.user.id } } },
    orderBy: { name: 'asc' },
    include: { _count: { select: { mentions: true } } },
  });

  return NextResponse.json({
    groups: groups.map((g) => ({ id: g.id, name: g.name, mentionCount: g._count.mentions })),
  });
}

// POST /api/admin/groups — directly watch a group, bypassing the claim-code flow
export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { groupId } = await req.json();
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const projectId = await activeProjectId(session!.user.id);
  if (!projectId) {
    return NextResponse.json(
      { error: 'Create a project before watching groups' },
      { status: 400 }
    );
  }

  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: session!.user.id, groupId } },
    update: { enabled: true },
    create: { userId: session!.user.id, groupId, enabled: true },
  });
  await prisma.projectGroup.upsert({
    where: { projectId_groupId: { projectId, groupId } },
    update: {},
    create: { projectId, groupId },
  });

  return NextResponse.json({ ok: true });
}
