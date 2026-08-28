import { prisma } from '@/app/lib/db';
import { sendTelegramMessage, sendTelegramMessageWithButtons, formatTaskDueReminder, formatTaskAssigned, formatDigestReady } from '@/app/lib/telegram';

export async function notifyAgentDone(
  taskId: string,
  userId: string,
  prUrl: string,
  summary: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true, telegramEnabled: true },
  });
  if (!user?.telegramChatId || !user.telegramEnabled) return;

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } });
  if (!task) return;

  const shortSummary = summary.length > 300 ? summary.slice(0, 300) + '…' : summary;
  const text = `*Agent selesai mengerjakan task*\n\n*${task.title}*\n\n${shortSummary}\n\n[Lihat PR di GitHub](${prUrl})`;

  await sendTelegramMessageWithButtons(user.telegramChatId, text, [
    [
      { text: 'Lihat PR', url: prUrl },
      { text: 'Tandai Selesai', callback_data: `done:${taskId}` },
    ],
    [{ text: 'Tolak & Hapus Branch', callback_data: `agent_reject:${taskId}` }],
  ]);
}

const TZ_OFFSET: Record<string, number> = {
  'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9,
  'Asia/Singapore': 8, 'Asia/Bangkok': 7, 'UTC': 0,
};
function localHourMinute(timezone: string): [number, number] {
  const offset = TZ_OFFSET[timezone] ?? 7;
  const now = new Date(Date.now() + offset * 3600_000);
  return [now.getUTCHours(), now.getUTCMinutes()];
}
function todayKey(timezone: string): string {
  const offset = TZ_OFFSET[timezone] ?? 7;
  const d = new Date(Date.now() + offset * 3600_000);
  return d.toISOString().slice(0, 10);
}

const APP_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? 'https://mentio.space';

export async function notifyDigestReady(userId: string, digestId: string, type: 'daily' | 'weekly') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true, telegramEnabled: true },
  });
  if (!user?.telegramChatId || !user.telegramEnabled) return;

  const notifType = type === 'weekly' ? 'weekly' : 'digest';
  const alreadySent = await prisma.telegramNotification.findUnique({
    where: { userId_type_refId: { userId, type: notifType, refId: digestId } },
  });
  if (alreadySent) return;

  const text = formatDigestReady(type, APP_URL);
  const sent = await sendTelegramMessage(user.telegramChatId, text);
  if (sent) {
    await prisma.telegramNotification.create({ data: { userId, type: notifType, refId: digestId } });
  }
}

export async function notifyTaskAssigned(taskId: string, assignedToId: string, assignedByName: string) {
  const [user, task] = await Promise.all([
    prisma.user.findUnique({
      where: { id: assignedToId },
      select: { telegramChatId: true, telegramEnabled: true },
    }),
    prisma.task.findUnique({ where: { id: taskId }, select: { title: true } }),
  ]);
  if (!user?.telegramChatId || !user.telegramEnabled || !task) return;

  const alreadySent = await prisma.telegramNotification.findUnique({
    where: { userId_type_refId: { userId: assignedToId, type: 'task_assigned', refId: taskId } },
  });
  if (alreadySent) return;

  const text = formatTaskAssigned({ id: taskId, title: task.title }, assignedByName, APP_URL);
  const { ok } = await sendTelegramMessageWithButtons(user.telegramChatId, text, [
    [{ text: 'Tandai Selesai', callback_data: `done:${taskId}` }],
  ]);
  if (ok) {
    await prisma.telegramNotification.create({ data: { userId: assignedToId, type: 'task_assigned', refId: taskId } });
  }
}

