'use client';

import { useState, useMemo } from 'react';
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
  isSameDay, isSameMonth, isToday,
  isWithinInterval, parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskDetailPanel } from './TaskDetailPanel';
import { CreateTaskModal } from './CreateTaskModal';
import { PRIORITY_CONFIG, type BoardTask } from './KanbanTaskCard';
import type { ProjectStatus, ProjectMember } from './KanbanBoard';
import { toast } from 'sonner';

const STATUS_BG: Record<string, string> = {
  done:        'opacity-50 line-through',
  in_progress: 'opacity-90',
  todo:        'opacity-100',
};

const PRIORITY_BAR: Record<string, string> = {
  urgent: 'bg-red-500/80',
  high:   'bg-orange-400/80',
  medium: 'bg-yellow-400/80',
  low:    'bg-blue-400/80',
  none:   'bg-muted-foreground/30',
};

interface Reminder {
  id: string;
  message: string;
  scheduledAt: string;
  groupId: string;
}

const DEFAULT_STATUSES: ProjectStatus[] = [
  { id: 'todo', slug: 'todo', label: 'To Do', color: '#6b7280', order: 0, isDone: false },
  { id: 'in_progress', slug: 'in_progress', label: 'In Progress', color: '#3b82f6', order: 1, isDone: false },
  { id: 'done', slug: 'done', label: 'Done', color: '#10b981', order: 2, isDone: true },
];

interface Props {
  initialTasks: BoardTask[];
  initialReminders: Reminder[];
  projectId: string;
  projectGroups: { id: string; name: string }[];
  statuses?: ProjectStatus[];
  members?: ProjectMember[];
}

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  return typeof d === 'string' ? parseISO(d) : d;
}

function getTasksForDay(tasks: BoardTask[], day: Date): BoardTask[] {
  return tasks.filter(task => {
    const due   = toDate(task.dueDate);
    const start = toDate(task.startDate);

    if (due && isSameDay(due, day)) return true;
    if (start && due && !isSameDay(start, due)) {
      return isWithinInterval(day, { start, end: due });
    }
    if (start && !due && isSameDay(start, day)) return true;
    return false;
  });
}

function isMultiDayStart(task: BoardTask, day: Date): boolean {
  const start = toDate(task.startDate);
  const due   = toDate(task.dueDate);
  return !!(start && due && !isSameDay(start, due) && isSameDay(start, day));
}

function isMultiDayEnd(task: BoardTask, day: Date): boolean {
  const start = toDate(task.startDate);
  const due   = toDate(task.dueDate);
  return !!(start && due && !isSameDay(start, due) && isSameDay(due, day));
}

export function CalendarView({ initialTasks, initialReminders, projectId, projectGroups, statuses = DEFAULT_STATUSES, members = [] }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const reminders = initialReminders;
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);
  const [createDate, setCreateDate] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(currentDate),     { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const handleUpdate = (id: string, patch: Partial<BoardTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const handleDelete = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleCreated = (task: BoardTask) => {
    setTasks(prev => [task, ...prev]);
    setCreateDate(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => setCurrentDate(d => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold w-36 text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => setCurrentDate(d => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="text-xs h-7"
          onClick={() => setCurrentDate(new Date())}>
          Today
        </Button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t border-border flex-1 min-h-0">
        {days.map(day => {
          const dayTasks     = getTasksForDay(tasks, day);
          const dayReminders = reminders.filter(r => isSameDay(parseISO(r.scheduledAt), day));
          const inMonth      = isSameMonth(day, currentDate);
          const todayFlag    = isToday(day);
          const allItems     = dayTasks.length + dayReminders.length;
          const visibleTasks = dayTasks.slice(0, Math.min(3, 3 - Math.min(dayReminders.length, 1)));
          const visibleReminders = dayReminders.slice(0, 1);
          const overflow     = allItems - visibleTasks.length - visibleReminders.length;

          return (
            <div
              key={day.toISOString()}
              className={`border-r border-b border-border p-1 min-h-[96px] flex flex-col group cursor-pointer hover:bg-muted/10 transition-colors ${
                !inMonth ? 'bg-muted/5' : ''
              }`}
              onClick={() => setCreateDate(day)}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                  todayFlag
                    ? 'bg-primary text-primary-foreground'
                    : inMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground/40'
                }`}>
                  {format(day, 'd')}
                </span>
                <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>

              {/* Task chips + reminder chips */}
              <div className="flex flex-col gap-0.5 flex-1">
                {visibleReminders.map(reminder => (
                  <div key={reminder.id}
                    className="w-full text-[10px] leading-tight px-1.5 py-0.5 rounded-sm flex items-center gap-1 bg-violet-500/20 border border-violet-500/30 text-violet-300">
                    <span className="text-[9px]">🔔</span>
                    <span className="truncate">{reminder.message}</span>
                  </div>
                ))}
                {visibleTasks.map(task => {
                  const isStart = isMultiDayStart(task, day);
                  const isEnd   = isMultiDayEnd(task, day);
                  const isMiddle = !isStart && !isEnd && !!toDate(task.startDate) && !!toDate(task.dueDate);
                  const barColor = PRIORITY_BAR[task.priority] ?? PRIORITY_BAR.none;

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={e => { e.stopPropagation(); setOpenTask(task); }}
                      className={`w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded-sm flex items-center gap-1 hover:brightness-110 transition-all ${
                        STATUS_BG[task.status] ?? ''
                      } ${
                        isMiddle
                          ? 'bg-muted/40 rounded-none'
                          : isStart
                            ? `${barColor} text-white rounded-r-none`
                            : isEnd
                              ? `${barColor} text-white rounded-l-none`
                              : 'bg-card border border-border'
                      }`}
                    >
                      {!isMiddle && !isStart && !isEnd && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_CONFIG[task.priority]?.dot ?? ''}`} />
                      )}
                      <span className={`truncate ${isStart || isEnd ? 'font-medium' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                    </button>
                  );
                })}

                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail panel */}
      <TaskDetailPanel
        task={openTask}
        groups={projectGroups}
        statuses={statuses}
        members={members}
        onClose={() => setOpenTask(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onGeneratePrompt={() => {}}
      />

      {/* Create task modal — pre-fill dueDate with clicked day */}
      <CreateTaskModal
        open={!!createDate}
        defaultStatus={statuses[0]?.slug ?? 'todo'}
        defaultDueDate={createDate ? format(createDate, 'yyyy-MM-dd') : ''}
        projectId={projectId}
        groups={projectGroups}
        statuses={statuses}
        members={members}
        onClose={() => setCreateDate(null)}
        onCreated={handleCreated}
      />
    </div>
  );
}
