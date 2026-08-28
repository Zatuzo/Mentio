import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/notes/[id]/links — return backlinks (notes that link TO this note)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.note.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!note || note.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const backlinks = await prisma.noteLink.findMany({
    where: { targetId: params.id },
    include: {
      source: {
        select: {
          id: true, title: true, updatedAt: true,
          space: { select: { name: true, icon: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(backlinks.map((l) => l.source));
}

// POST /api/notes/[id]/links — sync outgoing links from note content
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.note.findUnique({
    where: { id: params.id },
    select: { userId: true, content: true },
  });
  if (!note || note.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { targetIds } = await req.json() as { targetIds: string[] };

  // Replace all outgoing links from this note
  await prisma.noteLink.deleteMany({ where: { sourceId: params.id } });

  if (targetIds.length) {
    const validTargets = await prisma.note.findMany({
      where: { id: { in: targetIds }, userId: session.user.id },
      select: { id: true },
    });

    await prisma.noteLink.createMany({
      data: validTargets.map((t) => ({
        userId: session.user.id,
        sourceId: params.id,
        targetId: t.id,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true, linked: targetIds.length });
}
