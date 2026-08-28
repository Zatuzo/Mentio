'use client';

import { useState } from 'react';
import { Circle, CheckCircle2, Dot, Trash2, ChevronDown, ChevronRight, AlertCircle, ArrowUp, ArrowRight, ArrowDown, Minus, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type BoardTask, PRIORITY_CONFIG } from './KanbanTaskCard';
import { type ProjectStatus } from './KanbanBoard';

const PRIORITY_ICON_MAP: Record<string, { icon: LucideIcon; className: string }> = {
  urgent: { icon: AlertCircle, className: 'text-destructive' },
  high:   { icon: ArrowUp,     className: 'text-orange-400' },
  medium: { icon: ArrowRight,  className: 'text-yellow-400' },
  low:    { icon: ArrowDown,   className: 'text-blue-400' },
  none:   { icon: Minus,       className: 'text-muted-foreground/30' },
};

interface Props {
  tasks: BoardTask[];
  statuses: ProjectStatus[];
  onOpen: (task: BoardTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}

function TaskRow({
  task,
  statuses,
  onOpen,
  onDelete,
  onStatusChange,
}: {
  task: BoardTask;
  statuses: ProjectStatus[];
  onOpen: (t: BoardTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const currentIdx = statuses.findIndex((s) => s.slug === task.status);
  const currentStatus = statuses[currentIdx];
  const nextStatus = statuses[(currentIdx + 1) % statuses.length];
  const isDone = currentStatus?.isDone ?? false;
  const priorityCfg = PRIORITY_CONFIG[task.priority ?? 'none'] ?? PRIORITY_CONFIG.none;

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && !isDone;

  const { icon: PriorityIcon, className: priorityIconClass } = PRIORITY_ICON_MAP[task.priority ?? 'none'] ?? PRIORITY_ICON_MAP.none;
  const StatusIcon = isDone ? CheckCircle2 : currentIdx === 0 ? Circle : Dot;

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer ${isDone ? 'opacity-50' : ''}`}
      onClick={() => onOpen(task)}
    >
      {/* Priority icon */}
      <PriorityIcon className={`h-3.5 w-3.5 shrink-0 ${priorityIconClass}`} aria-label={priorityCfg.label} />

      {/* Status icon — click to advance to next status */}
      <button
        className="shrink-0 hover:scale-110 transition-transform"
        style={{ color: currentStatus?.color ?? '#6b7280' }}
        title={`Move to ${nextStatus?.label ?? ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (nextStatus) onStatusChange(task.id, nextStatus.slug);
        }}
      >
        <StatusIcon className="h-4 w-4" />
      </button>

      {/* Title */}
      <span className={`flex-1 text-sm min-w-0 truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {task.title}
      </span>

      {/* Group badge */}
      {task.group && (
        <Badge variant="outline" className="text-xs h-5 px-1.5 bg-muted/50 border-border font-normal hidden sm:flex shrink-0">
          {task.group.name}
        </Badge>
      )}

      {/* Requester */}
      {task.requester && (
        <span className="text-xs text-muted-foreground hidden md:block shrink-0 max-w-[100px] truncate">
          {task.requester}
        </span>
      )}

      {/* Due date */}
      <span className={`text-xs shrink-0 hidden sm:block ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
        {dueDate ? dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
      </span>

      {/* Created date */}
      <span className="text-xs text-muted-foreground shrink-0 hidden lg:block">
        {new Date(task.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function StatusSection({
  status,
  tasks,
  statuses,
  onOpen,
  onDelete,
  onStatusChange,
}: {
  status: ProjectStatus;
  tasks: BoardTask[];
  statuses: ProjectStatus[];
  onOpen: (t: BoardTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(status.isDone);
  const Icon = status.isDone ? CheckCircle2 : status.order === 0 ? Circle : Dot;

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-card/50 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: status.color }} />
        <span className="text-xs font-semibold tracking-wide" style={{ color: status.color }}>
          {status.label}
        </span>
        <span className="text-xs text-muted-foreground ml-1">{tasks.length}</span>
      </button>

      {!collapsed && tasks.length > 0 && (
        <div>
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/40 bg-muted/10">
            <span className="w-4 shrink-0" />
            <span className="flex-1 text-xs text-muted-foreground">Title</span>
            <span className="text-xs text-muted-foreground hidden sm:block w-[80px] shrink-0">Group</span>
            <span className="text-xs text-muted-foreground hidden md:block w-[100px] shrink-0">From</span>
            <span className="text-xs text-muted-foreground hidden sm:block w-[60px] shrink-0">Due</span>
            <span className="text-xs text-muted-foreground hidden lg:block w-[60px] shrink-0">Created</span>
            <span className="w-[52px] shrink-0" />
          </div>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              statuses={statuses}
              onOpen={onOpen}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}

      {!collapsed && tasks.length === 0 && (
        <div className="px-3 py-4 text-xs text-muted-foreground text-center">
          No tasks
        </div>
      )}
    </div>
  );
}

export function TaskListView({ tasks, statuses, onOpen, onDelete, onStatusChange }: Props) {
  return (
    <div className="space-y-3">
      {statuses.map((status) => {
        const colTasks = tasks.filter((t) => t.status === status.slug);
        return (
          <StatusSection
            key={status.slug}
            status={status}
            tasks={colTasks}
            statuses={statuses}
            onOpen={onOpen}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
          />
        );
      })}
    </div>
  );
}
