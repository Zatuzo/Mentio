import { api } from '../client';
import type { TaskDTO, MentionDTO, SummaryDTO } from '../types';

export type McpPrompt = {
  name: string;
  description: string;
  arguments: { name: string; description: string; required: boolean }[];
  build: (args: Record<string, string>) => Promise<{ role: 'user'; content: string }[]>;
};

export const prompts: McpPrompt[] = [
  {
    name: 'daily_standup',
    description: 'Generate standup harian dari task yang selesai kemarin dan task open hari ini.',
    arguments: [{ name: 'projectId', description: 'ID project', required: true }],
    async build({ projectId }) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [openTasks, doneTasks]: [TaskDTO[], TaskDTO[]] = await Promise.all([
        api.get(`/tasks?projectId=${projectId}&status=todo,in_progress`),
        api.get(`/tasks?projectId=${projectId}&status=done&limit=20`),
      ]);

      const doneYesterday = doneTasks.filter(
        (t) => t.completedAt && new Date(t.completedAt) >= yesterday
      );

      const content = [
        'Buatkan standup harian berdasarkan data task berikut.',
        '',
        '## Selesai kemarin',
        doneYesterday.length === 0
          ? '(tidak ada)'
          : doneYesterday.map((t) => `- ${t.title}`).join('\n'),
        '',
        '## Sedang dikerjakan / todo hari ini',
        openTasks.length === 0
          ? '(tidak ada)'
          : openTasks.map((t) => `- [${t.status}] ${t.title}${t.assignedTo ? ` (@${t.assignedTo.name})` : ''}`).join('\n'),
        '',
        'Format standup: 3 poin — kemarin, hari ini, blocker. Ringkas, bukan bullet poin panjang.',
      ].join('\n');

      return [{ role: 'user', content }];
    },
  },

  {
    name: 'mention_triage',
    description: 'Triage mention terbaru — mana yang perlu aksi segera, mana yang bisa ditunda.',
    arguments: [
      { name: 'groupId', description: 'ID group WhatsApp', required: true },
      { name: 'since', description: 'ISO timestamp awal (opsional)', required: false },
    ],
    async build({ groupId, since }) {
      const params = new URLSearchParams({ groupId, limit: '30' });
      if (since) params.set('since', since);
      const mentions: MentionDTO[] = await api.get(`/mentions?${params}`);

      if (mentions.length === 0) {
        return [{ role: 'user', content: 'Tidak ada mention baru untuk di-triage.' }];
      }

      const content = [
        `Berikut ${mentions.length} mention terbaru dari group ini. Kategorikan masing-masing:`,
        '- **URGENT**: perlu respon/aksi dalam beberapa jam',
        '- **NORMAL**: bisa dikerjakan hari ini',
        '- **DEFER**: bisa ditunda atau didelegasikan',
        '- **INFO**: tidak perlu aksi',
        '',
        '---',
        '',
        ...mentions.map(
          (m, i) =>
            `### ${i + 1}. ${m.senderName ?? m.senderJid} — ${m.timestamp.slice(0, 16)}\n<mention>${m.text}</mention>`
        ),
        '',
        'Sajikan dalam format tabel: No | Pengirim | Kategori | Alasan singkat',
      ].join('\n');

      return [{ role: 'user', content }];
    },
  },

  {
    name: 'task_brief',
    description: 'Buat brief lengkap satu task — konteks mention, status, history.',
    arguments: [{ name: 'taskId', description: 'ID task', required: true }],
    async build({ taskId }) {
      const task = await api.get(`/tasks/${taskId}`);

      const lines = [
        `Buatkan brief singkat untuk task berikut, cocok untuk di-share ke tim atau sebagai konteks sebelum mulai coding.`,
        '',
        `## Task: ${task.title}`,
        `Status: ${task.status} | Priority: ${task.priority}`,
        `Project: ${task.project?.name ?? '-'}`,
        `Requester: ${task.requester ?? '-'}`,
        task.description ? `\n### Deskripsi\n${task.description}` : '',
        task.mention
          ? `\n### Mention asal\nDari ${task.mention.senderName ?? '?'} pada ${task.mention.timestamp.slice(0, 16)}:\n<mention>${task.mention.text}</mention>`
          : '',
        '',
        'Format brief: 2-3 kalimat — apa yang diinginkan, konteks kenapa, apa yang perlu dilakukan.',
      ];

      return [{ role: 'user', content: lines.filter((l) => l !== null).join('\n') }];
    },
  },

  {
    name: 'group_health',
    description: 'Analisis "kesehatan" group — frekuensi mention, pola, task yang sering overdue.',
    arguments: [{ name: 'groupId', description: 'ID group', required: true }],
    async build({ groupId }) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [mentions, tasks, summaryResult] = await Promise.allSettled([
        api.get(`/mentions?groupId=${groupId}&since=${weekAgo.toISOString()}&limit=100`) as Promise<MentionDTO[]>,
        api.get(`/tasks?groupId=${groupId}&limit=50`) as Promise<TaskDTO[]>,
        api.get(`/summaries?groupId=${groupId}`) as Promise<SummaryDTO>,
      ]);

      const mentionList: MentionDTO[] = mentions.status === 'fulfilled' ? mentions.value : [];
      const taskList: TaskDTO[] = tasks.status === 'fulfilled' ? tasks.value : [];
      const lastSummary: SummaryDTO | null = summaryResult.status === 'fulfilled' ? summaryResult.value : null;

      const overdueCount = taskList.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
      ).length;

      const senderFreq = new Map<string, number>();
      for (const m of mentionList) {
        const name = m.senderName ?? m.senderJid;
        senderFreq.set(name, (senderFreq.get(name) ?? 0) + 1);
      }
      const topSenders = [...senderFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => `${name}: ${count}x`);

      const content = [
        `Analisis kesehatan group untuk minggu terakhir. Berikan insight dan rekomendasi.`,
        '',
        `## Data`,
        `Total mention 7 hari: ${mentionList.length}`,
        `Rata-rata per hari: ${(mentionList.length / 7).toFixed(1)}`,
        `Total task di group: ${taskList.length}`,
        `Task overdue: ${overdueCount}`,
        `Task selesai: ${taskList.filter((t) => t.status === 'done').length}`,
        '',
        `Top pengirim mention:`,
        ...topSenders.map((s) => `- ${s}`),
        '',
        lastSummary
          ? `## Summary terakhir\n${lastSummary.content}`
          : '(belum ada summary)',
        '',
        'Berikan: 1) Status kesehatan (sehat/normal/perlu perhatian), 2) Pattern yang menarik, 3) 2-3 rekomendasi aksi.',
      ];

      return [{ role: 'user', content: content.join('\n') }];
    },
  },
];
