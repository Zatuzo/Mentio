'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Group = { id: string; name: string };

interface Props {
  projectId: string;
  isAdmin: boolean;
  initialLinked: Group[];
  initialAvailable: Group[];
}

export function ProjectGroupsSettings({ projectId, isAdmin, initialLinked, initialAvailable }: Props) {
  const [linked, setLinked] = useState<Group[]>(initialLinked);
  const [available, setAvailable] = useState<Group[]>(initialAvailable);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);

  async function addGroup() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const group: Group = await res.json();
      setLinked((prev) => [...prev, group].sort((a, b) => a.name.localeCompare(b.name)));
      setAvailable((prev) => prev.filter((g) => g.id !== selectedId));
      setSelectedId('');
      toast.success(`Grup "${group.name}" ditambahkan ke project`);
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal menambah grup');
    } finally {
      setLoading(false);
    }
  }

  async function removeGroup(group: Group) {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/groups?groupId=${group.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setLinked((prev) => prev.filter((g) => g.id !== group.id));
      setAvailable((prev) => [...prev, group].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Grup "${group.name}" dihapus dari project`);
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal menghapus grup');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Linked groups */}
      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada grup yang terhubung ke project ini.</p>
      ) : (
        <ul className="space-y-2">
          {linked.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>{g.name}</span>
              {isAdmin && (
                <button
                  onClick={() => removeGroup(g)}
                  disabled={loading}
                  className="text-muted-foreground hover:text-destructive transition-colors text-xs"
                >
                  Hapus
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add group — admin only */}
      {isAdmin && (
        <div className="flex gap-2">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Semua grup yang kamu klaim sudah ditambahkan.{' '}
              <a href="/settings/whatsapp" className="underline underline-offset-2">
                Klaim grup baru
              </a>{' '}
              di Settings → WhatsApp.
            </p>
          ) : (
            <>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Pilih grup untuk ditambahkan…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addGroup} disabled={!selectedId || loading} size="sm">
                Tambah
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
