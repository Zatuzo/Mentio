import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { validateMcpKey } from '@/app/lib/mcp-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const groupId = searchParams.get('groupId');
  const since = searchParams.get('since');
  const q = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

  const where: Record<string, unknown> = { userId: key.userId };
  if (groupId) where.groupId = groupId;
  if (since) where.timestamp = { gte: new Date(since) };
  if (q) where.text = { contains: q, mode: 'insensitive' };

  const mentions = await prisma.mention.findMany({
    where,
    include: { group: { select: { id: true, name: true } } },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return NextResponse.json(
    mentions.map((m) => ({
      id: m.id,
      text: m.text,
      senderName: m.senderName,
      senderJid: m.senderJid,
      timestamp: m.timestamp.toISOString(),
      processed: m.processed,
      group: m.group,
    }))
  );
}
