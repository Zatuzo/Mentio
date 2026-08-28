// Polls scheduled reminders and queues them for delivery via MessageQueue.
// Also fires todo Telegram notifications (daily/periodic/deadline/overdue).
require('dotenv').config();
const { prisma } = require('./db');

const POLL_INTERVAL_MS = 30 * 1000; // every 30s
const APP_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

async function tick() {
  const now = new Date();
  const due = await prisma.reminder.findMany({
    where: { sent: false, canceledAt: null, scheduledAt: { lte: now } },
    take: 20,
  });
  if (due.length === 0) return;

  console.log(`[reminders] firing ${due.length} reminder(s)`);
  for (const r of due) {
    try {
      await prisma.messageQueue.create({
        data: {
          userId: r.userId,
          groupId: r.groupId,
          message: `⏰ *Reminder*\n${r.message}`,
        },
      });
      await prisma.reminder.update({
        where: { id: r.id },
        data: { sent: true, sentAt: new Date() },
      });
    } catch (err) {
      console.error(`[reminders] failed for ${r.id}:`, err.message);
    }
  }
}

async function tickTodoNotifs() {
  try {
    const res = await fetch(`${APP_URL}/api/cron/todo-notifs`, {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET, 'content-type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sent > 0) console.log(`[reminders] todo notifs sent: ${data.sent}`);
    }
  } catch (e) {
    console.error('[reminders] todo-notifs error:', e.message);
  }
}

// Fire daily briefing once per day at 08:00 WIB (UTC+7)
let lastBriefingDate = '';
async function tickDailyBriefing() {
  const nowWib = new Date(Date.now() + 7 * 3600_000);
  const hour = nowWib.getUTCHours();
  const today = nowWib.toISOString().slice(0, 10);
  if (hour !== 8 || lastBriefingDate === today) return;
  lastBriefingDate = today;
  try {
    const res = await fetch(`${APP_URL}/api/cron/daily-briefing`, {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET, 'content-type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sent > 0) console.log(`[reminders] daily briefing sent: ${data.sent}`);
    }
  } catch (e) {
    console.error('[reminders] daily-briefing error:', e.message);
  }
}

console.log('[reminders] worker started, polling every', POLL_INTERVAL_MS / 1000, 's');
tick().catch((e) => console.error(e));
tickTodoNotifs().catch((e) => console.error(e));
setInterval(() => {
  tick().catch((e) => console.error(e));
  tickTodoNotifs().catch((e) => console.error(e));
  tickDailyBriefing().catch((e) => console.error(e));
}, POLL_INTERVAL_MS);
