import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { decryptText } from '@/app/lib/crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mention = await prisma.mention.findUnique({
    where: { id: params.id },
    include: { group: { select: { name: true } } },
  });
  if (!mention || mention.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const mentionText = decryptText(mention.text) ?? '';

  // Prevent duplicate saves
  const existing = await prisma.note.findUnique({ where: { sourceMentionId: params.id } });
  if (existing) return NextResponse.json(existing);

  const body = await req.json().catch(() => ({}));
  const { spaceId: bodySpaceId, additionalContext } = body;

  // Resolve target space: use provided spaceId or fall back to user's Inbox
  let spaceId = bodySpaceId;
  if (!spaceId) {
    const inbox = await prisma.space.findFirst({
      where: { userId: session.user.id, isInbox: true },
    });
    if (!inbox) return NextResponse.json({ error: 'No inbox space found' }, { status: 400 });
    spaceId = inbox.id;
  }

  const date = mention.timestamp.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const content = [
    `**From:** ${mention.senderName || mention.senderJid}`,
    `**Group:** ${mention.group.name}`,
    `**Date:** ${date}`,
    '',
    mentionText,
    ...(additionalContext ? ['', '---', '', additionalContext] : []),
  ].join('\n');

  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      spaceId,
      title: mentionText.slice(0, 60).trim() || 'WA Mention',
      content,
      sourceType: 'wa_mention',
      sourceMentionId: mention.id,
    },
    include: {
      tags: { include: { tag: true } },
      space: { select: { id: true, name: true, icon: true } },
    },
  });
  return NextResponse.json(note, { status: 201 });
}
