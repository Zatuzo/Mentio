'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft, Pin, PinOff, Trash2, Tag, X, ExternalLink, FileText,
  Sparkles, MoveRight, CheckSquare, Square, Network, PenLine,
} from 'lucide-react';
import { ImageAttachments } from '@/app/components/ImageAttachments';
import { ConvertToTaskButton } from './ConvertToTaskButton';
import { BlockEditor, blockJsonToText } from './BlockEditor';
import { toast } from 'sonner';

interface TagItem { id: string; name: string; color: string | null }
interface NoteTag { tag: TagItem; source?: string; confidence?: number }
interface Space { id: string; name: string; icon: string | null }
interface SourceMention {
  id: string; text: string; senderName: string | null;
  timestamp: string; group: { name: string };
}

interface Note {
  id: string; title: string; content: string; spaceId: string;
  isPinned: boolean; sourceType: string; sourceUrl: string | null;
  createdAt: string; updatedAt: string;
  tags: NoteTag[];
  space: Space;
  sourceMention: SourceMention | null;
  imageUrls?: string[];
}

interface BacklinkNote { id: string; title: string; updatedAt: string; space: { name: string; icon: string | null } }

interface SuggestedSpace { id: string; name: string; icon: string | null }
interface ExtractedTask { title: string; priority: string }
interface RelatedNote { id: string; title: string; similarity: number; spaceName: string }
interface Suggestions {
  status: 'none' | 'pending' | 'done' | 'failed';
  suggestedSpace?: SuggestedSpace | null;
  extractedTasks?: ExtractedTask[];
  relatedNotes?: RelatedNote[];
}

interface Props {
  note: Note;
  spaces: Space[];
  allTags: TagItem[];
  hasTask?: boolean;
  hideBackButton?: boolean;
}

const AUTOSAVE_DELAY = 1200;

