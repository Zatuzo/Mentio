// Lightweight Telegram notifier for ops/health alerts. No-ops if env vars missing.
// Uses HEALTH_BOT_TOKEN + HEALTH_CHAT_ID (dedicated ops bot), separate from
// the user-facing TELEGRAM_BOT_TOKEN used for reminders.
// Usage: const { notify } = require('./notify'); await notify('listener down');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN = process.env.HEALTH_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.HEALTH_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

// File-based dedup: same message won't fire more than once per 5 minutes.
// Survives process restarts (PM2 auto-restart loops).
const COOLDOWN_MS = 5 * 60 * 1000;
const COOLDOWN_DIR = path.join(process.cwd(), 'data', 'notify-cooldown');

function isCoolingDown(text) {
  try {
    fs.mkdirSync(COOLDOWN_DIR, { recursive: true });
    const key = crypto.createHash('md5').update(text).digest('hex');
    const file = path.join(COOLDOWN_DIR, `${key}.json`);
    if (!fs.existsSync(file)) return false;
    const { sentAt } = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Date.now() - sentAt < COOLDOWN_MS;
  } catch { return false; }
}

function markSent(text) {
  try {
    const key = crypto.createHash('md5').update(text).digest('hex');
    const file = path.join(COOLDOWN_DIR, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify({ sentAt: Date.now() }));
  } catch { /* ignore */ }
}

async function notify(text) {
  if (!TOKEN || !CHAT_ID) return;
  if (isCoolingDown(text)) {
    console.log('[notify] suppressed (cooldown):', text.slice(0, 60));
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_notification: false,
      }),
    });
    markSent(text);
  } catch (e) {
    console.error('[notify] failed:', e.message);
  }
}

module.exports = { notify };
