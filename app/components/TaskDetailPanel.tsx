'use client';

import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Calendar, X, MessageSquare, Bot, GitPullRequest, Loader2, AlertCircle, CheckCircle2, ExternalLink, FileText, FilePen, Info, Cpu } from 'lucide-react';
import { ImageAttachments } from './ImageAttachments';
import { toast } from 'sonner';
import { type BoardTask, PRIORITY_CONFIG } from './KanbanTaskCard';
import { type ProjectStatus, type ProjectMember } from './KanbanBoard';
import { AGENT_MODELS, type AgentModel } from '@/app/lib/agent-executor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  task: BoardTask | null;
  groups: { id: string; name: string }[];
  statuses: ProjectStatus[];
  members: ProjectMember[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<BoardTask>) => void;
  onDelete: (id: string) => void;
}

export function TaskDetailPanel({ task, groups, statuses, members, onClose, onUpdate, onDelete }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentLog, setAgentLog] = useState<{ time: string; type: string; message: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<AgentModel>('deepseek-coder');
  const logEndRef = useRef<HTMLDivElement>(null);
  const initial = useRef({ title: '', description: '', startDate: '', dueDate: '' });

  // Poll agent status while running
  useEffect(() => {
    if (!task) return;
    if (task.agentStatus !== 'running' && !agentRunning) return;

    async function fetchAgentState() {
      const res = await fetch(`/api/tasks/${task!.id}`).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      onUpdate(task!.id, {
        agentStatus: data.agentStatus,
        agentResult: data.agentResult,
        agentPrUrl: data.agentPrUrl,
        agentBranch: data.agentBranch,
        agentError: data.agentError,
        agentFinishedAt: data.agentFinishedAt,
        agentLog: data.agentLog ?? null,
      });
      if (data.agentLog) {
        try {
          const entries = JSON.parse(data.agentLog);
          setAgentLog(entries);
          setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch {}
      }
      return data.agentStatus;
    }

    // Fetch immediately on open, then poll every 3s
    fetchAgentState();
    const interval = setInterval(async () => {
      const status = await fetchAgentState();
      if (status !== 'running') {
        setAgentRunning(false);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [task?.id, task?.agentStatus, agentRunning]);

  async function runAgent() {
    if (!task) return;
    setAgentRunning(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/run-agent`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: selectedModel }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Gagal menjalankan agent');
        setAgentRunning(false);
        return;
      }
      onUpdate(task.id, { agentStatus: 'running', agentEnabled: true });
      toast.success('Agent mulai bekerja, kamu akan dinotifikasi via Telegram saat selesai');
    } catch {
      toast.error('Gagal menjalankan agent');
      setAgentRunning(false);
    }
  }

  useEffect(() => {
    if (task) {
      const t   = task.title ?? '';
      const d   = task.description ?? '';
      const s   = task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : '';
      const due = task.dueDate   ? new Date(task.dueDate).toISOString().slice(0, 10)   : '';
      setTitle(t);
      setDescription(d);
      setStartDate(s);
      setDueDate(due);
      initial.current = { title: t, description: d, startDate: s, dueDate: due };
      // Initialize agentLog from task data if available
      if (task.agentLog) {
        try { setAgentLog(JSON.parse(task.agentLog)); } catch {}
      }
    }
  }, [task?.id]);

  const changePriority = async (newPriority: string) => {
    if (!task || newPriority === task.priority) return;
    setSavingField('priority');
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (!res.ok) throw new Error();
      onUpdate(task.id, { priority: newPriority });
    } catch {
      toast.error('Failed to update priority');
    } finally {
      setSavingField(null);
    }
  };

  if (!task) {
    return (
      <Sheet open={false} onOpenChange={(o) => !o && onClose()}>
        <SheetContent />
      </Sheet>
    );
  }

  const patch = async (field: 'title' | 'description' | 'startDate' | 'dueDate', value: string) => {
    if (initial.current[field] === value) return;
    setSavingField(field);
    try {
      const body: Record<string, unknown> = {};
      if (field === 'startDate') body.startDate = value || null;
      else if (field === 'dueDate') body.dueDate = value || null;
      else body[field] = value;

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');

      const patchValue: Partial<BoardTask> =
        field === 'startDate' ? { startDate: value ? new Date(value).toISOString() : null } :
        field === 'dueDate'   ? { dueDate:   value ? new Date(value).toISOString() : null } :
        { [field]: value || null } as Partial<BoardTask>;
      onUpdate(task.id, patchValue);
      initial.current = { ...initial.current, [field]: value };
    } catch {
      toast.error('Failed to save');
      setTitle(initial.current.title);
      setDescription(initial.current.description);
      setStartDate(initial.current.startDate);
      setDueDate(initial.current.dueDate);
    } finally {
      setSavingField(null);
    }
  };

  const changeStatus = async (newStatus: string) => {
    if (newStatus === task.status) return;
    setSavingField('status');
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      onUpdate(task.id, { status: newStatus });
      const isDone = statuses.find((s) => s.slug === newStatus)?.isDone;
      if (isDone) toast.success('Task marked as done');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setSavingField(null);
    }
  };

  const changeGroup = async (newGroupId: string | null) => {
    const currentId = task.group?.id ?? null;
    if (newGroupId === currentId) return;
    setSavingField('group');
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupId: newGroupId }),
      });
      if (!res.ok) throw new Error();
      const newGroup = newGroupId ? (groups.find((g) => g.id === newGroupId) ?? null) : null;
      onUpdate(task.id, { group: newGroup });
    } catch {
      toast.error('Failed to update group');
    } finally {
      setSavingField(null);
    }
  };

  const changeAssignee = async (newAssigneeId: string | null) => {
    const currentId = task.assignedTo?.id ?? null;
    if (newAssigneeId === currentId) return;
    setSavingField('assignee');
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assignedToId: newAssigneeId }),
      });
      if (!res.ok) throw new Error();
      const newAssignee = newAssigneeId ? (members.find((m) => m.id === newAssigneeId) ?? null) : null;
      onUpdate(task.id, { assignedTo: newAssignee });
    } catch {
      toast.error('Failed to update assignee');
    } finally {
      setSavingField(null);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent showCloseButton={false} className="w-full sm:max-w-[480px] p-0 gap-0">
        <SheetTitle className="sr-only">Task detail</SheetTitle>

        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal shrink-0 max-w-[140px] truncate">
              {task.group?.name ?? 'Manual'}
            </Badge>
            {task.requester && (
              <span className="text-xs text-muted-foreground truncate min-w-0">
                from {task.requester}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-destructive"
              title="Delete task"
              onClick={() => {
                onDelete(task.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Close"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => patch('title', title.trim() || initial.current.title)}
              rows={2}
              className="w-full resize-none bg-transparent text-xl font-semibold leading-snug tracking-tight outline-none focus:bg-accent/30 rounded-md px-2 py-1 -mx-2 transition-colors"
              placeholder="Task title"
            />
          </div>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[88px_1fr] items-start gap-3">
              <span className="text-xs text-muted-foreground pt-1">Priority</span>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => {
                  const active = (task.priority ?? 'none') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => changePriority(value)}
                      disabled={savingField === 'priority'}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs whitespace-nowrap rounded-md transition-colors ${
                        active
                          ? 'bg-foreground text-background'
                          : 'bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      {value !== 'none' && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-background' : cfg.dot}`} />
                      )}
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-[88px_1fr] items-center gap-3">
              <span className="text-xs text-muted-foreground">Status</span>
              <div className="flex gap-1 flex-wrap">
                {statuses.map((s) => {
                  const active = task.status === s.slug;
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => changeStatus(s.slug)}
                      disabled={savingField === 'status'}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs whitespace-nowrap rounded-md transition-colors ${
                        active
                          ? 'bg-foreground text-background'
                          : 'bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: active ? 'currentColor' : s.color }}
                      />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {groups.length > 0 && (
              <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                <span className="text-xs text-muted-foreground">Group</span>
                <select
                  value={task.group?.id ?? ''}
                  onChange={(e) => changeGroup(e.target.value || null)}
                  disabled={savingField === 'group'}
                  className="h-7 rounded-md border border-input bg-background px-2 py-0 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 transition-opacity"
                >
                  <option value="">No group (manual)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {members.length > 0 && (
              <div className="grid grid-cols-[88px_1fr] items-center gap-3">
                <span className="text-xs text-muted-foreground">Assignee</span>
                <select
                  value={task.assignedTo?.id ?? ''}
                  onChange={(e) => changeAssignee(e.target.value || null)}
                  disabled={savingField === 'assignee'}
                  className="h-7 rounded-md border border-input bg-background px-2 py-0 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 transition-opacity"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-[88px_1fr] items-center gap-3">
              <span className="text-xs text-muted-foreground">Start date</span>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onBlur={() => patch('startDate', startDate)}
                  className="bg-transparent outline-none text-sm focus:bg-accent/30 rounded-md px-1.5 py-0.5 -mx-1.5 min-w-0"
                />
                {startDate && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => { setStartDate(''); patch('startDate', ''); }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[88px_1fr] items-center gap-3">
              <span className="text-xs text-muted-foreground">Due date</span>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  onBlur={() => patch('dueDate', dueDate)}
                  className="bg-transparent outline-none text-sm focus:bg-accent/30 rounded-md px-1.5 py-0.5 -mx-1.5 min-w-0"
                />
                {dueDate && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => { setDueDate(''); patch('dueDate', ''); }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[88px_1fr] items-center gap-3">
              <span className="text-xs text-muted-foreground">Created</span>
              <span className="text-sm">{new Date(task.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* ── Images ──────────────────────────────────────────────── */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <FileText className="h-3.5 w-3.5" />
              Images
            </div>
            <ImageAttachments
              urls={task.imageUrls ?? []}
              onChange={async (urls) => {
                const res = await fetch(`/api/tasks/${task.id}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ imageUrls: urls }),
                });
                if (res.ok) onUpdate(task.id, { imageUrls: urls });
                else toast.error('Failed to save images');
              }}
            />
          </div>

          {task.mention && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Source mention
              </div>
              <div className="rounded-md bg-muted/30 border border-border/50 px-3 py-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {task.mention.senderName || task.mention.senderJid.replace(/@.+$/, '')}
                  </span>
                  <span>{new Date(task.mention.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                  {task.mention.text}
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="text-xs text-muted-foreground mb-2">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => patch('description', description)}
              rows={8}
              placeholder="Add a description…"
              className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none focus:bg-accent/30 rounded-md px-2 py-1.5 -mx-2 transition-colors min-h-[120px]"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
