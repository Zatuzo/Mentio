'use client';

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Trash2, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { type ProjectStatus } from './KanbanBoard';

const COLOR_PALETTE = [
  '#6b7280', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316',
];

function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (c: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-5 h-5 rounded-full border-2 border-white/20 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        style={{ backgroundColor: value }}
        title="Change color"
      />
      {open && (
        <div className="absolute left-0 top-7 z-20 p-2 bg-popover border border-border rounded-lg shadow-lg grid grid-cols-5 gap-1.5 w-[120px]">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                value === c ? 'border-foreground scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  projectId: string;
  isAdmin: boolean;
  initialStatuses: ProjectStatus[];
}

export function WorkflowSettings({ projectId, isAdmin, initialStatuses }: Props) {
  const [statuses, setStatuses] = useState<ProjectStatus[]>(initialStatuses);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const reorder = async (result: DropResult) => {
    if (!result.destination) return;
    const reordered = [...statuses];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setStatuses(reordered);

    try {
      const res = await fetch(`/api/projects/${projectId}/statuses`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slugs: reordered.map((s) => s.slug) }),
      });
      if (!res.ok) throw new Error();
      const updated: ProjectStatus[] = await res.json();
      setStatuses(updated);
    } catch {
      toast.error('Failed to reorder');
      setStatuses(initialStatuses);
    }
  };

  const patchStatus = async (slug: string, patch: Partial<ProjectStatus>) => {
    setSaving(slug);
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/${slug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to update');
      }
      const updated: ProjectStatus = await res.json();
      setStatuses((prev) => prev.map((s) => (s.slug === slug ? updated : s)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  };

  const deleteStatus = async (slug: string) => {
    setSaving(slug);
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/${slug}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to delete');
      }
      setStatuses((prev) => prev.filter((s) => s.slug !== slug));
      toast.success('Status deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(null);
    }
  };

  const addStatus = async () => {
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), color: newColor }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create');
      }
      const created: ProjectStatus = await res.json();
      setStatuses((prev) => [...prev, created]);
      setNewLabel('');
      setNewColor('#6b7280');
      toast.success('Status added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <DragDropContext onDragEnd={reorder}>
        <Droppable droppableId="statuses">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {statuses.map((status, index) => (
                <Draggable key={status.slug} draggableId={status.slug} index={index} isDragDisabled={!isAdmin}>
                  {(drag, snapshot) => (
                    <div
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      style={drag.draggableProps.style as React.CSSProperties}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                        snapshot.isDragging ? 'bg-muted border-border shadow-lg' : 'bg-card/50 border-border/60'
                      }`}
                    >
                      {/* Drag handle */}
                      {isAdmin && (
                        <span {...drag.dragHandleProps} className="text-muted-foreground/50 cursor-grab hover:text-muted-foreground transition-colors shrink-0">
                          <GripVertical className="h-4 w-4" />
                        </span>
                      )}

                      {/* Color picker */}
                      <ColorPicker
                        value={status.color}
                        disabled={!isAdmin || saving === status.slug}
                        onChange={(c) => patchStatus(status.slug, { color: c })}
                      />

                      {/* Label */}
                      <input
                        type="text"
                        defaultValue={status.label}
                        disabled={!isAdmin || saving === status.slug}
                        className="flex-1 bg-transparent text-sm outline-none focus:bg-accent/30 rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors disabled:opacity-60 min-w-0"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val && val !== status.label) patchStatus(status.slug, { label: val });
                          else e.target.value = status.label;
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />

                      {/* isDone toggle */}
                      <button
                        type="button"
                        disabled={!isAdmin || saving === status.slug}
                        onClick={() => patchStatus(status.slug, { isDone: !status.isDone })}
                        title={status.isDone ? 'Ditandai sebagai "selesai" — klik untuk unmark' : 'Tandai sebagai status "selesai"'}
                        className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors disabled:opacity-50 ${
                          status.isDone
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                        Done
                      </button>

                      {/* Delete */}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          disabled={saving === status.slug || statuses.length <= 1}
                          title={statuses.length <= 1 ? 'Tidak bisa hapus status terakhir' : 'Hapus status'}
                          onClick={() => deleteStatus(status.slug)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add new status */}
      {isAdmin && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <ColorPicker value={newColor} onChange={setNewColor} />
          <Input
            placeholder="Nama status baru..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStatus()}
            className="h-8 text-sm flex-1"
          />
          <Button
            size="sm"
            className="h-8 gap-1 shrink-0"
            disabled={!newLabel.trim() || adding}
            onClick={addStatus}
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-1">
        Drag untuk reorder kolom. Klik label untuk rename. Badge <span className="text-emerald-400 font-medium">Done</span> menandai status mana yang dihitung sebagai "selesai" untuk statistik dan notifikasi WA.
      </p>
    </div>
  );
}
