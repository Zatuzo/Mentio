import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { validateMcpKey } from '@/app/lib/mcp-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const waSession = await prisma.waSession.findUnique({
    where: { userId: key.userId },
    select: { connected: true, myJid: true, updatedAt: true },
  });

  const pendingMentions = await prisma.mention.count({
    where: { userId: key.userId, processed: false },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const mentionsToday = await prisma.mention.count({
    where: { userId: key.userId, timestamp: { gte: todayStart } },
  });

  return NextResponse.json({
    listener: {
      connected: waSession?.connected ?? false,
      myJid: waSession?.myJid ?? null,
      lastSeen: waSession?.updatedAt?.toISOString() ?? null,
    },
    mentions: {
      pending: pendingMentions,
      today: mentionsToday,
    },
    serverTime: new Date().toISOString(),
  });
}
