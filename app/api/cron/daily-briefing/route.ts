import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { sendTelegramMessage } from '@/app/lib/telegram';
import { getBriefingData, formatBriefing } from '@/app/lib/telegram-brain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null }, telegramEnabled: true },
    select: { id: true, telegramChatId: true },
  });

  let sent = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const user of users) {
    if (!user.telegramChatId) continue;

    // Dedupe — only send once per day per user
    const alreadySent = await prisma.telegramNotification.findUnique({
      where: { userId_type_refId: { userId: user.id, type: 'daily_briefing', refId: today } },
    });
    if (alreadySent) continue;

    const data = await getBriefingData(user.id);

    // Skip if nothing to report (no tasks, no mentions, no digests)
    const hasAnything = data.overdue.length + data.dueToday.length + data.upcoming.length + data.unreadMentions + data.unreadDigests > 0;
    if (!hasAnything) continue;

    const text = formatBriefing(data);
    const ok = await sendTelegramMessage(user.telegramChatId, text);
    if (ok) {
      await prisma.telegramNotification.create({ data: { userId: user.id, type: 'daily_briefing', refId: today } });
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