function fmtDate(d: Date | string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function buildTodoDigest(tasks: { id: string; title: string; dueDate: Date | null; priority: string }[], label: string): string {
  const lines = tasks.map((t) => {
    const due = t.dueDate ? ` · ${fmtDate(t.dueDate)}` : '';
    const pri = t.priority !== 'none' ? ` [${t.priority}]` : '';
    return `• ${t.title}${pri}${due}`;
  });
  return `${label}\n\n${lines.join('\n')}\n\n_${APP_URL}/brain/todo_`;
}

export async function sendTodoNotifications() {
  const users = await prisma.todoNotifSettings.findMany({
    where: {
      user: { telegramChatId: { not: null }, telegramEnabled: true },
    },
    include: {
      user: { select: { id: true, telegramChatId: true } },
    },
  });

  let sent = 0;

  for (const s of users) {
    const { user } = s;
    if (!user.telegramChatId) continue;
    const chatId = user.telegramChatId;
    const userId = user.id;
    const tz = s.timezone;
    const today = todayKey(tz);
    const [curH, curM] = localHourMinute(tz);

    // Fetch active todos for this user
    const activeTodos = await prisma.task.findMany({
      where: { assignedToId: userId, status: { not: 'done' } },
      select: { id: true, title: true, dueDate: true, priority: true },
      orderBy: { dueDate: 'asc' },
    });
    if (activeTodos.length === 0 && !s.overdueEnabled) continue;

    // ── 1. Daily summary ───────────────────────────────────────────────────
    if (s.dailyEnabled && activeTodos.length > 0) {
      const [tH, tM] = s.dailyTime.split(':').map(Number);
      const withinWindow = curH === tH && curM >= tM && curM < tM + 30;
      if (withinWindow) {
        const refId = `${today}`;
        const alreadySent = await prisma.telegramNotification.findUnique({
          where: { userId_type_refId: { userId, type: 'todo_daily', refId } },
        });
        if (!alreadySent) {
          const text = buildTodoDigest(activeTodos, `📋 *To Do hari ini* — ${activeTodos.length} task aktif`);
          const ok = await sendTelegramMessage(chatId, text);
          if (ok) {
            await prisma.telegramNotification.create({ data: { userId, type: 'todo_daily', refId } });
            sent++;
          }
        }
      }
    }

    // ── 2. Periodic every N hours ──────────────────────────────────────────
    if (s.periodicEnabled && activeTodos.length > 0) {
      const intervalMs = s.periodicHours * 3600_000;
      const lastAt = s.lastPeriodicAt?.getTime() ?? 0;
      if (Date.now() - lastAt >= intervalMs) {
        const text = buildTodoDigest(activeTodos, `⏰ *Pengingat To Do* — ${activeTodos.length} task belum selesai`);
        const ok = await sendTelegramMessage(chatId, text);
        if (ok) {
          await prisma.todoNotifSettings.update({
            where: { userId },
            data: { lastPeriodicAt: new Date() },
          });
          sent++;
        }
      }
    }

    // ── 3. Deadline reminders ──────────────────────────────────────────────
    if (s.deadlineEnabled) {
      const daysBefore = s.deadlineDays.split(',').map((d) => parseInt(d.trim())).filter((n) => !isNaN(n) && n > 0);
      const now = new Date();
      for (const days of daysBefore) {
        const windowStart = new Date(now.getTime() + (days - 1) * 86400_000);
        const windowEnd = new Date(now.getTime() + days * 86400_000);
        const dueSoon = activeTodos.filter(
          (t) => t.dueDate && new Date(t.dueDate) >= windowStart && new Date(t.dueDate) < windowEnd
        );
        for (const task of dueSoon) {
          const refId = `${task.id}_h${days}`;
          const alreadySent = await prisma.telegramNotification.findUnique({
            where: { userId_type_refId: { userId, type: 'todo_deadline', refId } },
          });
          if (alreadySent) continue;
          const text = `⚠️ *Deadline dalam ${days} hari*\n\n*${task.title}*\nJatuh tempo: ${fmtDate(task.dueDate)}\n\n_${APP_URL}/brain/todo_`;
          const ok = await sendTelegramMessage(chatId, text);
          if (ok) {
            await prisma.telegramNotification.create({ data: { userId, type: 'todo_deadline', refId } });
            sent++;
          }
        }
      }
    }

    // ── 4. Overdue (once a day per task) ──────────────────────────────────
    if (s.overdueEnabled) {
      const now = new Date();
      const overdue = activeTodos.filter((t) => t.dueDate && new Date(t.dueDate) < now);
      if (overdue.length > 0) {
        const refId = `${today}`;
        const alreadySent = await prisma.telegramNotification.findUnique({
          where: { userId_type_refId: { userId, type: 'todo_overdue', refId } },
        });
        if (!alreadySent) {
          const text = buildTodoDigest(overdue, `🚨 *Task Terlambat* — ${overdue.length} task melewati deadline`);
          const ok = await sendTelegramMessage(chatId, text);
          if (ok) {
            await prisma.telegramNotification.create({ data: { userId, type: 'todo_overdue', refId } });
            sent++;
          }
        }
      }
    }
  }

  return sent;
}

export async function sendTaskDueReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const dueTasks = await prisma.task.findMany({
    where: { status: { not: 'done' }, dueDate: { gte: now, lte: in24h } },
    include: {
      user: { select: { id: true, telegramChatId: true, telegramEnabled: true } },
      assignedTo: { select: { id: true, telegramChatId: true, telegramEnabled: true } },
    },
  });

  let count = 0;
  for (const task of dueTasks) {
    const recipients = new Map<string, { chatId: string }>();
    for (const u of [task.user, task.assignedTo]) {
      if (u?.telegramChatId && u.telegramEnabled) recipients.set(u.id, { chatId: u.telegramChatId });
    }
    for (const [userId, { chatId }] of recipients) {
      const alreadySent = await prisma.telegramNotification.findUnique({
        where: { userId_type_refId: { userId, type: 'task_due', refId: task.id } },
      });
      if (alreadySent) continue;
      const text = formatTaskDueReminder({ id: task.id, title: task.title, dueDate: task.dueDate, priority: task.priority }, APP_URL);
      const { ok } = await sendTelegramMessageWithButtons(chatId, text, [
        [{ text: 'Tandai Selesai', callback_data: `done:${task.id}` }],
      ]);
      if (ok) {
        await prisma.telegramNotification.create({ data: { userId, type: 'task_due', refId: task.id } });
        count++;
      }
    }
  }
  return count;
}
