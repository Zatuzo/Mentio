import { z } from 'zod';
import { api } from '../client';
import type { MentionDTO, MentionDetailDTO } from '../types';

export const mentionTools = [
  {
    name: 'get_mentions',
    description:
      'Ambil mention terbaru. Bisa filter per group, rentang waktu, atau pencarian teks.',
    inputSchema: z.object({
      groupId: z.string().optional().describe('Filter by group ID'),
      since: z.string().optional().describe('ISO timestamp — ambil mention setelah waktu ini'),
      limit: z.number().int().min(1).max(100).default(20).optional(),
      q: z.string().optional().describe('Cari teks dalam mention'),
    }),
    async handler(input: { groupId?: string; since?: string; limit?: number; q?: string }) {
      const params = new URLSearchParams();
      if (input.groupId) params.set('groupId', input.groupId);
      if (input.since) params.set('since', input.since);
      if (input.limit) params.set('limit', String(input.limit));
      if (input.q) params.set('q', input.q);
      const qs = params.toString();
      const data: MentionDTO[] = await api.get(`/mentions${qs ? `?${qs}` : ''}`);
      if (data.length === 0) return 'Tidak ada mention ditemukan.';
      return data
        .map(
          (m) =>
            `[${m.id}] ${m.timestamp} — ${m.senderName ?? m.senderJid} @ ${m.group?.name ?? '?'}\n<mention>${m.text}</mention>`
        )
        .join('\n\n');
    },
  },

  {
    name: 'get_mention',
    description: 'Ambil detail satu mention beserta konteks percakapan di sekitarnya.',
    inputSchema: z.object({
      mentionId: z.string().describe('ID mention'),
    }),
    async handler(input: { mentionId: string }) {
      const m: MentionDetailDTO = await api.get(`/mentions/${input.mentionId}`);
      const parts: string[] = [
        `## Mention ${m.id}`,
        `Waktu: ${m.timestamp}`,
        `Pengirim: ${m.senderName ?? m.senderJid}`,
        `Group: ${m.group?.name ?? '?'}`,
        `\n<mention>${m.text}</mention>`,
      ];
      if (m.tasks.length > 0) {
        parts.push(
          `\n### Tasks terkait`,
          ...m.tasks.map((t) => `- [${t.id}] ${t.title} (${t.status})`)
        );
      }
      if (m.surrounding.length > 0) {
        parts.push(
          `\n### Konteks percakapan (±30 menit)`,
          ...m.surrounding.map(
            (s) => `[${s.timestamp}] ${s.senderName ?? '?'}: <mention>${s.text}</mention>`
          )
        );
      }
      return parts.join('\n');
    },
  },

  {
    name: 'create_task_from_mention',
    description: 'Buat task baru dari sebuah mention. Gunakan list_members untuk mendapatkan assignedToId jika ingin langsung assign ke anggota project.',
    inputSchema: z.object({
      mentionId: z.string(),
      title: z.string().describe('Judul task'),
      description: z.string().optional(),
      assignedToId: z.string().optional().describe('ID user yang ditugaskan (dari list_members)'),
    }),
    async handler(input: { mentionId: string; title: string; description?: string; assignedToId?: string }) {
      const task = await api.patch(`/mentions/${input.mentionId}`, {
        createTask: true,
        title: input.title,
        description: input.description,
        assignedToId: input.assignedToId,
      });
      const assignee = task.assignedTo ? ` → assignee: ${task.assignedTo.name}` : '';
      return `Task dibuat: [${task.id}] ${task.title} — status: ${task.status}${assignee}`;
    },
  },
];
