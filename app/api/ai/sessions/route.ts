import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessions = await prisma.aiChatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(sessions);
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const chat = await prisma.aiChatSession.create({
    data: { userId: session.user.id, title: 'New chat' },
  });
  return NextResponse.json(chat, { status: 201 });
}
