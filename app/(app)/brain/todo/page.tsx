import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { CheckSquare, Plus } from 'lucide-react';
import { TodoTaskRow } from '@/app/components/brain/TodoTaskRow';
import { DumpToTasksButton } from '@/app/components/brain/DumpToTasksButton';

export const dynamic = 'force-dynamic';

export default async function BrainTodoPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tasks: any[] = [];
  try {
    tasks = await prisma.task.findMany({
      where: { assignedToId: userId },
      include: {
        project: { select: { id: true, name: true } },
        sourceNote: { select: { id: true, title: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    });
  } catch {
    // Schema migration pending — show empty state until DB is updated
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

  const active = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  const sortActive = (list: any[]) => [...list].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 4;
    const pb = PRIORITY_ORDER[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const sorted = [
    ...sortActive(active),
    ...done.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">To Do</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {active.length} aktif{done.length > 0 ? ` · ${done.length} selesai` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DumpToTasksButton />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white/[0.04] text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.07] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah task
          </Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
          <CheckSquare className="w-10 h-10 opacity-20" />
          <p className="text-sm">Tidak ada task.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {sorted.map((task, i) => {
            const isOverdue = !!(task.dueDate && new Date(task.dueDate) < today);
            const isDueToday = !!(task.dueDate && new Date(task.dueDate).toDateString() === today.toDateString());
            const isFirstDone = task.status === 'done' && (i === 0 || sorted[i - 1].status !== 'done');
            return (
              <div key={task.id}>
                {isFirstDone && active.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/20">
                    <span className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wide">Selesai</span>
                  </div>
                )}
                <TodoTaskRow
                  id={task.id}
                  title={task.title}
                  description={task.description ?? null}
                  status={task.status}
                  priority={task.priority}
                  requester={task.requester ?? null}
                  createdAt={task.createdAt ? task.createdAt.toISOString() : null}
                  startDate={task.startDate ? task.startDate.toISOString() : null}
                  dueDate={task.dueDate ? task.dueDate.toISOString() : null}
                  source={task.source ?? null}
                  sourceNoteId={task.sourceNoteId ?? null}
                  sourceNote={task.sourceNote ?? null}
                  project={task.project ?? null}
                  assignedTo={task.assignedTo ?? null}
                  isOverdue={isOverdue}
                  isDueToday={isDueToday}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
