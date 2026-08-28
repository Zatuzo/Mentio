import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/groups/[id]/members — list a claimed group's participants,
// flagged with whether the current user already watches each one.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId = decodeURIComponent(params.id);

  // The user must have claimed this group to see its members.
  const link = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!link) {
    return NextResponse.json({ error: 'You have not claimed this group' }, { status: 403 });
  }

  const [members, watched] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId },
      orderBy: [{ isAdmin: 'desc' }, { name: 'asc' }, { jid: 'asc' }],
    }),
    prisma.watchedJid.findMany({
      where: { userId: session.user.id },
      select: { jid: true },
    }),
  ]);
  const watchedSet = new Set(watched.map((w) => w.jid));

  return NextResponse.json({
    members: members.map((m) => ({
      jid: m.jid,
      phone: m.phone,
      name: m.name,
      isAdmin: m.isAdmin,
      isLid: m.jid.endsWith('@lid'),
      watched: watchedSet.has(m.jid),
    })),
  });
}
