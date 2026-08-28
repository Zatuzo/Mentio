import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tags = await prisma.tag.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { noteTags: true, mentionTags: true, taskTags: true } },
    },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(tags);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const tag = await prisma.tag.upsert({
    where: { userId_name: { userId: session.user.id, name: name.trim().toLowerCase() } },
    update: { color: color || undefined },
    create: { userId: session.user.id, name: name.trim().toLowerCase(), color: color || null },
  });
  return NextResponse.json(tag, { status: 201 });
}
