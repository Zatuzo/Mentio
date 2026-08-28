'use client';

import { useState } from 'react';
import { CheckSquare, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Project { id: string; name: string; }

interface Props {
  noteId: string;
  noteTitle: string;
  projects: Project[];
  onCreated?: (taskId: string) => void;
  children: React.ReactNode;
}

export function NoteToTaskDialog({ noteId, noteTitle, projects, onCreated, children }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(noteTitle);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [priority, setPriority] = useState('none');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTitle(noteTitle);
    setDone(false);
    setOpen(true);
  };

  const submit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/notes/${noteId}/to-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, projectId: projectId || undefined, priority }),
    });
    if (res.ok) {
      const { task } = await res.json();
      setDone(true);
      onCreated?.(task.id);
      setTimeout(() => setOpen(false), 1200);
    }
    setLoading(false);
  };

  return (
    <>
      <span onClick={handleOpen}>{children}</span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <CheckSquare className="w-4 h-4 text-primary" />
            Buat Task dari Note
          </DialogTitle>

          {done ? (
            <div className="py-4 text-center text-sm text-emerald-400 flex items-center justify-center gap-2">
              <CheckSquare className="w-4 h-4" /> Task berhasil dibuat!
            </div>
          ) : (
            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Judul task</label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </div>

              {/* Project */}
              {projects.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Project</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prioritas</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(['none', 'low', 'medium', 'high', 'urgent'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        priority === p
                          ? p === 'urgent' ? 'bg-red-500/15 border-red-500/40 text-red-400'
                          : p === 'high' ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                          : p === 'medium' ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400'
                          : p === 'low' ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                          : 'bg-white/[0.06] border-white/15 text-muted-foreground'
                          : 'border-border text-muted-foreground/50 hover:text-muted-foreground'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={submit}
                  disabled={loading || !title.trim()}
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buat Task'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
