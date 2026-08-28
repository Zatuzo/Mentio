import { NextResponse } from 'next/server';
import { prisma } from '../../lib/db';
import { auth } from '../../lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return session.user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const jids = await prisma.watchedJid.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ jids });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { jid, label } = await req.json();
  if (!jid) return NextResponse.json({ error: 'jid required' }, { status: 400 });

  // Plan limits: free = max 3 watch JIDs
  const plan = (user as any).plan || 'free';
  if (plan === 'free') {
    const count = await prisma.watchedJid.count({ where: { userId: user.id } });
    if (count >= 3) return NextResponse.json({ error: 'Free plan limit: max 3 watched numbers. Upgrade to pro.' }, { status: 403 });
  }

  const row = await prisma.watchedJid.upsert({
    where: { userId_jid: { userId: user.id, jid } },
    update: { active: true, label: label || undefined },
    create: { userId: user.id, jid, label: label || null, active: true },
  });
  await prisma.discoveredJid.deleteMany({ where: { userId: user.id, jid } });
  return NextResponse.json({ jid: row });
}