export function NoteEditor({ note, spaces, allTags, hasTask = false, hideBackButton = false }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [spaceId, setSpaceId] = useState(note.spaceId);
  const [isPinned, setIsPinned] = useState(note.isPinned);
  const [noteTags, setNoteTags] = useState<TagItem[]>(note.tags.map((t) => t.tag));
  const [aiTagIds, setAiTagIds] = useState<Set<string>>(
    new Set(note.tags.filter((t) => t.source === 'ai').map((t) => t.tag.id)),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(note.imageUrls ?? []);
  const [backlinks, setBacklinks] = useState<BacklinkNote[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [creatingTasks, setCreatingTasks] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true);
      try {
        await fetch(`/api/notes/${note.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        setSaved(true);
      } catch {
        toast.error('Failed to save note');
      } finally {
        setSaving(false);
      }
    },
    [note.id],
  );

  // Load backlinks on mount
  useEffect(() => {
    fetch(`/api/notes/${note.id}/links`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBacklinks(data); })
      .catch(() => {});
  }, [note.id]);

  // Debounced auto-save for title/content
  useEffect(() => {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await save({ title, content });
      scheduleSuggestionFetch();
    }, AUTOSAVE_DELAY);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, content]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeSpace(newSpaceId: string) {
    setSpaceId(newSpaceId);
    await save({ spaceId: newSpaceId });
    router.refresh();
  }

  async function togglePin() {
    const next = !isPinned;
    setIsPinned(next);
    await save({ isPinned: next });
  }

  async function addTag(name: string) {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed || noteTags.find((t) => t.name === trimmed)) return;

    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    const tag: TagItem = await res.json();
    const next = [...noteTags, tag];
    setNoteTags(next);
    await save({ tagIds: next.map((t) => t.id) });
    setTagInput('');
  }

  async function removeTag(tagId: string) {
    const next = noteTags.filter((t) => t.id !== tagId);
    setNoteTags(next);
    setAiTagIds((prev) => { const s = new Set(prev); s.delete(tagId); return s; });
    await save({ tagIds: next.map((t) => t.id) });
  }

  async function saveImages(urls: string[]) {
    setImageUrls(urls);
    await save({ imageUrls: urls });
  }

  async function deleteNote() {
    if (!confirm('Delete this note?')) return;
    await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
    router.push(`/brain/spaces/${spaceId}`);
    router.refresh();
  }


  async function fetchSuggestions(retry = false) {
    try {
      const res = await fetch(`/api/notes/${note.id}/suggestions`);
      const data: Suggestions = await res.json();
      if (data.status === 'done') {
        setSuggestions(data);
        if ((data.extractedTasks ?? []).length > 0) {
          setSelectedTasks(new Set((data.extractedTasks ?? []).map((_, i) => i)));
        }
      } else if (data.status === 'pending' && !retry) {
        suggestionTimer.current = setTimeout(() => fetchSuggestions(true), 5000);
      }
    } catch {
      // non-fatal
    }
  }

  // Schedule suggestion fetch 7s after last save
  const scheduleSuggestionFetch = useCallback(() => {
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    setSuggestions(null);
    setDismissedSuggestions(new Set());
    suggestionTimer.current = setTimeout(() => fetchSuggestions(), 7000);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applySpaceSuggestion(suggestedSpaceId: string) {
    setSpaceId(suggestedSpaceId);
    await save({ spaceId: suggestedSpaceId });
    dismissSuggestion('space');
    router.refresh();
  }

  async function handleCreateTasks() {
    if (!suggestions?.extractedTasks?.length) return;
    const tasks = suggestions.extractedTasks.filter((_, i) => selectedTasks.has(i));
    if (!tasks.length) return;
    setCreatingTasks(true);
    try {
      const res = await fetch(`/api/notes/${note.id}/create-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });
      const data = await res.json();
      if (data.created > 0) {
        toast.success(`${data.created} task dibuat di "${data.projectName}"`);
        dismissSuggestion('tasks');
      }
    } catch {
      toast.error('Gagal membuat tasks');
    } finally {
      setCreatingTasks(false);
    }
  }

  function dismissSuggestion(key: string) {
    setDismissedSuggestions((prev) => new Set([...prev, key]));
  }

  const currentSpace = spaces.find((s) => s.id === spaceId);
  const suggestedTags = allTags.filter(
    (t) => t.name.includes(tagInput.toLowerCase()) && !noteTags.find((nt) => nt.id === t.id),
  );

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -m-6 md:-m-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card/80 backdrop-blur shrink-0">
        {/* Left: nav + space selector */}
        <div className="flex items-center gap-1 min-w-0">
          {!hideBackButton && (
            <>
              <Link
                href={`/brain/spaces/${spaceId}`}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <div className="w-px h-4 bg-border mx-1 shrink-0" />
            </>
          )}
          <Select value={spaceId} onValueChange={changeSpace}>
            <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none w-auto max-w-[140px] gap-1 px-1.5 hover:bg-muted transition-colors">
              <SelectValue>
                <span className="text-muted-foreground">{currentSpace?.name}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {spaces.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-sm">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="flex items-center gap-1.5 mr-2">
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${saving ? 'bg-yellow-500 animate-pulse' : saved ? 'bg-green-500/60' : 'bg-muted-foreground/30'}`} />
            <span className="text-[11px] text-muted-foreground/60">
              {saving ? 'Saving…' : saved ? 'Saved' : ''}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePin}
            title={isPinned ? 'Unpin' : 'Pin'}
            className={`h-7 w-7 p-0 ${isPinned ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </Button>
          {!hasTask && (
            <ConvertToTaskButton noteId={note.id} noteTitle={title} inline />
          )}
          <Link
            href={`/canvas/note/${note.id}`}
            title="Open in Canvas"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
          </Link>
          <div className="w-px h-4 bg-border mx-1 shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteNote}
            className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* AI Suggestion Banners */}
      {suggestions?.status === 'done' && (
        <div className="shrink-0 px-5 md:px-10 pt-4 max-w-3xl w-full mx-auto space-y-2">
          {/* Space suggestion */}
          {suggestions.suggestedSpace && !dismissedSuggestions.has('space') && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="flex-1 text-xs text-muted-foreground">
                AI suggests moving to <span className="font-medium text-foreground">{suggestions.suggestedSpace.name}</span>
              </span>
              <button
                onClick={() => applySpaceSuggestion(suggestions.suggestedSpace!.id)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <MoveRight className="w-3 h-3" /> Apply
              </button>
              <button onClick={() => dismissSuggestion('space')} className="text-muted-foreground/40 hover:text-muted-foreground ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Extracted tasks */}
          {(suggestions.extractedTasks ?? []).length > 0 && !dismissedSuggestions.has('tasks') && (
            <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{suggestions.extractedTasks!.length} action item ditemukan</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateTasks}
                    disabled={creatingTasks || selectedTasks.size === 0}
                    className="text-[11px] font-semibold text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
                  >
                    {creatingTasks ? 'Creating…' : `Create ${selectedTasks.size} task${selectedTasks.size !== 1 ? 's' : ''}`}
                  </button>
                  <button onClick={() => dismissSuggestion('tasks')} className="text-muted-foreground/40 hover:text-muted-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {suggestions.extractedTasks!.map((task, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedTasks((prev) => {
                      const next = new Set(prev);
                      next.has(i) ? next.delete(i) : next.add(i);
                      return next;
                    })}
                    className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {selectedTasks.has(i)
                      ? <CheckSquare className="w-3 h-3 text-primary shrink-0" />
                      : <Square className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{task.title}</span>
                    <span className={`ml-auto shrink-0 text-[10px] px-1 rounded ${
                      task.priority === 'urgent' ? 'text-red-400' :
                      task.priority === 'high' ? 'text-orange-400' :
                      task.priority === 'medium' ? 'text-yellow-500' : 'text-muted-foreground/50'
                    }`}>{task.priority}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-auto px-5 md:px-10 py-7 max-w-3xl w-full mx-auto">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="w-full text-[1.65rem] font-bold bg-transparent border-0 outline-none placeholder:text-muted-foreground/25 mb-5 leading-tight tracking-tight"
        />

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          {noteTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs gap-1 pl-2 pr-1 h-5 font-normal"
              title={aiTagIds.has(tag.id) ? 'Auto-tagged by AI' : undefined}
            >
              {tag.name}
              {aiTagIds.has(tag.id) && (
                <span className="text-[9px] font-semibold text-primary/70 leading-none px-0.5">AI</span>
              )}
              <button onClick={() => removeTag(tag.id)} className="hover:text-destructive transition-colors ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
          {showTagInput ? (
            <div className="relative">
              <Input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { addTag(tagInput); }
                  if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); }
                }}
                onBlur={() => { if (!tagInput) setShowTagInput(false); }}
                placeholder="tag name…"
                className="h-5 text-xs w-24 px-2 py-0"
              />
              {tagInput && suggestedTags.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-10 bg-popover border border-border rounded-lg shadow-lg min-w-[120px] overflow-hidden">
                  {suggestedTags.slice(0, 5).map((t) => (
                    <button
                      key={t.id}
                      onMouseDown={() => { addTag(t.name); setShowTagInput(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <Tag className="w-3 h-3" />
              <span>Add tag</span>
            </button>
          )}
        </div>

        {/* Source info */}
        {note.sourceMention && (
          <div className="mb-5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            Saved from <span className="font-medium text-foreground/70">{note.sourceMention.group.name}</span>
            {note.sourceMention.senderName && (
              <> · {note.sourceMention.senderName}</>
            )}
            {' · '}{new Date(note.sourceMention.timestamp).toLocaleDateString('id-ID')}
          </div>
        )}
        {note.sourceUrl && (
          <div className="mb-5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 shrink-0" />
            <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate hover:text-foreground transition-colors">
              {note.sourceUrl}
            </a>
          </div>
        )}

        <BlockEditor
          key={note.id}
          content={content}
          onChange={setContent}
        />

        {/* Images */}
        <div className="mt-4 pt-4 border-t border-border/40">
          <ImageAttachments urls={imageUrls} onChange={saveImages} />
        </div>
      </div>

      {/* AI Related Notes panel */}
      {suggestions?.status === 'done' && (suggestions.relatedNotes ?? []).length > 0 && !dismissedSuggestions.has('related') && (
        <div className="shrink-0 px-5 md:px-10 py-3 border-t border-border bg-card/20">
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
              <Network className="w-3 h-3" /> Related ({suggestions.relatedNotes!.length})
            </p>
            <button onClick={() => dismissSuggestion('related')} className="text-muted-foreground/30 hover:text-muted-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.relatedNotes!.map((rel) => (
              <Link
                key={rel.id}
                href={`/brain/notes/${rel.id}`}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-white/15 transition-colors"
              >
                <FileText className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[160px]">{rel.title}</span>
                <span className="text-[10px] text-muted-foreground/40">{rel.similarity}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Backlinks panel */}
      {backlinks.length > 0 && (
        <div className="shrink-0 px-5 md:px-10 py-3 border-t border-border bg-card/30">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">
            Linked from ({backlinks.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {backlinks.map((bl) => (
              <Link
                key={bl.id}
                href={`/brain/notes/${bl.id}`}
                className="flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-white/15 transition-colors"
              >
                <FileText className="w-3 h-3 shrink-0" />
                {bl.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer meta */}
      <div className="shrink-0 px-5 md:px-10 py-2 border-t border-border bg-card/50 text-[11px] text-muted-foreground/40 flex gap-4">
        <span>Created {new Date(note.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <span>Updated {new Date(note.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <span className="tabular-nums">{blockJsonToText(content).length} chars</span>
      </div>
    </div>
  );
}
