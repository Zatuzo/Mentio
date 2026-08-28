'use strict';

/**
 * In-memory debounce buffer for Full Chat Summary mode.
 *
 * When fullChatSummary is enabled for a group, every incoming message is
 * buffered here. A 5-minute debounce timer resets on each new message.
 * When the timer fires (5 min of silence), AI summarizes the batch and
 * saves to the Summary table.
 *
 * Buffer is lost on listener restart — acceptable trade-off for simplicity.
 */

const OpenAI = require('openai');
const { prisma } = require('./db');

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

const client = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

// Map<groupId, { timer: NodeJS.Timeout, messages: Array<{sender, text, ts}>, userIds: Set<string> }>
const buffers = new Map();

/**
 * Add a message to the buffer for a group.
 * userIds = array of user IDs who have fullChatSummary enabled for this group.
 */
function bufferMessage(groupId, groupName, sender, text, userIds) {
  if (!client) return; // no AI configured, skip

  let buf = buffers.get(groupId);
  if (buf) {
    clearTimeout(buf.timer);
  } else {
    buf = { messages: [], userIds: new Set(), groupName };
    buffers.set(groupId, buf);
  }

  buf.messages.push({ sender, text, ts: new Date() });
  for (const uid of userIds) buf.userIds.add(uid);

  buf.timer = setTimeout(() => flushBuffer(groupId), DEBOUNCE_MS);
}

async function flushBuffer(groupId) {
  const buf = buffers.get(groupId);
  if (!buf || buf.messages.length === 0) {
    buffers.delete(groupId);
    return;
  }

  const { messages, userIds, groupName } = buf;
  buffers.delete(groupId);

  console.log(`[group-chat-buffer] flushing ${messages.length} messages from "${groupName}" for ${userIds.size} user(s)`);

  if (!client) return;

  const lines = messages.map(
    (m) => `[${m.ts.toTimeString().slice(0, 5)}] ${m.sender}: ${m.text}`
  ).join('\n');

  const mentionFrom = messages[0].ts;
  const mentionTo = messages[messages.length - 1].ts;

  try {
    const resp = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `Kamu adalah asisten yang meringkas percakapan grup WhatsApp "${groupName}". Tulis ringkasan dalam bahasa yang sama dengan percakapan. Ringkasan harus singkat (maks 300 kata), terstruktur per topik, dan mencantumkan siapa yang membicarakan apa.`,
        },
        {
          role: 'user',
          content: `Ringkas percakapan berikut:\n\n${lines.slice(0, 8000)}`,
        },
      ],
      max_tokens: 600,
    });

    const content = resp.choices[0]?.message?.content?.trim();
    if (!content) return;

    // Save one Summary row per user who has this mode enabled
    for (const userId of userIds) {
      await prisma.summary.create({
        data: {
          groupId,
          userId,
          content,
          mentionFrom,
          mentionTo,
          mentionIds: JSON.stringify([]), // full chat, no specific mention IDs
        },
      });
    }

    console.log(`[group-chat-buffer] summary saved for group "${groupName}"`);
  } catch (err) {
    console.error('[group-chat-buffer] AI error:', err.message);
  }
}

module.exports = { bufferMessage };
