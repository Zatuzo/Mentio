import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { ensureInbox } from '@/app/lib/brain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayEnd() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function dailyTitle() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const today = todayStart();

  // Find existing daily note for today
  const existing = await prisma.note.findFirst({
    where: { userId, isDaily: true, dailyDate: today },
    include: {
      space: { select: { id: true, name: true, icon: true } },
      tags: { include: { tag: true } },
      sourceMention: {
        select: { id: true, text: true, senderName: true, timestamp: true, group: { select: { name: true } } },
      },
    },
  });

  if (existing) return NextResponse.json(existing);

  // Create today's daily note
  const inbox = await ensureInbox(userId);
  const note = await prisma.note.create({
    data: {
      userId,
      spaceId: inbox.id,
      title: dailyTitle(),
      content: '',
      sourceType: 'manual',
      isDaily: true,
      dailyDate: today,
    },
    include: {
      space: { select: { id: true, name: true, icon: true } },
      tags: { include: { tag: true } },
      sourceMention: {
        select: { id: true, text: true, senderName: true, timestamp: true, group: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json(note);
}

export async function POST() {
  // Import today's WA mentions into the daily note
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const today = todayStart();

  const note = await prisma.note.findFirst({
    where: { userId, isDaily: true, dailyDate: today },
  });
  if (!note) return NextResponse.json({ error: 'Daily note not found' }, { status: 404 });

  const mentions = await prisma.mention.findMany({
    where: {
      userId,
      timestamp: { gte: todayStart(), lte: todayEnd() },
    },
    include: { group: { select: { name: true } } },
    orderBy: { timestamp: 'asc' },
    take: 30,
  });

  if (!mentions.length) return NextResponse.json({ imported: 0 });

  const mentionBlock = mentions
    .map(
      (m) =>
        `- **${m.senderName ?? m.senderJid}** (${m.group.name}) — ${m.text.slice(0, 200)}`,
    )
    .join('\n');

  const separator = '\n\n---\n\n## Mentions hari ini\n\n';
  const updatedContent = note.content
    ? note.content + separator + mentionBlock
    : `## Mentions hari ini\n\n${mentionBlock}`;

  await prisma.note.update({
    where: { id: note.id },
    data: { content: updatedContent },
  });

  return NextResponse.json({ imported: mentions.length });
}
