import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { ensureInbox } from '@/app/lib/brain';
import { NewNoteButton } from '@/app/components/brain/NewNoteButton';
import { NewSpaceDialog } from '@/app/components/brain/NewSpaceDialog';
import { BrainSearchBar } from '@/app/components/brain/BrainSearchBar';
import { BookOpen, Pin, CalendarDays, Network, Sparkles, MessageCircle, CheckSquare, Clock, AlertCircle, ListTodo } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Brain — Mentio',
  description: 'Your personal knowledge base and notes.',
};

function getNotePreview(content: string | null, sourceType: string | null): string {
  if (!content) return '';
  if (sourceType === 'wa_mention') {
    const match = content.match(/^>\s*(.+)/m);
    if (match) return match[1].replace(/[*`_\[\]]/g, '').trim().slice(0, 120);
  }
  return content
    .replace(/^>\s*/gm, '')
    .replace(/\*\*(From|Group|Date|To):\*\*[^\n]*/g, '')
    .replace(/[#*`_\[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 120);
}

export default async function BrainPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;
  await ensureInbox(userId);

  const [spaces, recentNotes, unreadDigests, assignedTasks] = await Promise.all([
    prisma.space.findMany({
      where: { userId, isArchived: false },
      include: { _count: { select: { notes: true } } },
      orderBy: [{ isInbox: 'desc' }, { order: 'asc' }],
    }),
    prisma.note.findMany({
      where: { userId },
      select: {
        id: true, title: true, content: true, isPinned: true,
        updatedAt: true, sourceType: true,
        space: { select: { id: true, name: true, icon: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),
    prisma.digest.count({ where: { userId, readAt: null } }),
    prisma.task.findMany({
      where: { assignedToId: userId, status: { not: 'done' } },
      select: { id: true, title: true, dueDate: true, priority: true, status: true, project: { select: { name: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 8,
    }),
  ]);

  const inbox = spaces.find((s) => s.isInbox);
  const totalNotes = spaces.reduce((acc, s) => acc + s._count.notes, 0);

  return (
    <div className="space-y-5">
      {/* Header card — full width */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-5">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Brain</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {totalNotes} {totalNotes === 1 ? 'note' : 'notes'} across {spaces.length} {spaces.length === 1 ? 'space' : 'spaces'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/brain/digest"
              className="relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white/[0.04] text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.07] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Digest
              {unreadDigests > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                  {unreadDigests}
                </span>
              )}
            </Link>
            <Link
              href="/brain/todo"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white/[0.04] text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.07] transition-colors"
            >
              <ListTodo className="w-3.5 h-3.5" />
              To Do
            </Link>
            <Link
              href="/brain/graph"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white/[0.04] text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.07] transition-colors"
            >
              <Network className="w-3.5 h-3.5" />
              Graph
            </Link>
            <NewSpaceDialog />
            {inbox && <NewNoteButton spaceId={inbox.id} />}
          </div>
        </div>
        <div className="mt-4">
          <BrainSearchBar />
        </div>
      </div>

      {/* Daily log quick access */}
      <Link
        href="/brain/daily"
        className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-200"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] shrink-0">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">Daily Log</p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </Link>

      {/* Assigned tasks */}
      {assignedTasks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3 pl-0.5 tracking-wide">Ditugaskan ke Saya</p>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {assignedTasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
              const isDueToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString();
              return (
                <Link
                  key={task.id}
                  href="/dashboard"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <CheckSquare className={`w-4 h-4 shrink-0 ${task.status === 'in_progress' ? 'text-blue-400' : 'text-muted-foreground/40'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{task.title}</p>
                    {task.project && (
                      <p className="text-xs text-muted-foreground/50 mt-0.5">{task.project.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.priority !== 'none' && task.priority !== 'low' && (
                      <span className={`text-[10px] font-medium ${task.priority === 'urgent' ? 'text-red-400' : task.priority === 'high' ? 'text-orange-400' : 'text-yellow-400'}`}>
                        {task.priority}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 text-[11px] tabular-nums ${isOverdue ? 'text-red-400' : isDueToday ? 'text-amber-400' : 'text-muted-foreground/50'}`}>
                        {isOverdue ? <AlertCircle className="w-3 h-3" /> : isDueToday ? <Clock className="w-3 h-3" /> : null}
                        {new Date(task.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Body — 2 column on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Spaces column */}
        <div className="lg:col-span-1">
          <p className="text-xs font-semibold text-muted-foreground mb-3 pl-0.5 tracking-wide">Spaces</p>
          <div className="grid grid-cols-2 gap-2">
            {spaces.map((space) => (
              <Link
                key={space.id}
                href={`/brain/spaces/${space.id}`}
                className={`group flex flex-col rounded-xl border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${
                  space.isInbox
                    ? 'border-white/15 bg-card hover:border-white/25'
                    : 'border-border bg-card hover:border-white/15'
                }`}
              >
                <div>
                  <p className="font-semibold text-sm leading-none truncate">{space.name}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {space._count.notes} {space._count.notes === 1 ? 'note' : 'notes'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent notes column */}
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold text-muted-foreground mb-3 pl-0.5 tracking-wide">Recently updated</p>
          {recentNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <BookOpen className="w-10 h-10 opacity-20" />
              <p className="text-sm">No notes yet. Create your first note to get started.</p>
              {inbox && <NewNoteButton spaceId={inbox.id} variant="outline" label="Create note" />}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {recentNotes.map((note) => {
                const preview = getNotePreview(note.content, note.sourceType);
                const isWaMention = note.sourceType === 'wa_mention';
                return (
                  <Link
                    key={note.id}
                    href={`/brain/notes/${note.id}`}
                    className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {note.isPinned && <Pin className="w-3 h-3 text-muted-foreground/60 shrink-0" />}
                        {isWaMention && <MessageCircle className="w-3 h-3 text-emerald-500/60 shrink-0" />}
                        <p className="font-medium text-sm leading-snug truncate">{note.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground/55 truncate mt-0.5">
                        {note.space.name}
                        {preview && <span className="ml-2 opacity-75">{preview}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pt-0.5">
                      {note.tags.length > 0 && (
                        <span className="text-[11px] text-muted-foreground/35 hidden sm:block">
                          {note.tags.slice(0, 2).map(t => `#${t.tag.name}`).join(' ')}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                        {new Date(note.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
