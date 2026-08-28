'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Sparkles, Plus, Trash2, MessageSquare,
  Send, Loader2, ChevronRight, Copy, Check, FolderKanban, ChevronsUpDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionSummary = { id: string; title: string; updatedAt: string };
type ChatMessage   = { id: string; role: 'user' | 'assistant'; content: string };
type Project       = { id: string; name: string };

interface Props {
  initialSessions: SessionSummary[];
  projectId: string | null;
  projectName: string | null;
  projects: Project[];
  userName: string;
}

// ── Code block with copy button ───────────────────────────────────────────────

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-border/60">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#1e1e2e] border-b border-white/5">
        <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {copied
            ? <><Check className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
            : <><Copy className="h-3 w-3" /><span>Copy</span></>
          }
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: '#1a1b2e',
          fontSize: '12px',
          lineHeight: '1.6',
          padding: '14px 16px',
        }}
        codeTagProps={{ style: { fontFamily: 'var(--font-mono, ui-monospace, monospace)' } }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MdContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isBlock = !props.node?.position || String(children).includes('\n');
          if (isBlock || match) {
            return (
              <CodeBlock language={match?.[1] ?? ''}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          }
          return (
            <code className="bg-primary/10 text-primary text-[11px] px-1.5 py-0.5 rounded-md font-mono" {...props}>
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-3 py-1.5 border border-border bg-muted/50 font-semibold text-left">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-1.5 border border-border">{children}</td>
        ),
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-2">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-border my-3" />,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Confirmation UI ───────────────────────────────────────────────────────────

const CONFIRM_TOKEN = '⚡CONFIRM_NEEDED';

function ConfirmBar({ onConfirm }: { onConfirm: (yes: boolean) => void }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <Button size="sm" className="h-7 text-xs" onClick={() => onConfirm(true)}>
        <Check className="h-3 w-3 mr-1" /> Confirm
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onConfirm(false)}>
        Cancel
      </Button>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

const messageVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

function MessageBubble({ msg, isStreaming, isLast, onConfirm }: {
  msg: ChatMessage;
  isStreaming: boolean;
  isLast: boolean;
  onConfirm: (yes: boolean) => void;
}) {
  const isUser = msg.role === 'user';

  // Strip confirmation token for display; show ConfirmBar only when streaming done
  const hasConfirm = !isStreaming && !isUser && msg.content.includes(CONFIRM_TOKEN);
  const cleanContent = hasConfirm ? msg.content.replace(CONFIRM_TOKEN, '').trimEnd() : msg.content;

  const showCursor = isStreaming && isLast && !isUser && cleanContent !== '';
  const displayContent = showCursor ? cleanContent + '▋' : cleanContent;

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >

      {isUser ? (
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {msg.content}
        </div>
      ) : (
        <div className="flex-1 min-w-0 text-sm leading-relaxed pt-1">
          {displayContent !== '' && <MdContent content={displayContent} />}
          {hasConfirm && <ConfirmBar onConfirm={onConfirm} />}
        </div>
      )}

    </motion.div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AiChatPage({ initialSessions, projectId, projectName, projects }: Props) {
  const [sessions,          setSessions]          = useState<SessionSummary[]>(initialSessions);
  const [activeSessionId,   setActiveSessionId]   = useState<string | null>(null);
  const [messages,          setMessages]          = useState<ChatMessage[]>([]);
  const [input,             setInput]             = useState('');
  const [isStreaming,       setIsStreaming]        = useState(false);
  const [sidebarOpen,       setSidebarOpen]        = useState(true);
  const [activeProjectId,   setActiveProjectId]   = useState<string | null>(projectId);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(projectName);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Session management ──────────────────────────────────────────────────────

  const createSession = useCallback(async (): Promise<SessionSummary | null> => {
    const res = await fetch('/api/ai/sessions', { method: 'POST' });
    if (!res.ok) { toast.error('Failed to create session'); return null; }
    const s = await res.json();
    const summary = { id: s.id, title: s.title, updatedAt: s.updatedAt };
    setSessions((prev) => [summary, ...prev]);
    return summary;
  }, []);

  const loadSession = useCallback(async (id: string) => {
    if (id === activeSessionId) return;
    const res = await fetch(`/api/ai/sessions/${id}`);
    if (!res.ok) { toast.error('Failed to load session'); return; }
    const s = await res.json();
    setActiveSessionId(id);
    setMessages(s.messages.map((m: { id: string; role: string; content: string }) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })));
  }, [activeSessionId]);

  const deleteSession = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/ai/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); }
  }, [activeSessionId]);

  const newChat = useCallback(async () => {
    const s = await createSession();
    if (s) { setActiveSessionId(s.id); setMessages([]); }
  }, [createSession]);

  // ── Send message ────────────────────────────────────────────────────────────

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const s = await createSession();
      if (!s) return;
      sessionId = s.id;
      setActiveSessionId(s.id);
    }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const asstId = crypto.randomUUID();
    const asstMsg: ChatMessage = { id: asstId, role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      // Strip confirmation token before sending to AI (clean history)
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content.replace(CONFIRM_TOKEN, '').trimEnd(),
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, sessionId, projectId: activeProjectId }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? 'Request failed');
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => m.id === asstId ? { ...m, content: accumulated } : m)
        );
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }

      if (messages.length === 0) {
        const updated = await fetch(`/api/ai/sessions/${sessionId}`).then((r) => r.json()).catch(() => null);
        if (updated?.title) {
          setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title: updated.title } : s));
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setMessages((prev) => prev.filter((m) => m.id !== asstId && m.id !== userMsg.id));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, activeSessionId, messages, createSession, activeProjectId]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    await sendText(text);
  }, [input, sendText]);

  const handleConfirm = useCallback((yes: boolean) => {
    sendText(yes ? 'Ya, lanjutkan.' : 'Batalkan.');
  }, [sendText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const SUGGESTIONS = [
    'List my open tasks',
    'Show recent WhatsApp mentions',
    'What\'s the status of my project?',
    'Create a task: Fix login bug, urgent',
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 md:-m-6 overflow-hidden">

      {/* Mobile backdrop */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-20 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        animate={{ width: sidebarOpen ? 256 : 0, x: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className={`flex flex-col border-r border-border bg-card shrink-0 overflow-hidden ${
          isMobile ? 'absolute inset-y-0 left-0 z-30 h-full' : ''
        }`}
      >
        <div className="w-64 flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              Mentio AI
            </span>
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={newChat}>
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-2">No chats yet.</p>
            ) : (
              <div className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {sessions.map((s) => (
                    <motion.button
                      key={s.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => { loadSession(s.id); if (isMobile) setSidebarOpen(false); }}
                      className={`group w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                        activeSessionId === s.id
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="flex-1 truncate text-xs">{s.title}</span>
                      <button
                        type="button"
                        onClick={(e) => deleteSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {projects.length > 0 && (
            <div className="px-2 py-2 border-t border-border shrink-0">
              <p className="text-[10px] text-muted-foreground px-1 mb-1">Context project</p>
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left">
                  <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="flex-1 truncate text-xs font-medium">{activeProjectName ?? 'Select project'}</span>
                  <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => { setActiveProjectId(p.id); setActiveProjectName(p.name); }}
                      className="flex items-center gap-2"
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      {activeProjectId === p.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          >
            <motion.div animate={{ rotate: sidebarOpen ? 180 : 0 }} transition={{ duration: 0.22 }}>
              <ChevronRight className="h-4 w-4" />
            </motion.div>
          </button>
          <span className="text-sm font-medium text-muted-foreground truncate flex-1">
            {activeSessionId
              ? (sessions.find((s) => s.id === activeSessionId)?.title ?? 'Chat')
              : 'New conversation'}
          </span>
          {activeProjectName && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/60 border border-border rounded-full px-2 py-0.5 shrink-0">
              <FolderKanban className="h-2.5 w-2.5" />
              {activeProjectName}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Mentio AI</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Manage tasks, browse mentions, generate tasks from text, or just ask anything.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="text-left text-xs px-3 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <MessageBubble key={msg.id} msg={msg} isStreaming={isStreaming} isLast={i === messages.length - 1} onConfirm={handleConfirm} />
              ))}
            </AnimatePresence>

            {/* Typing bubble — shows when streaming but last message has no content yet */}
            <AnimatePresence>
              {isStreaming && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant' || !messages[messages.length - 1]?.content) && (
                <motion.div
                  key="typing-bubble"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-end gap-2"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex items-center gap-1">
                      <motion.span
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                      />
                      <motion.span
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.span
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3 shrink-0 bg-background/50">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-2xl px-3 py-2 focus-within:ring-1 focus-within:ring-ring transition-shadow">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Message Mentio AI…"
                rows={1}
                disabled={isStreaming}
                className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:text-muted-foreground/50 leading-relaxed disabled:opacity-40 py-0.5 max-h-[200px]"
                style={{ minHeight: '24px' }}
              />
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 rounded-xl shrink-0"
                disabled={!input.trim() || isStreaming}
                onClick={send}
              >
                {isStreaming
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />
                }
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5 opacity-60">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
