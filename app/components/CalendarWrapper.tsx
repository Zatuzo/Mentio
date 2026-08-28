'use client';

import { useState } from 'react';
import { EventManager, type Event } from '@/components/ui/event-manager';
import { TaskDetailPanel } from './TaskDetailPanel';
import { CreateTaskModal } from './CreateTaskModal';
import type { BoardTask } from './KanbanTaskCard';
import type { ProjectStatus, ProjectMember } from './KanbanBoard';
import { toast } from 'sonner';

// ── Priority ↔ Color mappings ─────────────────────────────────────────────────
const PRIORITY_TO_COLOR: Record<string, string> = {
  urgent: 'red',
  high:   'orange',
  medium: 'blue',
  low:    'green',
  none:   'blue',
};

const STATUS_TO_CATEGORY: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
};

// ── Converters ────────────────────────────────────────────────────────────────
function taskToEvent(task: BoardTask): Event {
  // Multi-day task: startDate → dueDate
  if (task.startDate && task.dueDate) {
    return {
      id:          task.id,
      title:       task.title,
      description: task.description ?? undefined,
      startTime:   new Date(task.startDate),
      endTime:     new Date(task.dueDate),
      color:       PRIORITY_TO_COLOR[task.priority] ?? 'blue',
      category:    STATUS_TO_CATEGORY[task.status] ?? 'To Do',
      tags:        task.group ? [task.group.name] : [],
    };
  }

  // Single-day task: show at 09:00–10:00 so it appears in week view
  if (task.dueDate) {
    const s = new Date(task.dueDate); s.setHours(9, 0, 0, 0);
    const e = new Date(task.dueDate); e.setHours(10, 0, 0, 0);
    return {
      id:          task.id,
      title:       task.title,
      description: task.description ?? undefined,
      startTime:   s,
      endTime:     e,
      color:       PRIORITY_TO_COLOR[task.priority] ?? 'blue',
      category:    STATUS_TO_CATEGORY[task.status] ?? 'To Do',
      tags:        task.group ? [task.group.name] : [],
    };
  }

  // No date — use createdAt as fallback (won't appear on calendar meaningfully)
  const fallback = new Date(task.createdAt);
  return {
    id:          task.id,
    title:       task.title,
    description: task.description ?? undefined,
    startTime:   fallback,
    endTime:     new Date(fallback.getTime() + 3600_000),
    color:       PRIORITY_TO_COLOR[task.priority] ?? 'blue',
    category:    STATUS_TO_CATEGORY[task.status] ?? 'To Do',
    tags:        task.group ? [task.group.name] : [],
  };
}

interface Reminder {
  id: string;
  message: string;
  scheduledAt: string;
  groupId: string;
}

function reminderToEvent(r: Reminder): Event {
  const start = new Date(r.scheduledAt);
  const end   = new Date(start.getTime() + 3600_000);
  return {
    id:        `reminder_${r.id}`,
    title:     `🔔 ${r.message}`,
    startTime: start,
    endTime:   end,
    color:     'purple',
    category:  'Reminder',
    tags:      [],
  };
}

function eventToTask(event: Event, base?: BoardTask): Partial<BoardTask> {
  const startStr = event.startTime.toISOString();
  const endStr   = event.endTime.toISOString();
  const isSameDay =
    event.startTime.toDateString() === event.endTime.toDateString();

  return {
    title:       event.title,
    description: event.description ?? null,
    startDate:   isSameDay ? null : startStr,
    dueDate:     endStr,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
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

export function CalendarWrapper({ initialTasks, initialReminders, projectId, projectGroups, statuses = DEFAULT_STATUSES, members = [] }: Props) {
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [openTask, setOpenTask]     = useState<BoardTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);

  const events: Event[] = [
    ...tasks.map(taskToEvent),
    ...initialReminders.map(reminderToEvent),
  ];

  const handleEventClick = (event: Event) => {
    if (event.id.startsWith('reminder_')) return; // reminders are read-only
    const task = tasks.find(t => t.id === event.id);
    if (task) setOpenTask(task);
  };

  const handleUpdate = (id: string, patch: Partial<BoardTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    setCalendarKey(k => k + 1);
  };

  const handleDelete = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setCalendarKey(k => k + 1);
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleCreated = (task: BoardTask) => {
    setTasks(prev => [task, ...prev]);
    setCalendarKey(k => k + 1);
    setCreateOpen(false);
  };

  return (
    <>
      <EventManager
        key={calendarKey}
        events={events}
        categories={['To Do', 'In Progress', 'Done', 'Reminder']}
        availableTags={projectGroups.map(g => g.name)}
        defaultView="month"
        className="h-full"
        onEventClickOverride={handleEventClick}
        onNewEventClickOverride={() => setCreateOpen(true)}
      />

      {/* Task detail — reuses existing panel */}
      <TaskDetailPanel
        task={openTask}
        groups={projectGroups}
        statuses={statuses}
        members={members}
        onClose={() => setOpenTask(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* Create task — reuses existing modal */}
      <CreateTaskModal
        open={createOpen}
        defaultStatus={statuses[0]?.slug ?? 'todo'}
        projectId={projectId}
        groups={projectGroups}
        statuses={statuses}
        members={members}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
