'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Users, Link2, Search, Check, Loader2, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BoardTask } from './KanbanTaskCard';
import type { ProjectMember } from './KanbanBoard';

interface Group { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  tasks: BoardTask[];
  members: ProjectMember[];
  groups: Group[];
  onApplied: (taskIds: string[], assignedToId: string | null | undefined, groupId: string | null | undefined, startDate: string | null | undefined, dueDate: string | null | undefined) => void;
}

const UNSET = '__unset__';

export function BulkAssignModal({ open, onClose, tasks, members, groups, onApplied }: Props) {
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [assignedToId,  setAssignedToId]  = useState<string>(UNSET);
  const [groupId,       setGroupId]       = useState<string>(UNSET);
  const [startDate,     setStartDate]     = useState<string>('');
  const [dueDate,       setDueDate]       = useState<string>('');
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(false);

  const filtered = useMemo(() =>
    tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase())),
    [tasks, search],
  );

  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canApply = selected.size > 0 && (assignedToId !== UNSET || groupId !== UNSET || startDate !== '' || dueDate !== '');

  const handleApply = async () => {
    if (!canApply) return;
    setLoading(true);

    const body: Record<string, unknown> = { taskIds: Array.from(selected) };
    if (assignedToId !== UNSET) body.assignedToId = assignedToId === '' ? null : assignedToId;
    if (groupId !== UNSET) body.groupId = groupId === '' ? null : groupId;
    if (startDate !== '') body.startDate = startDate || null;
    if (dueDate !== '') body.dueDate = dueDate || null;

    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      const { updated } = await res.json();
      toast.success(`${updated} task${updated !== 1 ? 's' : ''} updated`);
      onApplied(
        Array.from(selected),
        assignedToId !== UNSET ? (assignedToId === '' ? null : assignedToId) : undefined,
        groupId !== UNSET ? (groupId === '' ? null : groupId) : undefined,
        startDate !== '' ? (startDate || null) : undefined,
        dueDate !== '' ? (dueDate || null) : undefined,
      );
      handleClose();
    } catch {
      toast.error('Failed to update tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelected(new Set());
    setAssignedToId(UNSET);
    setGroupId(UNSET);
    setStartDate('');
    setDueDate('');
    setSearch('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Bulk assign</DialogTitle>
        </DialogHeader>

        {/* Actions rows */}
        <div className="px-5 pb-3 grid grid-cols-2 gap-3 border-b border-border">
          {/* Member */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Assign to member
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value={UNSET}>— no change —</option>
              <option value="">Unassign</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Group */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Link2 className="h-3 w-3" /> Wire to group
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value={UNSET}>— no change —</option>
              <option value="">Remove group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarRange className="h-3 w-3" /> Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Due date */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarRange className="h-3 w-3" /> Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Search + select all */}
        <div className="px-5 py-2.5 flex items-center gap-2 border-b border-border">
          <div className="flex items-center gap-1.5 flex-1 bg-muted/40 border border-border rounded-md px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tasks…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              allSelected ? 'bg-primary border-primary' : 'border-border'
            }`}>
              {allSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
            </span>
            All
          </button>
        </div>

        {/* Task list */}
        <div className="overflow-y-auto max-h-64 px-5 py-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No tasks found</p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((task) => {
                const checked = selected.has(task.id);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggle(task.id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors text-xs ${
                      checked ? 'bg-primary/5' : 'hover:bg-muted/40'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      checked ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </span>
                    <span className="flex-1 truncate">{task.title}</span>
                    <span className="text-muted-foreground/50 shrink-0">
                      {task.assignedTo?.name ?? '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {selected.size} task{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!canApply || loading}
              onClick={handleApply}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
