import { prisma } from '@/app/lib/db';
import { ensureInbox } from '@/app/lib/brain';

const APP_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? 'https://mentio.space';

export function taskShortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

export async function createTaskFromTelegram(userId: string, title: string) {
  return prisma.task.create({
    data: { title, userId, assignedToId: userId, status: 'todo', priority: 'none', source: 'telegram' },
    select: { id: true, title: true },
  });
}

export async function createNoteFromTelegram(userId: string, content: string) {
  const inbox = await ensureInbox(userId);
  return prisma.note.create({
    data: {
      title: content.slice(0, 80),
      content,
      userId,
      spaceId: inbox.id,
      sourceType: 'telegram',
    },
    select: { id: true, title: true },
  });
}

export async function getActiveTasks(userId: string) {
  return prisma.task.findMany({
    where: { assignedToId: userId, status: { not: 'done' } },
    select: { id: true, title: true, dueDate: true, priority: true, status: true },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 15,
  });
}

export async function getAllProjectTasks(userId: string) {
  const member = await prisma.projectMember.findFirst({
    where: { userId },
    select: { projectId: true },
    orderBy: { project: { createdAt: 'asc' } },
  });
  if (!member) return { projectName: null, tasks: [] };

  const [project, tasks] = await Promise.all([
    prisma.project.findUnique({ where: { id: member.projectId }, select: { name: true } }),
    prisma.task.findMany({
      where: { projectId: member.projectId, status: { not: 'done' } },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, assignedTo: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 30,
    }),
  ]);

  return { projectName: project?.name ?? null, tasks };
}

export async function markTaskDoneByShortId(userId: string, shortId: string) {
  const tasks = await prisma.task.findMany({
    where: { assignedToId: userId, status: { not: 'done' } },
    select: { id: true, title: true },
  });
  const match = tasks.find((t) => t.id.replace(/-/g, '').startsWith(shortId.toLowerCase()));
  if (!match) return null;
  return prisma.task.update({
    where: { id: match.id },
    data: { status: 'done', completedAt: new Date() },
    select: { id: true, title: true },
  });
}

export interface BriefingData {
  overdue: { id: string; title: string; dueDate: Date | null }[];
  dueToday: { id: string; title: string; dueDate: Date | null }[];
  upcoming: { id: string; title: string; dueDate: Date | null }[];
  unreadMentions: number;
  unreadDigests: number;
}

export async function getBriefingData(userId: string): Promise<BriefingData> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400_000);
  const in7days = new Date(todayStart.getTime() + 7 * 86400_000);

  const [tasks, unreadMentions, unreadDigests] = await Promise.all([
    prisma.task.findMany({
      where: { assignedToId: userId, status: { not: 'done' } },
      select: { id: true, title: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.mention.count({ where: { userId, processed: false } }),
    prisma.digest.count({ where: { userId, readAt: null } }),
  ]);

  return {
    overdue: tasks.filter((t) => t.dueDate && new Date(t.dueDate) < todayStart),
    dueToday: tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < todayEnd),
    upcoming: tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= todayEnd && new Date(t.dueDate) <= in7days),
    unreadMentions,
    unreadDigests,
  };
}

export function formatTodoList(tasks: { id: string; title: string; dueDate: Date | null; priority: string; status: string }[]): string {
  if (tasks.length === 0) return '✅ Tidak ada task aktif. Kerja bagus!';

  const now = new Date();
  const todayStr = now.toDateString();

  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const today = tasks.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === todayStr);
  const upcoming = tasks.filter((t) => t.dueDate && new Date(t.dueDate) > now && new Date(t.dueDate).toDateString() !== todayStr);
  const noDue = tasks.filter((t) => !t.dueDate);

  const fmt = (t: { id: string; title: string; dueDate: Date | null }) => {
    const short = `\`${taskShortId(t.id)}\``;
    const due = t.dueDate ? ` · ${new Date(t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : '';
    return `• ${t.title}${due} ${short}`;
  };

  const sections: string[] = [`📋 *Task Aktif (${tasks.length})*\n`];
  if (overdue.length) sections.push(`⚠️ *Overdue*\n${overdue.map(fmt).join('\n')}`);
  if (today.length) sections.push(`📌 *Hari Ini*\n${today.map(fmt).join('\n')}`);
  if (upcoming.length) sections.push(`📅 *Upcoming*\n${upcoming.map(fmt).join('\n')}`);
  if (noDue.length) sections.push(`📝 *Tanpa Deadline*\n${noDue.map(fmt).join('\n')}`);

  sections.push(`\nBalas /done <id> untuk tandai selesai\n[Lihat semua →](${APP_URL}/brain/todo)`);
  return sections.join('\n\n');
}

export function formatBriefing(data: BriefingData): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  const fmt = (t: { id: string; title: string }) => `• ${t.title} \`${taskShortId(t.id)}\``;

  const sections: string[] = [`📋 *Briefing Pagi — ${dateStr}*`];

  if (data.overdue.length) {
    sections.push(`\n⚠️ *Overdue (${data.overdue.length})*\n${data.overdue.map(fmt).join('\n')}`);
  }
  if (data.dueToday.length) {
    sections.push(`\n📌 *Due Hari Ini (${data.dueToday.length})*\n${data.dueToday.map(fmt).join('\n')}`);
  }
  if (data.upcoming.length) {
    sections.push(`\n📅 *Upcoming 7 Hari (${data.upcoming.length})*\n${data.upcoming.map(fmt).join('\n')}`);
  }
  if (data.overdue.length === 0 && data.dueToday.length === 0 && data.upcoming.length === 0) {
    sections.push('\n✅ Tidak ada task mendesak. Hari yang tenang!');
  }

  const extras: string[] = [];
  if (data.unreadMentions > 0) extras.push(`📬 ${data.unreadMentions} mention belum diproses`);
  if (data.unreadDigests > 0) extras.push(`✨ ${data.unreadDigests} digest belum dibaca`);
  if (extras.length) sections.push('\n' + extras.join('\n'));

  sections.push(`\n[Buka Brain](${APP_URL}/brain) · [Semua Task](${APP_URL}/brain/todo)`);
  return sections.join('\n');
}
