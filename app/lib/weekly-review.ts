import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { prisma } from './db';

function getDeepSeekReasoner() {
  const provider = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseURL: 'https://api.deepseek.com',
  });
  // Use R1 for deeper reasoning; fallback to chat if env override set
  return provider.chat(process.env.DEEPSEEK_REASONER_MODEL ?? 'deepseek-reasoner');
}

/** Returns ISO week string like "2026-W24" for the current week (Mon–Sun). */
export function currentWeekPeriod(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Returns [monday, sunday] Date range for the current ISO week. */
function currentWeekRange(): [Date, Date] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return [monday, sunday];
}

export async function generateWeeklyReview(userId: string): Promise<string | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const [monday, sunday] = currentWeekRange();

  const [notes, mentions, tasks] = await Promise.all([
    prisma.note.findMany({
      where: { userId, updatedAt: { gte: monday, lte: sunday } },
      select: {
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        space: { select: { name: true } },
        tags: { include: { tag: { select: { name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.mention.findMany({
      where: { userId, createdAt: { gte: monday, lte: sunday } },
      select: {
        text: true,
        senderName: true,
        timestamp: true,
        group: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.task.findMany({
      where: { userId, updatedAt: { gte: monday, lte: sunday } },
      select: { title: true, status: true, priority: true, dueDate: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    }),
  ]);

  // Build activity-per-day breakdown for pattern analysis
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const notesByDay: Record<string, number> = {};
  const mentionsByDay: Record<string, number> = {};

  for (const n of notes) {
    const d = dayNames[new Date(n.updatedAt).getDay()];
    notesByDay[d] = (notesByDay[d] ?? 0) + 1;
  }
  for (const m of mentions) {
    const d = dayNames[new Date(m.timestamp).getDay()];
    mentionsByDay[d] = (mentionsByDay[d] ?? 0) + 1;
  }

  // Top tags this week
  const tagCount: Record<string, number> = {};
  for (const n of notes) {
    for (const nt of n.tags) tagCount[nt.tag.name] = (tagCount[nt.tag.name] ?? 0) + 1;
  }
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `${name}(${count})`)
    .join(', ');

  // Top senders
  const senderCount: Record<string, number> = {};
  for (const m of mentions) {
    const key = m.senderName ?? 'Unknown';
    senderCount[key] = (senderCount[key] ?? 0) + 1;
  }
  const topSenders = Object.entries(senderCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name}(${count}x)`)
    .join(', ');

  const tasksCompleted = tasks.filter((t) => t.status === 'done' || t.status === 'completed').length;
  const tasksPending = tasks.filter((t) => t.status !== 'done' && t.status !== 'completed').length;
  const tasksOverdue = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done',
  ).length;

  const notesSnippets = notes
    .slice(0, 12)
    .map((n) => `[${n.space?.name}] "${n.title}": ${(n.content ?? '').replace(/[#*`>\[\]_]/g, '').slice(0, 120)}`)
    .join('\n');

  const mentionSnippets = mentions
    .slice(0, 10)
    .map((m) => `${m.senderName ?? '?'} (${m.group?.name ?? '?'}): ${m.text.slice(0, 100)}`)
    .join('\n');

  const weekLabel = currentWeekPeriod();
  const mondayStr = monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
  const sundayStr = sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const prompt = `Kamu adalah AI analyst yang membuat Weekly Review mendalam untuk seorang profesional.

Analisis data berikut dari minggu ${weekLabel} (${mondayStr} – ${sundayStr}):

NOTES (${notes.length} diperbarui minggu ini):
${notesSnippets || '(tidak ada)'}

AKTIVITAS NOTES PER HARI: ${JSON.stringify(notesByDay)}

MENTIONS DITERIMA (${mentions.length} total):
${mentionSnippets || '(tidak ada)'}

AKTIVITAS MENTIONS PER HARI: ${JSON.stringify(mentionsByDay)}
TOP PENGIRIM MENTION: ${topSenders || 'tidak ada'}

TASKS MINGGU INI: ${tasks.length} total — ${tasksCompleted} selesai, ${tasksPending} pending, ${tasksOverdue} overdue
TOP TAGS: ${topTags || 'tidak ada'}

Tulis Weekly Review dalam Bahasa Indonesia dengan format berikut:

## Weekly Review — ${mondayStr} – ${sundayStr}

**Ringkasan Minggu Ini:** 3-4 kalimat narasi tentang apa yang terjadi minggu ini.

### Produktivitas
- Analisis ritme kerja harian (hari tersibuk, pola konsistensi)
- Perbandingan output vs workload
- Skor produktivitas minggu ini: X/10 (berikan alasan)

### Tema & Pola
- 3-5 tema dominan dari notes dan mentions minggu ini
- Topik yang berulang dan perlu perhatian lebih
- Koneksi antar topik yang menarik

### Kolaborasi & Komunikasi
- Siapa yang paling sering berinteraksi dan konteks-nya
- Permintaan atau pertanyaan yang belum dijawab
- Dinamika grup/komunitas

### Tasks & Deliverables
- Progress tasks: berapa selesai vs target
- Tasks overdue yang perlu segera diselesaikan
- Prioritas yang mungkin perlu di-rebalance

### Pola yang Perlu Diperhatikan
- Deteksi: apakah ada pola negatif (overload hari tertentu, topik menumpuk, banyak interrupt)?
- Deteksi: pola positif yang bisa diperkuat
- Apakah ada "bottleneck" yang terlihat dari data?

### Rekomendasi Minggu Depan
1. [Aksi konkret pertama]
2. [Aksi konkret kedua]
3. [Aksi konkret ketiga]

**Insight Kunci:** 1 insight paling penting dari analisis ini.

Tulis analisis yang mendalam, spesifik, dan actionable berdasarkan data nyata di atas.`;

  const { text } = await generateText({ model: getDeepSeekReasoner(), prompt });
  // DeepSeek R1 returns <think>...</think> blocks before the answer — strip them
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return cleaned || text.trim();
}

export async function runWeeklyReviewForAllUsers(): Promise<{ processed: number; skipped: number }> {
  const period = currentWeekPeriod();
  let processed = 0;
  let skipped = 0;

  const users = await prisma.user.findMany({
    where: { OR: [{ plan: 'pro' }, { isOwner: true }] },
    select: { id: true },
  });

  for (const user of users) {
    const existing = await prisma.digest.findUnique({
      where: { userId_type_period: { userId: user.id, type: 'weekly', period } },
    });
    if (existing) { skipped++; continue; }

    try {
      const content = await generateWeeklyReview(user.id);
      if (!content) { skipped++; continue; }

      await prisma.digest.create({
        data: { userId: user.id, type: 'weekly', period, content },
      });
      processed++;
    } catch {
      skipped++;
    }
  }

  return { processed, skipped };
}
