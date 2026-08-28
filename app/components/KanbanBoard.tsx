'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { KanbanTaskCard, type BoardTask } from './KanbanTaskCard';
import { TaskDetailPanel } from './TaskDetailPanel';
import { CreateTaskModal } from './CreateTaskModal';
import { BulkAssignModal } from './BulkAssignModal';
import { TaskListView } from './TaskListView';
import { toast } from 'sonner';
import { Plus, List, LayoutGrid, Users, UserRound, SquareKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterChip } from '@/components/ui/filter-chip';
import { EmptyState } from './EmptyState';
import { ExportTasksButton } from './ExportTasksButton';

export type ProjectStatus = {
  id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
  isDone: boolean;
};

export type ProjectMember = {
  id: string;
  name: string;
  image: string | null;
};

interface Props {
  initialTasks: BoardTask[];
  projectId: string;
  projectName?: string;
  projectGroups: { id: string; name: string }[];
  statuses: ProjectStatus[];
  members: ProjectMember[];
  currentUserId?: string;
}

type ViewMode = 'board' | 'list';
type DateFilter = 'all' | 'overdue' | 'today' | 'week' | 'none';

function applyDateFilter(tasks: BoardTask[], df: DateFilter): BoardTask[] {
  if (df === 'all') return tasks;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const startOfNextWeek = new Date(startOfToday.getTime() + 7 * 86400000);

  return tasks.filter((t) => {
    if (df === 'none') return !t.dueDate;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    if (df === 'overdue') return due < startOfToday && t.status !== 'done';
    if (df === 'today') return due >= startOfToday && due < startOfTomorrow;
    if (df === 'week') return due >= startOfToday && due < startOfNextWeek;
    return true;
  });
}

