'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Plus, MessageSquare, Inbox, BookMarked, CheckCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterChip } from '@/components/ui/filter-chip';
import { EmptyState } from './EmptyState';
import { PRIORITY_CONFIG } from './KanbanTaskCard';

type Mention = {
  id: string;
  text: string;
  category?: string | null;
  senderName: string | null;
  senderJid: string;
  mentionedJid: string | null;
  timestamp: string;
  processed: boolean;
  group: { id: string; name: string };
  imageUrls?: string[];
};

interface Props {
  initialMentions: Mention[];
  groups: { id: string; name: string }[];
  projectId: string | null;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function MentionImages({ urls }: { urls: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => setLightbox(url)}
            className="rounded-md overflow-hidden border border-border hover:opacity-90 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="attachment" className="w-20 h-20 object-cover" />
          </button>
        ))}
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="preview"
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function CreateTaskInline({
  mention,
  projectId,
  groups,
  onCreated,
  onDismiss,
}: {
  mention: Mention;
  projectId: string | null;
  groups: { id: string; name: string }[];
  onCreated: () => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const cleanTitle = mention.text.replace(/@\d{5,}/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, 80);
  const [title, setTitle] = useState(cleanTitle);
  const [priority, setPriority] = useState('none');
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3 w-3" />
          Create task
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          <Check className="h-3 w-3" />
          Dismiss
        </Button>
        <SaveToBrainButton mentionId={mention.id} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: mention.text,
          status: 'todo',
          priority,
          projectId,
          groupId: mention.group.id,
          mentionId: mention.id,
          ...(mention.imageUrls?.length ? { imageUrls: mention.imageUrls } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Task created');
      onCreated();
      setOpen(false);
    } catch {
      toast.error('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 space-y-2.5 border-t border-border/50 pt-3 overflow-hidden"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-foreground/50 transition-colors"
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPriority(value)}
            className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border transition-all ${
              priority === value
                ? 'bg-foreground text-background border-foreground scale-105'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            {value !== 'none' && (
              <span className={`w-1.5 h-1.5 rounded-full ${priority === value ? 'bg-background' : cfg.dot}`} />
            )}
            {cfg.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={!title.trim() || loading}>
          {loading ? 'Creating…' : 'Create task'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground ml-auto"
          onClick={onDismiss}
        >
          <Check className="h-3 w-3" />
          Dismiss without task
        </Button>
      </div>
    </motion.form>
  );
}

export function MentionInbox({ initialMentions, groups, projectId }: Props) {
  const [mentions, setMentions] = useState<Mention[]>(initialMentions);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const lastFetchRef = useRef<string>(new Date().toISOString());

  // Poll for new mentions every 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/mentions?since=${encodeURIComponent(lastFetchRef.current)}`);
        if (!res.ok) return;
        const newMentions: Mention[] = await res.json();
        if (newMentions.length === 0) return;
        lastFetchRef.current = new Date().toISOString();
        setMentions((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = newMentions.filter((m) => !existingIds.has(m.id));
          if (fresh.length === 0) return prev;
          toast(`${fresh.length} new mention${fresh.length > 1 ? 's' : ''}`, { duration: 3000 });
          return [...fresh, ...prev];
        });
      } catch { /* silent */ }
    };
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  const dismiss = async (id: string) => {
    // Optimistic: mark as dismissing for exit animation
    setDismissingIds((prev) => new Set([...prev, id]));

    // Short delay to let exit animation play before removing from state
    await new Promise((r) => setTimeout(r, 280));
    setMentions((prev) => prev.map((m) => m.id === id ? { ...m, processed: true } : m));
    setDismissingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });

    try {
      const res = await fetch(`/api/mentions/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ processed: true }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error('Failed to dismiss');
      setMentions((prev) => prev.map((m) => m.id === id ? { ...m, processed: false } : m));
    }
  };

  const handleTaskCreated = (mentionId: string) => {
    dismiss(mentionId);
  };

  const visible = mentions.filter((m) => {
    if (filter === 'unread' && m.processed) return false;
    if (groupFilter && m.group.id !== groupFilter) return false;
    return true;
  });

  const unreadCount = mentions.filter((m) => !m.processed).length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap border-b border-border pb-4">
        <div className="flex items-center gap-1.5">
          <FilterChip
            active={filter === 'unread'}
            onClick={() => setFilter('unread')}
            badge={
              <AnimatePresence mode="popLayout">
                {unreadCount > 0 && (
                  <motion.span
                    key={unreadCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      filter === 'unread' ? 'bg-background/20' : 'bg-primary/20 text-primary'
                    }`}
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            }
          >
            Unread
          </FilterChip>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterChip>
        </div>

        {groups.length > 1 && <div className="w-px h-4 bg-border" />}

        {groups.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterChip active={!groupFilter} onClick={() => setGroupFilter(null)}>
              All groups
            </FilterChip>
            {groups.map((g) => (
              <FilterChip
                key={g.id}
                active={groupFilter === g.id}
                onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}
              >
                {g.name}
              </FilterChip>
            ))}
          </div>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={visible.length}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="inline-block"
            >
              {visible.length} item{visible.length !== 1 ? 's' : ''}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      {/* Feed */}
      <AnimatePresence mode="wait">
        {visible.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <EmptyState
              icon={filter === 'unread' ? <CheckCheck className="w-5 h-5" /> : <Inbox className="w-5 h-5" />}
              title={filter === 'unread' ? 'All caught up' : 'No mentions yet'}
              description={
                filter === 'unread'
                  ? 'No unread mentions. Switch to "All" to see history.'
                  : 'Mentions of your watched numbers in monitored groups will appear here.'
              }
            />
          </motion.div>
        ) : (
          <motion.ul
            key="list"
            className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden"
          >
            <AnimatePresence initial={false}>
              {visible.map((mention, i) => (
                <motion.li
                  key={mention.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{
                    opacity: dismissingIds.has(mention.id) ? 0 : 1,
                    x: dismissingIds.has(mention.id) ? 20 : 0,
                    height: dismissingIds.has(mention.id) ? 0 : 'auto',
                  }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{
                    layout: { duration: 0.2 },
                    opacity: { duration: 0.22 },
                    delay: dismissingIds.has(mention.id) ? 0 : i * 0.04,
                  }}
                  className={`transition-colors overflow-hidden ${
                    mention.processed
                      ? 'bg-card/10 opacity-50'
                      : 'bg-card/40 hover:bg-card/70'
                  }`}
                >
                  <div className="px-4 py-3">
                    {/* Header row */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal bg-muted/50 shrink-0">
                        {mention.group.name}
                      </Badge>
                      <span className="text-xs font-medium text-foreground">
                        {mention.senderName || mention.senderJid.replace(/@.+$/, '')}
                      </span>
                      {mention.mentionedJid && (
                        <span className="text-xs text-muted-foreground/60">
                          · {mention.mentionedJid.replace(/@(s\.whatsapp\.net|lid)$/, '')}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">{timeAgo(mention.timestamp)}</span>
                    </div>

                    {/* Message */}
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words max-w-3xl">
                      {mention.text}
                    </p>

                    {/* Images */}
                    {(mention.imageUrls?.length ?? 0) > 0 && (
                      <MentionImages urls={mention.imageUrls!} />
                    )}

                    {/* Actions */}
                    {!mention.processed && (
                      <div className="mt-2.5">
                        <CreateTaskInline
                          mention={mention}
                          projectId={projectId}
                          groups={groups}
                          onCreated={() => handleTaskCreated(mention.id)}
                          onDismiss={() => dismiss(mention.id)}
                        />
                      </div>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function SaveToBrainButton({ mentionId }: { mentionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const res = await fetch(`/api/mentions/${mentionId}/save`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const note = await res.json();
      setSaved(true);
      toast.success('Saved to Brain', {
        action: { label: 'Open', onClick: () => router.push(`/brain/notes/${note.id}`) },
      });
    } catch {
      toast.error('Failed to save to Brain');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
      onClick={save}
      disabled={loading || saved}
    >
      <motion.span
        animate={saved ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-1"
      >
        <BookMarked className="h-3 w-3" />
        {saved ? 'Saved' : 'Save to Brain'}
      </motion.span>
    </Button>
  );
}
