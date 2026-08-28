import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const since = req.nextUrl.searchParams.get('since');
  const where: Record<string, unknown> = { userId: session.user.id };
  if (since) where.createdAt = { gt: new Date(since) };

  const mentions = await prisma.mention.findMany({
    where,
    include: { group: { select: { id: true, name: true } } },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  return NextResponse.json(
    mentions.map((m) => ({
      id: m.id,
      text: m.text,
      senderName: m.senderName,
      senderJid: m.senderJid,
      mentionedJid: m.mentionedJid,
      timestamp: m.timestamp.toISOString(),
      processed: m.processed,
      group: m.group,
      imageUrls: m.imageUrls ?? [],
    }))
  );
}