export function KanbanBoard({ initialTasks, projectId, projectName, projectGroups, statuses, members, currentUserId }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('board');

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  const groups = Array.from(
    new Map(
      tasks.filter((t) => t.group).map((t) => [t.group!.id, t.group!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const overdueCount = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done') return false;
    return new Date(t.dueDate) < new Date(new Date().setHours(0,0,0,0));
  }).length;

  const groupFiltered = filterGroupId ? tasks.filter((t) => t.group?.id === filterGroupId) : tasks;
  const mineFiltered = onlyMine && currentUserId ? groupFiltered.filter((t) => t.assignedTo?.id === currentUserId) : groupFiltered;
  const visibleTasks = applyDateFilter(mineFiltered, dateFilter);

  const handleUpdate = (id: string, patch: Partial<BoardTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const handleCreated = (task: BoardTask) => {
    setTasks((prev) => [task, ...prev]);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      if (newStatus === 'done') toast.success('Task marked as done!');
    } catch {
      toast.error('Failed to update task');
      setTasks(previousTasks);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    // Auto-switch to list view on mobile
    if (window.innerWidth < 768) setView('list');
    // Note: tasks state is initialized once via useState(initialTasks).
    // We intentionally do NOT re-sync here on prop changes — doing so would
    // reset the user's drag order every time router.refresh() fires elsewhere
    // on the page. Creates/deletes/drags are handled via local state mutations.
  }, []);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const draggedTask = tasks.find((t) => t.id === draggableId);
    if (!draggedTask) return;

    const newStatus = destination.droppableId;
    const prevTasks = tasks;

    // 1. Remove dragged task from array
    const remaining = tasks.filter((t) => t.id !== draggableId);
    const movedTask = { ...draggedTask, status: newStatus };

    // 2. Find insert position based on destination.index among VISIBLE tasks in dest column
    //    (visibleTasks reflects active date/group filters — same as what DnD rendered)
    const destColVisible = visibleTasks.filter((t) => t.status === newStatus && t.id !== draggableId);

    let insertIdx: number;
    if (destination.index >= destColVisible.length) {
      // Drop at end of column — insert after last visible task in that column
      const lastTask = destColVisible[destColVisible.length - 1];
      insertIdx = lastTask
        ? remaining.findIndex((t) => t.id === lastTask.id) + 1
        : remaining.length;
    } else {
      // Drop before the task currently at destination.index
      const taskAtDest = destColVisible[destination.index];
      const found = remaining.findIndex((t) => t.id === taskAtDest.id);
      insertIdx = found === -1 ? remaining.length : found;
    }

    const newTasks = [...remaining];
    newTasks.splice(insertIdx, 0, movedTask);
    setTasks(newTasks);

    // 3. Persist to API only if status changed (reorder within column is session-only)
    if (newStatus !== source.droppableId) {
      const isDone = statuses.find((s) => s.slug === newStatus)?.isDone ?? false;
      void (async () => {
        try {
          const res = await fetch(`/api/tasks/${draggableId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          });
          if (!res.ok) throw new Error();
          if (isDone) toast.success('Task marked as done!');
        } catch {
          toast.error('Failed to update task');
          setTasks(prevTasks);
        }
      })();
    }
  };

  const handleDelete = async (id: string) => {
    const previousTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
      setTasks(previousTasks);
    }
  };

  if (!isMounted) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="flex gap-2 mb-4">
          <div className="h-7 w-20 bg-muted rounded-md" />
          <div className="h-7 w-20 bg-muted rounded-md" />
        </div>
        <div className={`flex gap-4 overflow-x-auto pb-2 ${statuses.length <= 3 ? '' : 'pr-8'}`}>
          {statuses.map((s) => (
            <div key={s.slug} className={`bg-card/50 rounded-lg p-4 flex flex-col ${statuses.length <= 3 ? 'flex-1 min-w-[220px]' : 'min-w-[260px] w-[260px] shrink-0'}`}>
              <div className="h-5 w-24 bg-muted rounded-md mb-4" />
              <div className="space-y-3">
                <div className="h-32 bg-muted rounded-md" />
                <div className="h-24 bg-muted rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const DATE_FILTERS: { key: DateFilter; label: string; badge?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue', badge: overdueCount },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This week' },
    { key: 'none', label: 'No date' },
  ];

  const toolbar = (
    <div className="flex flex-col gap-2 mb-4">
      {/* Row 1: date filter chips — scrollable on mobile */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {DATE_FILTERS.map(({ key, label, badge }) => (
          <FilterChip
            key={key}
            active={dateFilter === key}
            onClick={() => setDateFilter(key)}
            badge={
              badge != null && badge > 0 ? (
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${
                  dateFilter === key ? 'bg-background/20' : 'bg-red-500/20 text-red-400'
                }`}>
                  {badge}
                </span>
              ) : undefined
            }
          >
            {label}
          </FilterChip>
        ))}
      </div>

      {/* Row 2: action buttons — scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {currentUserId && (
          <FilterChip
            active={onlyMine}
            onClick={() => setOnlyMine((v) => !v)}
          >
            <UserRound className="w-3 h-3" />
            Only mine
          </FilterChip>
        )}
        <ExportTasksButton tasks={visibleTasks} projectName={projectName} />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 shrink-0" onClick={() => setBulkOpen(true)}>
          <Users className="h-3.5 w-3.5" />
          Bulk assign
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 shrink-0" onClick={() => setCreateStatus('todo')}>
          <Plus className="h-3.5 w-3.5" />
          Add task
        </Button>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button onClick={() => setView('board')} className={`px-2.5 py-1.5 transition-colors ${view === 'board' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`} title="Board view">
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView('list')} className={`px-2.5 py-1.5 transition-colors ${view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`} title="List view">
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: group filter chips (only if >1 group) */}
      {groups.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-xs text-muted-foreground mr-1 shrink-0">Group:</span>
          <FilterChip active={filterGroupId === null} onClick={() => setFilterGroupId(null)}>
            All
          </FilterChip>
          {groups.map((g) => (
            <FilterChip
              key={g.id}
              active={filterGroupId === g.id}
              onClick={() => setFilterGroupId(filterGroupId === g.id ? null : g.id)}
            >
              {g.name}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );

  if (view === 'list') {
    return (
      <>
        {toolbar}
        <TaskListView
          tasks={visibleTasks}
          statuses={statuses}
          onOpen={(t) => setOpenTaskId(t.id)}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
        <CreateTaskModal
          open={!!createStatus}
          defaultStatus={createStatus ?? (statuses[0]?.slug ?? 'todo')}
          projectId={projectId}
          groups={projectGroups}
          statuses={statuses}
          members={members}
          onClose={() => setCreateStatus(null)}
          onCreated={handleCreated}
        />
        <BulkAssignModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          tasks={tasks}
          members={members}
          groups={projectGroups}
          onApplied={(taskIds, newAssignedToId, newGroupId, newStartDate, newDueDate) => {
            setTasks((prev) => prev.map((t) => {
              if (!taskIds.includes(t.id)) return t;
              const patch: Partial<BoardTask> = {};
              if (newAssignedToId !== undefined) {
                patch.assignedTo = newAssignedToId
                  ? (members.find((m) => m.id === newAssignedToId) ?? null)
                  : null;
              }
              if (newGroupId !== undefined) {
                patch.group = newGroupId
                  ? (projectGroups.find((g) => g.id === newGroupId) ?? null)
                  : null;
              }
              if (newStartDate !== undefined) patch.startDate = newStartDate;
              if (newDueDate !== undefined) patch.dueDate = newDueDate;
              return { ...t, ...patch };
            }));
          }}
        />
        <TaskDetailPanel
          task={openTask}
          groups={projectGroups}
          statuses={statuses}
          members={members}
          onClose={() => setOpenTaskId(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {toolbar}

      {/* Board scroll container — terisolasi, tidak bocor ke layout page */}
      <div className="relative w-full overflow-hidden">
        {statuses.length > 3 && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-background to-transparent z-10" />
        )}
        <div className={`flex gap-4 overflow-x-auto pb-4 items-start w-full ${statuses.length > 3 ? 'pr-12' : ''}`}>
        {statuses.map((col) => {
          const colTasks = visibleTasks.filter((t) => t.status === col.slug);
          // Kalau ≤ 3 kolom: flex-1 (fill space). Kalau > 3: fixed width + scroll.
          const colSizeClass = statuses.length <= 3
            ? 'flex-1 min-w-[220px]'
            : 'min-w-[260px] w-[260px] shrink-0';
          return (
            <div key={col.slug} className={`flex flex-col bg-card/30 border border-border/50 rounded-lg overflow-hidden min-h-[400px] ${colSizeClass}`}>
              <div className="px-3 py-2.5 border-b border-border/50 bg-card/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm tracking-wide text-foreground">{col.label}</h3>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-1 font-medium">
                    {colTasks.length}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setCreateStatus(col.slug)}
                  title={`Add task to ${col.label}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Droppable droppableId={col.slug}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 ${
                      snapshot.isDraggingOver ? 'bg-muted/20' : ''
                    }`}
                  >
                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <EmptyState
                        icon={<SquareKanban className="w-4 h-4" />}
                        title="No tasks"
                        description={col.order === 0 ? 'Add tasks manually or wait for WhatsApp mentions.' : undefined}
                        size="sm"
                        className="opacity-50"
                      />
                    )}
                    {colTasks.map((task, index) => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        onDelete={handleDelete}
                        onOpen={(t) => setOpenTaskId(t.id)}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
        </div>
      </div>

      <CreateTaskModal
        open={!!createStatus}
        defaultStatus={createStatus ?? (statuses[0]?.slug ?? 'todo')}
        projectId={projectId}
        groups={projectGroups}
        statuses={statuses}
        members={members}
        onClose={() => setCreateStatus(null)}
        onCreated={handleCreated}
      />

      <BulkAssignModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        tasks={tasks}
        members={members}
        groups={projectGroups}
        onApplied={(taskIds, newAssignedToId, newGroupId) => {
          setTasks((prev) => prev.map((t) => {
            if (!taskIds.includes(t.id)) return t;
            const patch: Partial<BoardTask> = {};
            if (newAssignedToId !== undefined) {
              patch.assignedTo = newAssignedToId
                ? (members.find((m) => m.id === newAssignedToId) ?? null)
                : null;
            }
            if (newGroupId !== undefined) {
              patch.group = newGroupId
                ? (projectGroups.find((g) => g.id === newGroupId) ?? null)
                : null;
            }
            return { ...t, ...patch };
          }));
        }}
      />

      <TaskDetailPanel
        task={openTask}
        groups={projectGroups}
        statuses={statuses}
        members={members}
        onClose={() => setOpenTaskId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </DragDropContext>
  );
}
