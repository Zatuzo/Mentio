// Runtime behaviour rules the listener applies before a mention is persisted.
// Kept isolated from listener.js so "what counts as noise" is easy to read
// and reason about without wading through the Baileys socket plumbing.

const WINDOW_MS = Number(process.env.MENTION_RATE_LIMIT_WINDOW_MS) || 60_000; // 1 minute

// `|| 5` alone would treat MENTION_RATE_LIMIT_MAX=0 as "unset" (0 is falsy)
// instead of "disable the limit", so parse explicitly to allow that escape
// hatch for a WA number that's known to be low-volume.
const rawMax = Number(process.env.MENTION_RATE_LIMIT_MAX);
const MAX_PER_WINDOW = Number.isFinite(rawMax) && rawMax >= 0 ? rawMax : 5;
const DISABLED = MAX_PER_WINDOW === 0;

// key -> array of timestamps (ms) of mentions accepted for that (group, sender) pair
const recentMentions = new Map();

function keyFor(groupId, senderJid) {
  return `${groupId}::${senderJid}`;
}

// Sliding-window rate limit per (group, sender): a noisy sender (broadcast
// bot, forwarded chain, someone spamming @mentions) shouldn't be able to
// flood a user's mention feed and burn AI summarization budget. Returns
// false once the sender has already hit the limit inside the current window
// — the listener should skip persisting that mention.
function shouldRecordMention(groupId, senderJid) {
  if (DISABLED) return true;

  const key = keyFor(groupId, senderJid);
  const now = Date.now();
  const timestamps = (recentMentions.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_PER_WINDOW) {
    recentMentions.set(key, timestamps); // keep only the still-fresh entries
    return false;
  }

  timestamps.push(now);
  recentMentions.set(key, timestamps);
  return true;
}

// Prevent unbounded memory growth on a long-running listener process:
// periodically drop keys that have had no activity in the last window.
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of recentMentions) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) recentMentions.delete(key);
    else recentMentions.set(key, fresh);
  }
}, WINDOW_MS).unref();

module.exports = { shouldRecordMention };
