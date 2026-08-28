'use strict';

/**
 * AI classifier for WA dump messages using raw OpenAI client (CommonJS-safe).
 * Uses DeepSeek — same pattern as summarizer.js.
 */

const OpenAI = require('openai');

const client = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

/**
 * Classify a WA dump message as 'task' or 'note'.
 * Returns { type: 'task'|'note', title: string }
 * Falls back to 'note' if DEEPSEEK_API_KEY missing or AI fails.
 */
async function classifyDumpMessage(text) {
  const fallbackTitle = text.split('\n')[0].slice(0, 100) || 'WA Note';

  if (!client) {
    return { type: 'note', title: fallbackTitle };
  }

  try {
    const resp = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: `Klasifikasikan pesan berikut: apakah ini sebuah task (todo/aksi yang harus dilakukan) atau note (informasi/referensi)?

Pesan: "${text.slice(0, 500)}"

Aturan:
- task: ada aksi yang harus dilakukan, reminder, deadline, hal yang perlu dikerjakan
- note: informasi, link, artikel, referensi, pemikiran, catatan

Balas HANYA dengan JSON valid, tanpa penjelasan:
{"type":"task","title":"judul singkat maks 80 karakter"} atau {"type":"note","title":"judul singkat maks 80 karakter"}`,
        },
      ],
      max_tokens: 60,
    });

    const result = resp.choices[0]?.message?.content?.trim() || '';
    const match = result.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('no json');
    const parsed = JSON.parse(match[0]);
    if (parsed.type !== 'task' && parsed.type !== 'note') throw new Error('invalid type');
    return {
      type: parsed.type,
      title: (parsed.title || fallbackTitle).slice(0, 100),
    };
  } catch (err) {
    console.warn('[dump-classifier] AI error, fallback to note:', err.message);
    return { type: 'note', title: fallbackTitle };
  }
}

module.exports = { classifyDumpMessage };
