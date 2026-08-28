import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { generateDailyDigest } from '@/app/lib/digest';
import { generateWeeklyReview, currentWeekPeriod } from '@/app/lib/weekly-review';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const digests = await prisma.digest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, type: true, period: true, content: true, readAt: true, createdAt: true },
  });

  const unreadCount = digests.filter((d) => !d.readAt).length;
  return NextResponse.json({ digests, unreadCount });
}

// POST /api/brain/digests?type=daily|weekly
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') === 'weekly' ? 'weekly' : 'daily';
  const period = type === 'weekly' ? currentWeekPeriod() : new Date().toISOString().slice(0, 10);

  const existing = await prisma.digest.findUnique({
    where: { userId_type_period: { userId: session.user.id, type, period } },
  });
  if (existing) return NextResponse.json({ digest: existing, cached: true });

  const content =
    type === 'weekly'
      ? await generateWeeklyReview(session.user.id)
      : await generateDailyDigest(session.user.id);

  if (!content) return NextResponse.json({ error: 'No activity to summarize' }, { status: 422 });

  const digest = await prisma.digest.create({
    data: { userId: session.user.id, type, period, content },
  });

  return NextResponse.json({ digest, cached: false });
}
