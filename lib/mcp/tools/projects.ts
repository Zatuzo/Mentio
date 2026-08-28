import { z } from 'zod';
import { api } from '../client';
import type { ProjectDTO } from '../types';

export const projectTools = [
  {
    name: 'list_projects',
    description: 'List semua project Mentio yang kamu ikuti, lengkap dengan statistik task.',
    inputSchema: z.object({}),
    async handler() {
      const projects: ProjectDTO[] = await api.get('/projects');
      if (projects.length === 0) return 'Belum ada project.';
      return projects
        .map((p) => {
          const groups = p.groups.map((g) => g.name).join(', ') || '-';
          return [
            `[${p.id}] ${p.name} (${p.role})`,
            `  Stack: ${p.techStack ?? '-'}`,
            `  Tasks: ${p.openTasks} open / ${p.totalTasks} total`,
            `  Groups: ${groups}`,
          ].join('\n');
        })
        .join('\n\n');
    },
  },
];
