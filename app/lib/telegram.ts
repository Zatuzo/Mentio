const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

type InlineButton = { text: string; callback_data?: string; url?: string };
type InlineKeyboard = InlineButton[][];

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(`${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: false }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendTelegramMessageWithButtons(
  chatId: string,
  text: string,
  keyboard: InlineKeyboard,
): Promise<{ ok: boolean; messageId?: number }> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false };
  try {
    const res = await fetch(`${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard },
      }),
    });
    const data = await res.json();
    return { ok: data.ok, messageId: data.result?.message_id };
  } catch {
    return { ok: false };
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`${TG}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
  }).catch(() => {});
}

export async function editMessageText(
  chatId: string,
  messageId: number,
  text: string,
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`${TG}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [] },
    }),
  }).catch(() => {});
}

export async function setTelegramWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not set' };
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const res = await fetch(`${TG}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret || undefined }),
  });
  return res.json();
}

export async function getTelegramBotInfo(): Promise<{ ok: boolean; username?: string }> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false };
  const res = await fetch(`${TG}/getMe`);
  const data = await res.json();
  return { ok: data.ok, username: data.result?.username };
}

export function formatTaskDueReminder(task: {
  id: string; title: string; dueDate: Date | null; priority: string;
}, appUrl: string): string {
  const due = task.dueDate
    ? task.dueDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '';
  const prio = task.priority !== 'none' ? `*Prioritas:* ${task.priority}\n` : '';
  return [
    '📌 *Reminder: Task Jatuh Tempo*\n',
    `*Task:* ${task.title}`,
    due ? `*Due:* ${due}` : '',
    prio,
    `[Lihat Task →](${appUrl}/tasks#${task.id})`,
  ].filter(Boolean).join('\n');
}

export function formatTaskAssigned(task: { id: string; title: string }, assignedBy: string, appUrl: string): string {
  return [
    '🎯 *Task Baru Untukmu*\n',
    `*Task:* ${task.title}`,
    `*Dari:* ${assignedBy}\n`,
    `[Lihat Task →](${appUrl}/tasks#${task.id})`,
  ].join('\n');
}

export function formatDigestReady(type: 'daily' | 'weekly', appUrl: string): string {
  if (type === 'weekly') {
    return `📊 *Weekly Review Siap*\n\nRefleksi minggu ini sudah dibuat.\n\n[Baca Weekly Review →](${appUrl}/brain/digest)`;
  }
  return `✨ *Daily Digest Siap*\n\nRingkasan hari ini sudah dibuat.\n\n[Baca Digest →](${appUrl}/brain/digest)`;
}
