import { z } from 'zod';
import { api } from '../client';
import type { SummaryDTO } from '../types';

export const summaryTools = [
  {
    name: 'get_summary',
    description: 'Ambil AI summary terakhir dari sebuah group, atau summary pada tanggal tertentu.',
    inputSchema: z.object({
      groupId: z.string(),
      date: z.string().optional().describe('ISO date (YYYY-MM-DD) untuk filter hari tertentu'),
    }),
    async handler(input: { groupId: string; date?: string }) {
      const params = new URLSearchParams({ groupId: input.groupId });
      if (input.date) params.set('date', input.date);
      const s: SummaryDTO = await api.get(`/summaries?${params}`);
      return [
        `## Summary — ${s.group.name}`,
        `Periode: ${s.mentionFrom.slice(0, 16)} → ${s.mentionTo.slice(0, 16)}`,
        `Dibuat: ${s.createdAt.slice(0, 16)}`,
        '',
        s.content,
      ].join('\n');
    },
  },

  {
    name: 'trigger_summarize',
    description:
      'Trigger AI summarization on-demand untuk sebuah group. Non-blocking — summary dibuat di background.',
    inputSchema: z.object({
      groupId: z.string(),
    }),
    async handler(input: { groupId: string }) {
      await api.post('/summaries', { groupId: input.groupId });
      return `Summarization dijadwalkan untuk group ${input.groupId}. Summary akan tersedia dalam beberapa menit.`;
    },
  },
];
