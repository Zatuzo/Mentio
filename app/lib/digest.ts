import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { prisma } from './db';

function getDeepSeek() {
  const provider = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseURL: 'https://api.deepseek.com',
  });
  return provider.chat(process.env.DEEPSEEK_MODEL ?? 'deepseek-chat');
}

function todayPeriod(): string {
  return new Date().toISOString().slice(0, 10); // "2026-06-10"
}

export async function generateDailyDigest(userId: string): Promise<string | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const period = todayPeriod();
  const startOfDay = new Date(`${period}T00:00:00.000Z`);
  const endOfDay = new Date(`${period}T23:59:59.999Z`);

  const [notes, mentions, tasksDue] = await Promise.all([
    prisma.note.findMany({
      where: { userId, updatedAt: { gte: startOfDay, lte: endOfDay } },
      select: { title: true, content: true, space: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.mention.findMany({
      where: { userId, createdAt: { gte: startOfDay, lte: endOfDay } },
      select: { text: true, senderName: true, group: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.task.findMany({
      where: { userId, dueDate: { gte: startOfDay, lte: endOfDay } },
      select: { title: true, status: true, priority: true },
      orderBy: { priority: 'asc' },
      take: 20,
    }),
  ]);

  if (notes.length === 0 && mentions.length === 0 && tasksDue.length === 0) return null;

  const notesText = notes
    .map((n) => `- [${n.space?.name ?? 'Inbox'}] ${n.title}: ${(n.content ?? '').replace(/[#*`>\[\]_]/g, '').slice(0, 150)}`)
    .join('\n');

  const mentionsText = mentions
    .map((m) => `- ${m.senderName ?? 'Unknown'} di ${m.group?.name ?? 'Group'}: ${m.text.slice(0, 100)}`)
    .join('\n');

  const tasksText = tasksDue
    .map((t) => `- [${t.status}] ${t.title} (${t.priority})`)
    .join('\n');

  const prompt = `Buatkan ringkasan harian (daily digest) dalam Bahasa Indonesia yang ringkas dan informatif.

Tanggal: ${period}

NOTES yang diperbarui hari ini (${notes.length}):
${notesText || '(tidak ada)'}

MENTIONS yang diterima hari ini (${mentions.length}):
${mentionsText || '(tidak ada)'}

TASKS dengan deadline hari ini (${tasksDue.length}):
${tasksText || '(tidak ada)'}

Format output:
## Digest Harian — ${new Date(period).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

**Ringkasan:** 2-3 kalimat ringkasan aktivitas hari ini.

**Notes (${notes.length}):** bullet singkat per note penting (maks 5).

**Mentions (${mentions.length}):** highlight mention penting yang perlu ditindaklanjuti (maks 3).

**Tasks Hari Ini (${tasksDue.length}):** daftar tasks deadline hari ini.

**Action Items:** 2-3 hal yang perlu dilakukan berdasarkan data di atas.

Tulis dalam Bahasa Indonesia. Singkat, padat, actionable.`;

  const { text } = await generateText({ model: getDeepSeek(), prompt });
  return text.trim();
}

export async function runDailyDigestForAllUsers(): Promise<{ processed: number; skipped: number }> {
  const period = todayPeriod();
  let processed = 0;
  let skipped = 0;

  // Only users with pro plan or owners
  const users = await prisma.user.findMany({
    where: { OR: [{ plan: 'pro' }, { isOwner: true }] },
    select: { id: true },
  });

  for (const user of users) {
    const existing = await prisma.digest.findUnique({
      where: { userId_type_period: { userId: user.id, type: 'daily', period } },
    });
    if (existing) { skipped++; continue; }

    try {
      const content = await generateDailyDigest(user.id);
      if (!content) { skipped++; continue; }

      await prisma.digest.create({
        data: { userId: user.id, type: 'daily', period, content },
      });
      processed++;
    } catch {
      skipped++;
    }
  }

  return { processed, skipped };
}
