import { NextResponse } from 'next/server';
import { prisma } from '../../lib/db';
import { auth } from '../../lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userGroups = await prisma.userGroup.findMany({
    where: { userId: user.id },
    include: { group: true },
    orderBy: { group: { name: 'asc' } },
  });
  const groups = userGroups.map((ug) => ({ ...ug.group, enabled: ug.enabled, userGroupId: ug.id }));
  return NextResponse.json({ groups });
}

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, enabled, autoSummarize, fullChatSummary } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const existing = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: id } },
  });
  if (!existing) {
    return NextResponse.json(
      { error: 'You have not claimed this group. Claim it first.' },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};
  if (enabled !== undefined) data.enabled = !!enabled;
  if (autoSummarize !== undefined) data.autoSummarize = !!autoSummarize;
  if (fullChatSummary !== undefined) data.fullChatSummary = !!fullChatSummary;

  const ug = await prisma.userGroup.update({
    where: { userId_groupId: { userId: user.id, groupId: id } },
    data,
  });
  return NextResponse.json({ group: ug });
}
