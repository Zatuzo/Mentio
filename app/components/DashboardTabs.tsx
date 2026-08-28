'use client';

import { useState } from 'react';
import { LayoutGrid, ListTodo, CheckSquare, FileText } from 'lucide-react';
import { KanbanBoard, type ProjectStatus, type ProjectMember } from './KanbanBoard';
import { TodoTaskRow } from './brain/TodoTaskRow';
import { type BoardTask } from './KanbanTaskCard';
import { ProjectBrief } from './ProjectBrief';

type TodoTask = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  requester?: string | null;
  createdAt?: string | null;
  startDate?: string | null;
  dueDate: string | null;
  completedAt: string | null;
  source?: string | null;
  sourceNoteId: string | null;
  sourceNote: { id: string; title: string } | null;
  project: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string; image: string | null } | null;
  imageUrls?: string[];
};

type Props = {
  projectTasks: BoardTask[];
  todoTasks: TodoTask[];
  projectId: string;
  projectName?: string;
  projectGroups: { id: string; name: string }[];
  statuses: ProjectStatus[];
  members: ProjectMember[];
  currentUserId: string;
  initialBrief: string | null;
  briefUpdatedAt: string | null;
  briefUpdaterName: string | null;
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export function DashboardTabs({ projectTasks, todoTasks, projectId, projectName, projectGroups, statuses, members, currentUserId, initialBrief, briefUpdatedAt, briefUpdaterName }: Props) {
  const [tab, setTab] = useState<'project' | 'todo' | 'brief'>('project');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const active = todoTasks.filter((t) => t.status !== 'done');
  const done = todoTasks.filter((t) => t.status === 'done');

  const sorted = [
    ...[...active].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 4;
      const pb = PRIORITY_ORDER[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    }),
    ...[...done].sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()),
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setTab('project')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'project'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Project
        </button>
        <button
          onClick={() => setTab('todo')}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'todo'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          To Do
          {active.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === 'todo' ? 'bg-foreground/10 text-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {active.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('brief')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'brief'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Brief
        </button>
      </div>

      {/* Project tab */}
      {tab === 'project' && (
        <KanbanBoard
          initialTasks={projectTasks}
          projectId={projectId}
          projectName={projectName}
          projectGroups={projectGroups}
          statuses={statuses}
          members={members}
          currentUserId={currentUserId}
        />
      )}

      {/* Brief tab */}
      {tab === 'brief' && (
        <ProjectBrief
          projectId={projectId}
          initialBrief={initialBrief}
          briefUpdatedAt={briefUpdatedAt}
          briefUpdaterName={briefUpdaterName}
        />
      )}

      {/* Todo tab */}
      {tab === 'todo' && (
        <div>
          <p className="text-muted-foreground text-sm mb-3">
            {active.length} aktif{done.length > 0 ? ` · ${done.length} selesai` : ''}
          </p>
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
                      description={task.description}
                      status={task.status}
                      priority={task.priority}
                      requester={task.requester}
                      createdAt={task.createdAt}
                      startDate={task.startDate}
                      dueDate={task.dueDate}
                      source={task.source}
                      sourceNoteId={task.sourceNoteId}
                      sourceNote={task.sourceNote}
                      project={task.project}
                      assignedTo={task.assignedTo}
                      imageUrls={task.imageUrls}
                      isOverdue={isOverdue}
                      isDueToday={isDueToday}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
