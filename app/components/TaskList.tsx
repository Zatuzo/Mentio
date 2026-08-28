'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  requester: string | null;
  createdAt: Date | string;
};

const STATUS_CONFIG = {
  todo: { label: 'To Do', icon: Circle, class: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock, class: 'text-blue-400' },
  done: { label: 'Done', icon: CheckCircle2, class: 'text-emerald-400' },
};

const NEXT_STATUS: Record<string, string> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

export function TaskList({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const getStatus = (task: Task) => localStatus[task.id] ?? task.status;

  async function cycleStatus(task: Task) {
    const current = getStatus(task);
    const next = NEXT_STATUS[current] || 'todo';
    setLocalStatus((p) => ({ ...p, [task.id]: next }));
    start(async () => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setLocalStatus((p) => ({ ...p, [task.id]: current }));
        toast.error('Failed to update task');
      } else if (next === 'done') {
        toast.success('Task marked as done!');
      }
      router.refresh();
    });
  }

  async function deleteTask(id: string) {
    start(async () => {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      toast.success('Task deleted');
      router.refresh();
    });
  }

  if (tasks.length === 0) return null;

  const activeTasks = tasks.filter((t) => getStatus(t) !== 'done');
  const doneTasks = tasks.filter((t) => getStatus(t) === 'done');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks</span>
        {activeTasks.length > 0 && (
          <Badge variant="secondary" className="text-xs h-4 px-1.5 bg-muted text-muted-foreground border-0">
            {activeTasks.length} open
          </Badge>
        )}
      </div>

      <ul className="space-y-1.5">
        {[...activeTasks, ...doneTasks].map((task) => {
          const status = getStatus(task);
          const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.todo;
          const Icon = cfg.icon;

          return (
            <li
              key={task.id}
              className={`group flex items-start gap-2.5 rounded-md p-2.5 border transition-colors ${
                status === 'done'
                  ? 'border-border/50 opacity-50'
                  : 'border-border hover:border-border'
              }`}
            >
              <button
                onClick={() => cycleStatus(task)}
                disabled={pending}
                className={`mt-0.5 shrink-0 ${cfg.class} hover:scale-110 transition-transform`}
                title={`Mark as ${NEXT_STATUS[status]}`}
              >
                <Icon className="h-4 w-4" />
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm ${status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                )}
                {task.requester && (
                  <p className="text-xs text-muted-foreground mt-0.5">from {task.requester}</p>
                )}
              </div>

              <button
                onClick={() => deleteTask(task.id)}
                disabled={pending}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity mt-0.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
