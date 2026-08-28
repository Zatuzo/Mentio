import { z } from 'zod';
import { api } from '../client';
import type { TaskDTO, TaskDetailDTO } from '../types';

export const taskTools = [
  {
    name: 'list_tasks',
    description: 'List task milik kamu. Default hanya menampilkan todo dan in_progress (exclude done). Untuk lihat semua termasuk done, pass status="all". Untuk lihat hanya yang done, pass status="done". Diurutkan: todo → in_progress → done, lalu terbaru dulu.',
    inputSchema: z.object({
      projectId: z.string().optional(),
      groupId: z.string().optional(),
      status: z
        .string()
        .optional()
        .describe('Filter status: "todo", "in_progress", "done", comma-separated seperti "todo,in_progress", atau "all" untuk semua termasuk done. Default: todo+in_progress saja.'),
      limit: z.number().int().min(1).max(200).default(50).optional(),
    }),
    async handler(input: {
      projectId?: string;
      groupId?: string;
      status?: string;
      limit?: number;
    }) {
      const params = new URLSearchParams();
      if (input.projectId) params.set('projectId', input.projectId);
      if (input.groupId) params.set('groupId', input.groupId);
      if (input.status) params.set('status', input.status);
      if (input.limit) params.set('limit', String(input.limit));
      const qs = params.toString();
      const tasks: TaskDTO[] = await api.get(`/tasks${qs ? `?${qs}` : ''}`);
      if (tasks.length === 0) return 'Tidak ada task ditemukan.';

      const byProject = new Map<string, TaskDTO[]>();
      for (const t of tasks) {
        const key = t.project ? `${t.project.name} (${t.project.id})` : 'Tanpa project';
        if (!byProject.has(key)) byProject.set(key, []);
        byProject.get(key)!.push(t);
      }

      const lines: string[] = [];
      for (const [proj, projTasks] of byProject) {
        lines.push(`\n### ${proj}`);
        for (const t of projTasks) {
          const badge = statusBadge(t.status);
          const due = t.dueDate ? ` | due: ${t.dueDate.slice(0, 10)}` : '';
          lines.push(`${badge} [${t.id}] ${t.title}${due}`);
          if (t.assignedTo) lines.push(`   → assignee: ${t.assignedTo.name}`);
        }
      }
      return lines.join('\n');
    },
  },

  {
    name: 'get_task',
    description: 'Ambil detail lengkap satu task termasuk mention aslinya.',
    inputSchema: z.object({
      taskId: z.string(),
    }),
    async handler(input: { taskId: string }) {
      const t: TaskDetailDTO = await api.get(`/tasks/${input.taskId}`);
      const lines = [
        `## ${t.title}`,
        `ID: ${t.id}`,
        `Status: ${t.status} | Priority: ${t.priority}`,
        `Project: ${t.project?.name ?? '-'}`,
        `Group: ${t.group?.name ?? '-'}`,
        `Assignee: ${t.assignedTo?.name ?? '-'}`,
        `Requester: ${t.requester ?? '-'}`,
        t.dueDate ? `Due: ${t.dueDate.slice(0, 10)}` : '',
        t.description ? `\n${t.description}` : '',
      ];
      if (t.imageUrls?.length) {
        lines.push(`\n### Images (${t.imageUrls.length})`);
        t.imageUrls.forEach((url, i) => lines.push(`${i + 1}. ${url}`));
      }
      if (t.mention) {
        lines.push(
          `\n### Mention asli (${t.mention.timestamp})`,
          `Dari: ${t.mention.senderName ?? '?'}`,
          `<mention>${t.mention.text}</mention>`
        );
      }
      return lines.filter(Boolean).join('\n');
    },
  },

  {
    name: 'update_task_status',
    description: 'Update status, priority, atau assignee task. Gunakan list_members untuk mendapatkan assignedToId.',
    inputSchema: z.object({
      taskId: z.string(),
      status: z
        .enum(['todo', 'in_progress', 'done'])
        .optional()
        .describe('Status baru'),
      priority: z
        .enum(['urgent', 'high', 'medium', 'low', 'none'])
        .optional()
        .describe('Priority baru'),
      assignedToId: z
        .string()
        .optional()
        .describe('ID user yang ditugaskan (dari list_members). Kirim string kosong "" untuk unassign.'),
    }),
    async handler(input: { taskId: string; status?: string; priority?: string; assignedToId?: string }) {
      const { taskId, ...body } = input;
      const t: TaskDTO = await api.patch(`/tasks/${taskId}`, body);
      const assignee = t.assignedTo ? ` | assignee: ${t.assignedTo.name}` : '';
      return `Task [${t.id}] "${t.title}" → status: ${t.status}, priority: ${t.priority}${assignee}`;
    },
  },
];

function statusBadge(status: string) {
  switch (status) {
    case 'todo': return '○';
    case 'in_progress': return '◐';
    case 'done': return '●';
    default: return '?';
  }
}
