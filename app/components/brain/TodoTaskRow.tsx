'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Clock, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { TaskDetailPanel } from '@/app/components/TaskDetailPanel';
import type { BoardTask } from '@/app/components/KanbanTaskCard';

type TaskRowProps = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  requester?: string | null;
  createdAt?: string | null;
  startDate?: string | null;
  dueDate: string | null;
  source?: string | null;
  sourceNoteId: string | null;
  sourceNote: { id: string; title: string } | null;
  project: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string; image: string | null } | null;
  imageUrls?: string[];
  isOverdue: boolean;
  isDueToday: boolean;
};

const SOURCE_LABEL: Record<string, { label: string; className: string }> = {
  lms:      { label: 'LMS',      className: 'text-orange-400/70 bg-orange-400/10' },
  wa_dump:  { label: 'WA',       className: 'text-green-400/70 bg-green-400/10' },
  telegram: { label: 'Telegram', className: 'text-sky-400/70 bg-sky-400/10' },
  mention:  { label: 'Mention',  className: 'text-purple-400/70 bg-purple-400/10' },
  ai:       { label: 'AI',       className: 'text-violet-400/70 bg-violet-400/10' },
};

const DEFAULT_STATUSES = [
  { id: 'todo',        slug: 'todo',        label: 'To Do',       color: '#6b7280', order: 0, isDone: false },
  { id: 'in_progress', slug: 'in_progress', label: 'In Progress', color: '#3b82f6', order: 1, isDone: false },
  { id: 'done',        slug: 'done',        label: 'Done',        color: '#10b981', order: 2, isDone: true  },
];

export function TodoTaskRow({ id, title, description, status, priority, requester, createdAt, startDate, dueDate, source, sourceNoteId, sourceNote, project, assignedTo, imageUrls, isOverdue, isDueToday }: TaskRowProps) {
  const [isDone, setIsDone] = useState(status === 'done');
  const [currentStatus, setCurrentStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    const next = isDone ? 'todo' : 'done';
    setLoading(true);
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setIsDone(!isDone);
      setCurrentStatus(next);
      toast.success(next === 'done' ? 'Task selesai' : 'Task dibuka kembali');
    } else {
      toast.error('Gagal mengupdate task');
    }
    setLoading(false);
  };

  const boardTask: BoardTask = {
    id,
    title,
    description: description ?? null,
    status: currentStatus,
    priority,
    requester: requester ?? null,
    createdAt: createdAt ?? new Date().toISOString(),
    startDate: startDate ?? null,
    dueDate,
    group: null,
    assignedTo: assignedTo ?? null,
    imageUrls: imageUrls ?? [],
  };

  const handleUpdate = (_taskId: string, patch: Partial<BoardTask>) => {
    if (patch.status !== undefined) {
      setCurrentStatus(patch.status);
      setIsDone(patch.status === 'done');
    }
  };

  return (
    <>
      <div
        onClick={() => setPanelOpen(true)}
        className={`flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer ${isDone ? 'opacity-50' : ''}`}
      >
        {/* Circle checkbox */}
        <button
          onClick={toggle}
          title={isDone ? 'Buka kembali' : 'Tandai selesai'}
          className={`flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-all duration-150
            ${isDone
              ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600'
              : loading
              ? 'border-muted-foreground/30 text-muted-foreground/50'
              : 'border-muted-foreground/20 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-transparent hover:text-emerald-500/60'
            }`}
        >
          {loading
            ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
            : <Check className="w-2.5 h-2.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm truncate transition-all ${isDone ? 'line-through text-muted-foreground' : ''}`}>
            {title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {source && SOURCE_LABEL[source] && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${SOURCE_LABEL[source].className}`}>
                {SOURCE_LABEL[source].label}
              </span>
            )}
            {project && (
              <span className="text-[11px] text-muted-foreground/50">{project.name}</span>
            )}
            {sourceNoteId && sourceNote && (
              <Link
                href={`/brain/notes/${sourceNoteId}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <FileText className="w-2.5 h-2.5" />
                {sourceNote.title.slice(0, 30)}
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isDone && priority !== 'none' && priority !== 'low' && (
            <span className={`text-[10px] font-medium uppercase ${priority === 'urgent' ? 'text-red-400' : priority === 'high' ? 'text-orange-400' : 'text-yellow-400'}`}>
              {priority}
            </span>
          )}
          {dueDate && !isDone && (
            <span className={`flex items-center gap-1 text-[11px] tabular-nums ${isOverdue ? 'text-red-400' : isDueToday ? 'text-amber-400' : 'text-muted-foreground/50'}`}>
              {isOverdue ? <AlertCircle className="w-3 h-3" /> : isDueToday ? <Clock className="w-3 h-3" /> : null}
              {new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>

      <TaskDetailPanel
        task={panelOpen ? boardTask : null}
        groups={[]}
        statuses={DEFAULT_STATUSES}
        members={[]}
        onClose={() => setPanelOpen(false)}
        onUpdate={handleUpdate}
        onDelete={() => setPanelOpen(false)}
        onGeneratePrompt={() => {}}
      />
    </>
  );
}
