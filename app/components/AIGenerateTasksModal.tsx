'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Sparkles, Trash2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Send, Zap,
} from 'lucide-react';
import { type BoardTask, PRIORITY_CONFIG } from './KanbanTaskCard';
import { type ProjectMember } from './KanbanBoard';

// ── Types ─────────────────────────────────────────────────────────────────────

type InputType = 'bug_report' | 'feature_brief' | 'meeting_notes' | 'feedback' | 'general';

export type GeneratedTask = {
  title: string;
  description: string | null;
  priority: string;
  suggestedAssigneeId: string | null;
  isDuplicate: boolean;
  confidence: 'high' | 'low';
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  tasks: GeneratedTask[];
  inputType?: InputType;
  streaming: boolean;
  autoInserted?: number;
};

// ── Config ────────────────────────────────────────────────────────────────────

const INPUT_TYPE_CONFIG: Record<InputType, { label: string; icon: string; classes: string }> = {
  bug_report:    { label: 'Bug Report',    icon: '🐛', classes: 'text-red-400 bg-red-400/10 border-red-400/20' },
  feature_brief: { label: 'Feature Brief', icon: '✨', classes: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  meeting_notes: { label: 'Meeting Notes', icon: '📋', classes: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  feedback:      { label: 'User Feedback', icon: '💬', classes: 'text-green-400 bg-green-400/10 border-green-400/20' },
  general:       { label: 'General',       icon: '📄', classes: 'text-muted-foreground bg-muted/40 border-border' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function streamTasks(
  url: string,
  body: object,
  onTask: (t: GeneratedTask) => void,
  onMeta?: (inputType: InputType) => void,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? 'Request failed');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.type === 'meta' && onMeta) onMeta(parsed.inputType as InputType);
        else if (parsed.type === 'task' && parsed.data) {
          onTask({
            title: parsed.data.title ?? '',
            description: parsed.data.description ?? null,
            priority: parsed.data.priority ?? 'none',
            suggestedAssigneeId: parsed.data.suggestedAssigneeId ?? null,
            isDuplicate: !!parsed.data.isDuplicate,
            confidence: parsed.data.confidence === 'low' ? 'low' : 'high',
          });
        } else if (parsed.type === 'error') {
          throw new Error(parsed.message ?? 'AI error');
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

async function insertTaskList(
  tasks: GeneratedTask[],
  projectId: string,
  defaultStatus: string,
): Promise<BoardTask[]> {
  const created: BoardTask[] = [];
  for (const t of tasks) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: t.title,
        description: t.description || null,
        priority: t.priority,
        status: defaultStatus,
        projectId,
        assignedToId: t.suggestedAssigneeId || null,
      }),
    });
    if (res.ok) created.push(await res.json());
  }
  return created;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  projectId: string;
  defaultStatus: string;
  members: ProjectMember[];
  onClose: () => void;
  onCreated: (tasks: BoardTask[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AIGenerateTasksModal({ open, projectId, defaultStatus, members, onClose, onCreated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [autoInsert, setAutoInsert] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = messages.some((m) => m.streaming);
  const hasMessages = messages.length > 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.streaming);
  const currentTasks = lastAssistant?.tasks ?? [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClose = () => {
    setMessages([]);
    setInput('');
    setExpanded({});
    setAutoInsert(false);
    onClose();
  };

  // ── Task edits (on last assistant message) ──────────────────────────────────

  const updateTask = useCallback((msgId: string, idx: number, patch: Partial<GeneratedTask>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, tasks: m.tasks.map((t, i) => (i === idx ? { ...t, ...patch } : t)) }
          : m
      )
    );
  }, []);

  const removeTask = useCallback((msgId: string, idx: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, tasks: m.tasks.filter((_, i) => i !== idx) } : m
      )
    );
  }, []);

  // ── Send (generate or refine) ───────────────────────────────────────────────

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');

    const isFirst = !hasMessages;
    const userMsgId = crypto.randomUUID();
    const aiMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text, tasks: [], streaming: false },
      { id: aiMsgId,   role: 'assistant', tasks: [], streaming: true },
    ]);

    try {
      if (isFirst) {
        const collected: GeneratedTask[] = [];
        await streamTasks(
          '/api/tasks/ai-generate',
          { text, projectId },
          (t) => {
            collected.push(t);
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, tasks: [...collected] } : m))
            );
          },
          (type) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, inputType: type } : m))
            );
          },
        );

        if (autoInsert && collected.length > 0) {
          const highConf = collected.filter((t) => t.confidence === 'high' && !t.isDuplicate);
          const toReview = collected.filter((t) => t.confidence !== 'high' || t.isDuplicate);
          if (highConf.length > 0) {
            setInserting(true);
            const created = await insertTaskList(highConf, projectId, defaultStatus);
            setInserting(false);
            if (created.length > 0) onCreated(created);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, tasks: toReview, autoInserted: created.length, streaming: false }
                  : m
              )
            );
            if (toReview.length === 0) {
              toast.success(`⚡ ${created.length} task${created.length > 1 ? 's' : ''} auto-inserted`);
              handleClose();
              return;
            }
            if (created.length > 0) toast.success(`⚡ ${created.length} task${created.length > 1 ? 's' : ''} auto-inserted`);
            return;
          }
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, streaming: false } : m))
        );
      } else {
        const prevTasks = currentTasks;
        const nextTasks: GeneratedTask[] = [];
        await streamTasks(
          '/api/tasks/ai-refine',
          { tasks: prevTasks, instruction: text, projectId },
          (t) => {
            nextTasks.push(t);
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, tasks: [...nextTasks] } : m))
            );
          },
        );
        if (nextTasks.length === 0) {
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId && m.id !== userMsgId));
          toast.error('No tasks returned — try rephrasing');
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, streaming: false } : m))
          );
        }
      }
    } catch (err) {
      setInserting(false);
      setMessages((prev) => prev.filter((m) => m.id !== aiMsgId && m.id !== userMsgId));
      toast.error(err instanceof Error ? err.message : 'Failed to generate tasks');
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  // ── Insert all ──────────────────────────────────────────────────────────────

  const insertAll = async () => {
    if (currentTasks.length === 0) return;
    setInserting(true);
    try {
      const created = await insertTaskList(currentTasks, projectId, defaultStatus);
      if (created.length > 0) {
        onCreated(created);
        toast.success(`${created.length} task${created.length > 1 ? 's' : ''} created`);
        handleClose();
      }
      if (created.length < currentTasks.length) {
        toast.error(`${currentTasks.length - created.length} task(s) failed`);
      }
    } catch {
      toast.error('Failed to insert tasks');
    } finally {
      setInserting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-xl h-[80vh] max-h-[80vh] flex flex-col p-0 gap-0">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <DialogTitle className="text-sm font-semibold m-0">Generate tasks with AI</DialogTitle>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
              <Sparkles className="h-8 w-8 opacity-20" />
              <p className="text-sm max-w-[240px] leading-relaxed">
                Paste a project brief, bug report, feedback, or meeting notes to generate tasks.
              </p>
              <p className="text-xs opacity-60">Press Enter to send · Shift+Enter for newline</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {/* AI avatar */}
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
              )}

              <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                {/* User bubble */}
                {msg.role === 'user' && msg.text && (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                )}

                {/* Assistant bubble */}
                {msg.role === 'assistant' && (
                  <div className="w-full space-y-2">
                    {/* Input type badge */}
                    {msg.inputType && (() => {
                      const cfg = INPUT_TYPE_CONFIG[msg.inputType];
                      return (
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cfg.classes}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      );
                    })()}

                    {/* Auto-inserted notice */}
                    {msg.autoInserted != null && msg.autoInserted > 0 && (
                      <div className="text-xs text-primary flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {msg.autoInserted} task{msg.autoInserted > 1 ? 's' : ''} auto-inserted to board
                        {msg.tasks.length > 0 && ' · remaining tasks need review:'}
                      </div>
                    )}

                    {/* Thinking indicator */}
                    {msg.streaming && msg.tasks.length === 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-muted/40 border border-border rounded-2xl rounded-tl-sm w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                      </div>
                    )}

                    {/* Task cards */}
                    {msg.tasks.length > 0 && (
                      <div className="space-y-1.5 w-full">
                        {msg.tasks.map((task, idx) => {
                          const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
                          const expandKey = `${msg.id}-${idx}`;
                          const isExpanded = !!expanded[expandKey];
                          const suggestedMember = task.suggestedAssigneeId
                            ? members.find((m) => m.id === task.suggestedAssigneeId) ?? null
                            : null;
                          const isLastMsg = !msg.streaming && msg.id === lastAssistant?.id;

                          return (
                            <div
                              key={idx}
                              className={`border rounded-xl px-3 py-2 text-sm animate-in fade-in duration-150 ${
                                task.isDuplicate ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-card/60'
                              } ${msg.streaming ? 'opacity-70' : ''}`}
                            >
                              {/* Title row */}
                              <div className="flex items-start gap-2">
                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${priorityCfg.dot}`} />
                                {isLastMsg ? (
                                  <input
                                    className="flex-1 bg-transparent outline-none font-medium leading-snug focus:bg-accent/30 rounded px-1 -mx-1 min-w-0 text-sm"
                                    value={task.title}
                                    onChange={(e) => updateTask(msg.id, idx, { title: e.target.value })}
                                  />
                                ) : (
                                  <span className="flex-1 font-medium leading-snug text-sm">{task.title}</span>
                                )}
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {/* Confidence dot */}
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${task.confidence === 'high' ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
                                    title={task.confidence === 'high' ? 'High confidence' : 'Low confidence'}
                                  />
                                  {task.isDuplicate && (
                                    <span title="Similar task already exists" className="text-yellow-500 p-0.5">
                                      <AlertTriangle className="h-3 w-3" />
                                    </span>
                                  )}
                                  {isLastMsg && task.description && (
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground p-0.5"
                                      onClick={() => setExpanded((prev) => ({ ...prev, [expandKey]: !isExpanded }))}
                                    >
                                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>
                                  )}
                                  {isLastMsg && (
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive p-0.5"
                                      onClick={() => removeTask(msg.id, idx)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Priority + Assignee */}
                              {isLastMsg && (
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <div className="flex gap-1 flex-wrap">
                                    {Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() => updateTask(msg.id, idx, { priority: value })}
                                        className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                                          task.priority === value
                                            ? 'bg-foreground text-background'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                        }`}
                                      >
                                        {value !== 'none' && (
                                          <span className={`w-1 h-1 rounded-full shrink-0 ${task.priority === value ? 'bg-background' : cfg.dot}`} />
                                        )}
                                        {cfg.label}
                                      </button>
                                    ))}
                                  </div>
                                  {members.length > 0 && (
                                    <select
                                      value={task.suggestedAssigneeId ?? ''}
                                      onChange={(e) => updateTask(msg.id, idx, { suggestedAssigneeId: e.target.value || null })}
                                      className={`ml-auto h-5 text-[10px] rounded border bg-background px-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                                        suggestedMember ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground'
                                      }`}
                                    >
                                      <option value="">Unassigned</option>
                                      {members.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              )}

                              {/* Description */}
                              {isLastMsg && isExpanded && task.description && (
                                <textarea
                                  className="w-full mt-1.5 bg-transparent text-xs text-muted-foreground leading-relaxed outline-none focus:bg-accent/30 rounded px-1 -mx-1 resize-none"
                                  rows={2}
                                  value={task.description}
                                  onChange={(e) => updateTask(msg.id, idx, { description: e.target.value })}
                                />
                              )}
                            </div>
                          );
                        })}

                        {/* Streaming tail */}
                        {msg.streaming && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generating…
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border px-3 py-3 shrink-0 space-y-2 bg-background/50">
          {/* Textarea */}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKey}
              placeholder={
                !hasMessages
                  ? 'Paste a project brief, bug report, feedback, or meeting notes…'
                  : 'Refine tasks… e.g. "Assign urgent ones to Budi"'
              }
              rows={1}
              disabled={isStreaming || inserting}
              className="flex-1 resize-none bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring disabled:opacity-40 transition-opacity leading-relaxed overflow-hidden"
              style={{ minHeight: '42px', maxHeight: '160px' }}
            />
            <Button
              size="icon"
              className="h-[42px] w-[42px] rounded-xl shrink-0"
              onClick={send}
              disabled={!input.trim() || isStreaming || inserting}
            >
              {isStreaming
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </Button>
          </div>

          {/* Bottom row: auto-insert toggle + insert button */}
          <div className="flex items-center justify-between gap-2">
            {/* Auto-insert toggle */}
            <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${autoInsert ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              <Zap className="h-3 w-3" />
              Auto-insert
              <Switch size="sm" checked={autoInsert} onCheckedChange={setAutoInsert} />
            </label>

            {/* Insert button */}
            {currentTasks.length > 0 && !isStreaming && (
              <Button
                size="sm"
                className="h-7 text-xs rounded-lg"
                onClick={insertAll}
                disabled={inserting}
              >
                {inserting
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Inserting…</>
                  : `Insert ${currentTasks.length} task${currentTasks.length > 1 ? 's' : ''} →`
                }
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
