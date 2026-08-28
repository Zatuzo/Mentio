'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { type BoardTask, PRIORITY_CONFIG } from './KanbanTaskCard';
import { type ProjectStatus, type ProjectMember } from './KanbanBoard';
import { ImageAttachments } from './ImageAttachments';

const DURATION_PRESETS = [
  { label: '1 day',   days: 1  },
  { label: '3 days',  days: 3  },
  { label: '1 week',  days: 7  },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / 86_400_000);
}

interface Props {
  open: boolean;
  defaultStatus: string;
  defaultDueDate?: string;
  projectId: string;
  groups: { id: string; name: string }[];
  statuses: ProjectStatus[];
  members: ProjectMember[];
  onClose: () => void;
  onCreated: (task: BoardTask) => void;
}

export function CreateTaskModal({ open, defaultStatus, defaultDueDate = '', projectId, groups, statuses, members, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [priority, setPriority] = useState('none');
  const [startDate, setStartDate] = useState(today());
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [groupId, setGroupId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setStatus(defaultStatus);
    setPriority('none');
    setStartDate(today());
    setDueDate(defaultDueDate);
    setGroupId('');
    setAssignedToId('');
    setImageUrls([]);
  };

  const applyDuration = (days: number) => {
    const base = startDate || today();
    if (!startDate) setStartDate(base);
    setDueDate(addDays(base, days));
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          startDate: startDate || null,
          dueDate: dueDate || null,
          projectId,
          groupId: groupId || null,
          assignedToId: assignedToId || null,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create task');
      }

      const task = await res.json();
      onCreated(task);
      toast.success('Task created');
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const activeDays = diffDays(startDate, dueDate);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>New Task</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="task-desc"
              placeholder="Add more details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Images */}
          <div className="space-y-1.5">
            <Label>Images <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <ImageAttachments urls={imageUrls} onChange={setImageUrls} />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    priority === value
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                  }`}
                >
                  {value !== 'none' && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority === value ? 'bg-background' : cfg.dot}`} />
                  )}
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Timeline</Label>
              {activeDays !== null && activeDays > 0 && (
                <span className="text-xs text-muted-foreground">
                  {activeDays} {activeDays === 1 ? 'day' : 'days'}
                </span>
              )}
            </div>

            {/* Start → Due date row */}
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <span className="text-[11px] text-muted-foreground">Start</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    // Keep duration if dueDate already set
                    if (dueDate && e.target.value) {
                      const d = diffDays(startDate, dueDate);
                      if (d && d > 0) setDueDate(addDays(e.target.value, d));
                    }
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <span className="text-muted-foreground text-sm mt-4">→</span>
              <div className="flex-1 space-y-1">
                <span className="text-[11px] text-muted-foreground">Due</span>
                <Input
                  type="date"
                  value={dueDate}
                  min={startDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Duration suggestions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground">Quick:</span>
              {DURATION_PRESETS.map(({ label, days }) => {
                const isActive = activeDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => applyDuration(days)}
                    className={`px-2 py-0.5 text-[11px] rounded-md border transition-colors ${
                      isActive
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* WA Group */}
          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="task-group">
                WhatsApp group <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <select
                id="task-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">No group (manual)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Assignee */}
          {members.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">
                Assign to <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <select
                id="task-assignee"
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="task-status">Status</Label>
            <select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {statuses.map((s) => (
                <option key={s.slug} value={s.slug}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
