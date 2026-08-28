import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { setTelegramWebhook, getTelegramBotInfo, sendTelegramMessage, formatTaskDueReminder, formatDigestReady } from '@/app/lib/telegram';
import { getActiveTasks, getBriefingData, formatTodoList, formatBriefing, taskShortId } from '@/app/lib/telegram-brain';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function generateCode(): string {
  return randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramChatId: true, telegramEnabled: true },
  });

  const botConfigured = !!process.env.TELEGRAM_BOT_TOKEN;
  let botUsername: string | null = null;
  if (botConfigured) {
    const info = await getTelegramBotInfo().catch(() => ({ ok: false as const }));
    if (info.ok && 'username' in info) botUsername = info.username ?? null;
  }

  return NextResponse.json({
    connected: !!user?.telegramChatId,
    enabled: user?.telegramEnabled ?? false,
    chatId: user?.telegramChatId ?? null,
    botConfigured,
    botUsername,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === 'generate_code') {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    const identifier = `tg_connect_${session.user.id}`;

    // Delete old code if exists, then create fresh
    await prisma.verification.deleteMany({ where: { identifier } });
    await prisma.verification.create({
      data: { id: randomBytes(12).toString('hex'), identifier, value: code, expiresAt },
    });

    return NextResponse.json({ code });
  }

  if (action === 'setup_webhook') {
    const appUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? '';
    if (!appUrl) return NextResponse.json({ error: 'APP_URL not configured' }, { status: 400 });

    const webhookUrl = `${appUrl}/api/webhooks/telegram`;
    const result = await setTelegramWebhook(webhookUrl);
    return NextResponse.json(result);
  }

  if (action === 'toggle') {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramEnabled: true },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { telegramEnabled: !user?.telegramEnabled },
    });
    return NextResponse.json({ enabled: !user?.telegramEnabled });
  }

  if (action === 'test') {
    const { type } = body as { type?: string };
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramChatId: true, name: true },
    });
    if (!user?.telegramChatId) return NextResponse.json({ error: 'Not connected' }, { status: 400 });

    const chatId = user.telegramChatId;
    const userId = session.user.id;
    const appUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? 'https://mentio.space';
    let text = '';

    if (type === 'task_created') {
      text = `✅ *Task dibuat\\!*\n\n📌 Contoh: Fix login bug\nID: \`a1b2c3d4\`\n\nBalas /done a1b2c3d4 kalau sudah selesai\\.`;
    } else if (type === 'note_saved') {
      text = `📝 *Catatan disimpan ke Brain Inbox\\!*\n\n_Ide redesign landing page untuk versi mobile yang lebih clean\\._`;
    } else if (type === 'todo') {
      const tasks = await getActiveTasks(userId);
      text = formatTodoList(tasks);
    } else if (type === 'briefing') {
      const data = await getBriefingData(userId);
      text = formatBriefing(data);
    } else if (type === 'task_reminder') {
      const sampleTask = await prisma.task.findFirst({
        where: { assignedToId: userId, status: { not: 'done' } },
        select: { id: true, title: true, dueDate: true, priority: true },
        orderBy: { createdAt: 'desc' },
      });
      const task = sampleTask ?? { id: 'sample-id-000', title: 'Contoh task jatuh tempo', dueDate: new Date(Date.now() + 2 * 3600_000), priority: 'high' };
      text = formatTaskDueReminder(task, appUrl);
    } else if (type === 'digest') {
      text = formatDigestReady('daily', appUrl);
    } else {
      return NextResponse.json({ error: 'Unknown test type' }, { status: 400 });
    }

    const ok = await sendTelegramMessage(chatId, text);
    return NextResponse.json({ ok });
  }

  if (action === 'disconnect') {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { telegramChatId: null, telegramEnabled: false },
    });
    // Clean up pending codes
    await prisma.verification.deleteMany({
      where: { identifier: `tg_connect_${session.user.id}` },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
