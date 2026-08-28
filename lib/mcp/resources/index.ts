import { api } from '../client';
import type {
  GroupDTO,
  MentionDTO,
  SummaryDTO,
  TaskDTO,
  ListenerStatus,
} from '../types';

export type McpResource = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  fetch: () => Promise<string>;
};

export const resources: McpResource[] = [
  {
    uri: 'mentio://groups',
    name: 'Groups',
    description: 'Semua WhatsApp group yang di-watch',
    mimeType: 'application/json',
    async fetch() {
      const groups: GroupDTO[] = await api.get('/groups');
      return JSON.stringify(groups, null, 2);
    },
  },
  {
    uri: 'mentio://status',
    name: 'Listener Status',
    description: 'Status koneksi WhatsApp listener',
    mimeType: 'application/json',
    async fetch() {
      const status: ListenerStatus = await api.get('/status');
      return JSON.stringify(status, null, 2);
    },
  },
];

export function mentionResource(groupId: string): McpResource {
  return {
    uri: `mentio://groups/${groupId}/mentions`,
    name: `Mentions — ${groupId}`,
    description: '20 mention terbaru dari group ini',
    mimeType: 'application/json',
    async fetch() {
      const mentions: MentionDTO[] = await api.get(`/mentions?groupId=${groupId}&limit=20`);
      return JSON.stringify(mentions, null, 2);
    },
  };
}

export function summaryResource(groupId: string): McpResource {
  return {
    uri: `mentio://groups/${groupId}/summary`,
    name: `Summary — ${groupId}`,
    description: 'Summary terakhir dari group ini',
    mimeType: 'text/markdown',
    async fetch() {
      try {
        const s: SummaryDTO = await api.get(`/summaries?groupId=${groupId}`);
        return `# Summary — ${s.group.name}\n\nPeriode: ${s.mentionFrom.slice(0, 16)} → ${s.mentionTo.slice(0, 16)}\n\n${s.content}`;
      } catch {
        return 'Belum ada summary untuk group ini.';
      }
    },
  };
}

export function tasksResource(projectId: string): McpResource {
  return {
    uri: `mentio://projects/${projectId}/tasks`,
    name: `Tasks — ${projectId}`,
    description: 'Open tasks dari project ini',
    mimeType: 'application/json',
    async fetch() {
      const tasks: TaskDTO[] = await api.get(`/tasks?projectId=${projectId}&status=todo,in_progress`);
      return JSON.stringify(tasks, null, 2);
    },
  };
}
