import { z } from 'zod';
import { api } from '../client';
import type { MemberDTO } from '../types';

export const memberTools = [
  {
    name: 'list_members',
    description: 'List semua anggota (member) dalam sebuah project, lengkap dengan ID-nya. Gunakan ID ini sebagai assignedToId saat membuat atau mengupdate task.',
    inputSchema: z.object({
      projectId: z.string().describe('ID project (dari list_projects)'),
    }),
    async handler(input: { projectId: string }) {
      const members: MemberDTO[] = await api.get(`/members?projectId=${encodeURIComponent(input.projectId)}`);
      if (members.length === 0) return 'Tidak ada anggota dalam project ini.';
      return members
        .map((m) => `[${m.id}] ${m.name} (${m.role})`)
        .join('\n');
    },
  },
];
