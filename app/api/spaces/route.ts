import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const spaces = await prisma.space.findMany({
    where: { userId: session.user.id, isArchived: false },
    include: { _count: { select: { notes: true } } },
    orderBy: [{ isInbox: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json(spaces);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, description, icon, color } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const maxOrder = await prisma.space.aggregate({
    where: { userId: session.user.id },
    _max: { order: true },
  });

  const space = await prisma.space.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon || null,
      color: color || null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return NextResponse.json(space, { status: 201 });
}
