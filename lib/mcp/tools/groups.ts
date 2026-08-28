import { z } from 'zod';
import { api } from '../client';
import type { GroupDTO, ListenerStatus } from '../types';

export const groupTools = [
  {
    name: 'list_groups',
    description: 'List semua WhatsApp group yang kamu watch di Mentio.',
    inputSchema: z.object({}),
    async handler() {
      const groups: GroupDTO[] = await api.get('/groups');
      if (groups.length === 0) return 'Belum ada group yang di-watch.';
      return groups
        .map((g) => `[${g.id}] ${g.name} — ${g.mentionCount} mention, ${g.taskCount} task`)
        .join('\n');
    },
  },

  {
    name: 'get_listener_status',
    description: 'Cek status koneksi WhatsApp listener (up/down) dan statistik mention hari ini.',
    inputSchema: z.object({}),
    async handler() {
      const s: ListenerStatus = await api.get('/status');
      const listenerLine = s.listener.connected
        ? `✓ Terhubung sebagai ${s.listener.myJid ?? '?'}`
        : `✗ Tidak terhubung (last seen: ${s.listener.lastSeen ?? 'tidak diketahui'})`;
      return [
        `Listener: ${listenerLine}`,
        `Mention hari ini: ${s.mentions.today}`,
        `Pending diproses: ${s.mentions.pending}`,
        `Server time: ${s.serverTime}`,
      ].join('\n');
    },
  },
];
