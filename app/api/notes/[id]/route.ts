import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { embedNote } from '@/app/lib/embeddings';
import { autoOrganizeNote } from '@/app/lib/auto-organize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.note.findUnique({
    where: { id: params.id },
    include: {
      tags: { include: { tag: true } },
      space: { select: { id: true, name: true, icon: true } },
      sourceMention: {
        select: { id: true, text: true, senderName: true, timestamp: true, group: { select: { name: true } } },
      },
    },
  });
  if (!note || note.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(note);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note || note.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { title, content, spaceId, tagIds, isPinned, isNew, imageUrls } = body;

  // Replace tags if tagIds provided
  const tagsOp =
    tagIds !== undefined
      ? {
          deleteMany: {},
          create: tagIds.map((tagId: string) => ({ tagId })),
        }
      : undefined;

  const updated = await prisma.note.update({
    where: { id: params.id },
    data: {
      title: title !== undefined ? title.trim() || 'Untitled' : note.title,
      content: content !== undefined ? content : note.content,
      spaceId: spaceId !== undefined ? spaceId : note.spaceId,
      isPinned: isPinned !== undefined ? isPinned : note.isPinned,
      isNew: isNew !== undefined ? isNew : undefined,
      imageUrls: imageUrls !== undefined
        ? (Array.isArray(imageUrls) ? imageUrls.filter((u: unknown) => typeof u === 'string') : [])
        : undefined,
      ...(tagsOp ? { tags: tagsOp } : {}),
    },
    include: {
      tags: { include: { tag: true } },
      space: { select: { id: true, name: true, icon: true } },
    },
  });

  if (title !== undefined || content !== undefined) {
    embedNote(params.id).catch(() => {});
    autoOrganizeNote(params.id).catch(() => {});
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note || note.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.note.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
