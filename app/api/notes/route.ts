import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { embedNote } from '@/app/lib/embeddings';
import { autoOrganizeNote } from '@/app/lib/auto-organize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get('spaceId');
  const tagId = searchParams.get('tagId');

  const notes = await prisma.note.findMany({
    where: {
      userId: session.user.id,
      ...(spaceId ? { spaceId } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
    },
    include: {
      tags: { include: { tag: true } },
      space: { select: { id: true, name: true, icon: true } },
    },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, content, spaceId, tagIds, sourceType, sourceUrl, sourceMentionId, imageUrls } = body;

  // Verify space belongs to user
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space || space.userId !== session.user.id)
    return NextResponse.json({ error: 'Invalid space' }, { status: 400 });

  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      spaceId,
      title: title?.trim() || 'Untitled',
      content: content || '',
      sourceType: sourceType || 'manual',
      sourceUrl: sourceUrl || null,
      sourceMentionId: sourceMentionId || null,
      imageUrls: Array.isArray(imageUrls) ? imageUrls.filter((u: unknown) => typeof u === 'string') : [],
      ...(tagIds?.length
        ? { tags: { create: tagIds.map((tagId: string) => ({ tagId })) } }
        : {}),
    },
    include: {
      tags: { include: { tag: true } },
      space: { select: { id: true, name: true, icon: true } },
    },
  });
  embedNote(note.id).catch(() => {});
  autoOrganizeNote(note.id).catch(() => {});

  return NextResponse.json(note, { status: 201 });
}
