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
  const jids = await prisma.discoveredJid.findMany({
    where: { userId: user.id },
    orderBy: { lastSeen: 'desc' },
  });
  return NextResponse.json({ jids });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { jid } = await req.json();
  if (!jid) return NextResponse.json({ error: 'jid required' }, { status: 400 });
  await prisma.discoveredJid.deleteMany({ where: { userId: user.id, jid } });
  return NextResponse.json({ ok: true });
}
