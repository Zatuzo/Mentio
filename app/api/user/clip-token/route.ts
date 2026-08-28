import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { randomBytes } from 'crypto';

function newToken() {
  return randomBytes(32).toString('hex');
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { clipToken: true },
  });

  if (user?.clipToken) {
    return NextResponse.json({ token: user.clipToken });
  }

  // Auto-generate on first access
  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { clipToken: newToken() },
    select: { clipToken: true },
  });

  return NextResponse.json({ token: updated.clipToken });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { clipToken: newToken() },
    select: { clipToken: true },
  });

  return NextResponse.json({ token: updated.clipToken });
}
