'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine, Plus, Trash2, Link2, Link2Off, MoreHorizontal, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface CanvasMeta {
  id: string;
  name: string;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export function CanvasDashboard() {
  const router = useRouter();
  const [canvases, setCanvases] = useState<CanvasMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/canvases');
    if (res.ok) setCanvases(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setCreating(true);
    const res = await fetch('/api/canvases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Untitled Canvas' }) });
    setCreating(false);
    if (!res.ok) { toast.error('Gagal membuat canvas'); return; }
    const canvas = await res.json();
    router.push(`/canvas/${canvas.id}`);
  };

  const rename = async (id: string, currentName: string) => {
    const name = window.prompt('Nama canvas:', currentName);
    if (!name || name === currentName) return;
    const res = await fetch(`/api/canvases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (res.ok) setCanvases((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
  };

  const toggleShare = async (canvas: CanvasMeta) => {
    const enabling = !canvas.shareToken;
    const res = await fetch(`/api/canvases/${canvas.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sharing: enabling }) });
    if (!res.ok) { toast.error('Gagal update sharing'); return; }
    const updated = await res.json();
    setCanvases((prev) => prev.map((c) => c.id === canvas.id ? { ...c, shareToken: updated.shareToken } : c));
    if (enabling && updated.shareToken) {
      const link = `${window.location.origin}/canvas/${canvas.id}?token=${updated.shareToken}`;
      await navigator.clipboard.writeText(link);
      toast.success('Link disalin ke clipboard!');
    } else {
      toast.success('Link sharing dinonaktifkan');
    }
  };

  const copyLink = async (canvas: CanvasMeta) => {
    if (!canvas.shareToken) return;
    const link = `${window.location.origin}/canvas/${canvas.id}?token=${canvas.shareToken}`;
    await navigator.clipboard.writeText(link);
    toast.success('Link disalin!');
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Hapus canvas "${name}"?`)) return;
    const res = await fetch(`/api/canvases/${id}`, { method: 'DELETE' });
    if (res.ok) setCanvases((prev) => prev.filter((c) => c.id !== id));
    else toast.error('Gagal menghapus canvas');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Canvas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Papan gambar kolaboratif realtime</p>
        </div>
        <Button onClick={create} disabled={creating} size="sm">
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Canvas baru
        </Button>
      </div>

      {canvases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <PenLine className="size-10 opacity-30" />
          <p className="text-sm">Belum ada canvas. Buat yang pertama!</p>
          <Button onClick={create} disabled={creating} size="sm" variant="outline">
            <Plus className="size-4" /> Buat canvas
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              className="group relative rounded-xl border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/canvas/${canvas.id}`)}
            >
              {/* Preview area */}
              <div className="h-36 rounded-t-xl bg-muted/40 flex items-center justify-center">
                <PenLine className="size-8 text-muted-foreground/30" />
              </div>

              <div className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{canvas.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(canvas.updatedAt), { addSuffix: true, locale: localeId })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canvas.shareToken && (
                    <span title="Link sharing aktif">
                      <Link2 className="size-3.5 text-primary" />
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-all"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => rename(canvas.id, canvas.name)}>
                        <PenLine className="size-4" /> Rename
                      </DropdownMenuItem>
                      {canvas.shareToken ? (
                        <>
                          <DropdownMenuItem onClick={() => copyLink(canvas)}>
                            <Link2 className="size-4" /> Salin link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleShare(canvas)}>
                            <Link2Off className="size-4" /> Nonaktifkan sharing
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem onClick={() => toggleShare(canvas)}>
                          <Link2 className="size-4" /> Aktifkan sharing & salin link
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => del(canvas.id, canvas.name)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4" /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
