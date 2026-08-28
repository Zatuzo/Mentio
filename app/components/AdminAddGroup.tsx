'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Eye } from 'lucide-react';

type Group = { id: string; name: string; mentionCount: number };

interface Props {
  initialGroups: Group[];
}

export function AdminAddGroup({ initialGroups }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [selected, setSelected] = useState<string>('');
  const [watching, setWatching] = useState(false);
  const router = useRouter();

  async function watch() {
    if (!selected) return;
    setWatching(true);
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupId: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to watch group');
      toast.success('Group is now being watched');
      setGroups((prev) => prev.filter((g) => g.id !== selected));
      setSelected('');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWatching(false);
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Semua grup yang dikenal bot sudah di-watch.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="max-w-sm">
          <SelectValue placeholder="Pilih grup…" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name} <span className="text-muted-foreground">({g.mentionCount} mention)</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={watch} disabled={!selected || watching}>
        {watching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
        Watch
      </Button>
    </div>
  );
}
