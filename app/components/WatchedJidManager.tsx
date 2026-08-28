'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, X, Pencil, Check, Users, Loader2 } from 'lucide-react';

type WatchedJid = { id: string; jid: string; label: string | null; active: boolean };
type GroupOption = { id: string; name: string };
type GroupMember = {
  jid: string;
  phone: string | null;
  name: string | null;
  isAdmin: boolean;
  isLid: boolean;
  watched: boolean;
};

const shortJid = (jid: string) => jid.replace(/@(s\.whatsapp\.net|lid)$/, '');

export function WatchedJidManager({
  watched,
  groups = [],
}: {
  watched: WatchedJid[];
  groups?: GroupOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addJid, setAddJid] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [editLabel, setEditLabel] = useState<Record<string, string>>({});

  // "Add from group" picker state
  const [pickGroupId, setPickGroupId] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  async function loadMembers(groupId: string) {
    setPickGroupId(groupId);
    setMembers([]);
    if (!groupId) return;
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load members');
      setMembers(data.members || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function watchMember(m: GroupMember) {
    const res = await fetch('/api/watched-jids', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jid: m.jid, label: m.name || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }
    toast.success(`Now watching ${m.name || shortJid(m.jid)}`);
    setMembers((prev) => prev.map((x) => (x.jid === m.jid ? { ...x, watched: true } : x)));
    router.refresh();
  }

  async function addToWatch(jid: string, label?: string) {
    start(async () => {
      const res = await fetch('/api/watched-jids', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jid, label: label || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Now watching ${shortJid(jid)}`);
      setAddJid(''); setAddLabel('');
      router.refresh();
    });
  }

  async function toggle(id: string, active: boolean) {
    start(async () => {
      await fetch(`/api/watched-jids/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      router.refresh();
    });
  }

  async function saveLabel(id: string) {
    const label = editLabel[id];
    if (label === undefined) return;
    start(async () => {
      await fetch(`/api/watched-jids/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      setEditLabel((p) => { const n = { ...p }; delete n[id]; return n; });
      router.refresh();
    });
  }

  async function remove(id: string) {
    start(async () => {
      await fetch(`/api/watched-jids/${id}`, { method: 'DELETE' });
      toast.success('Removed');
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">

      {/* Watched list */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Watched Numbers</p>
        {watched.length === 0 ? (
          <p className="text-sm text-muted-foreground">No numbers watched yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {watched.map((w) => (
              <li key={w.id} className="flex items-center gap-3 p-3">
                <Switch checked={w.active} onCheckedChange={(v) => toggle(w.id, v)} disabled={pending} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-sm ${!w.active && 'opacity-50'}`}>
                      {shortJid(w.jid)}
                    </span>
                    {w.jid.endsWith('@lid') && (
                      <Badge variant="secondary" className="text-xs h-4 px-1.5">LID</Badge>
                    )}
                  </div>
                  {editLabel[w.id] !== undefined ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Input
                        value={editLabel[w.id]}
                        onChange={(e) => setEditLabel((p) => ({ ...p, [w.id]: e.target.value }))}
                        className="h-6 text-xs w-36"
                        onKeyDown={(e) => e.key === 'Enter' && saveLabel(w.id)}
                        autoFocus
                      />
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => saveLabel(w.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditLabel((p) => { const n = { ...p }; delete n[w.id]; return n; })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditLabel((p) => ({ ...p, [w.id]: w.label || '' }))}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      {w.label || 'Add label'}
                    </button>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => remove(w.id)} disabled={pending}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add from group */}
      {groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" />
            Add from group
          </p>
          <p className="text-xs text-muted-foreground">
            Pick a claimed group to see its members and watch them in one click.
          </p>
          <select
            value={pickGroupId}
            onChange={(e) => loadMembers(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
          >
            <option value="">Select a group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {loadingMembers && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading members…
            </div>
          )}

          {!loadingMembers && pickGroupId && members.length === 0 && (
            <div className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs text-muted-foreground">
                No members synced yet. The list syncs automatically when the agent connects — wait
                a moment and refresh.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => loadMembers(pickGroupId)}
              >
                Refresh
              </Button>
            </div>
          )}

          {members.length > 0 && (
            <ul className="max-h-64 overflow-y-auto divide-y divide-border rounded-lg border">
              {members.map((m) => {
                const primary = m.name || (m.phone ? `+${m.phone}` : shortJid(m.jid));
                const secondary = m.name
                  ? m.phone
                    ? `+${m.phone}`
                    : m.isLid
                      ? `LID ${shortJid(m.jid)}`
                      : shortJid(m.jid)
                  : m.phone
                    ? m.isLid
                      ? `LID ${shortJid(m.jid)}`
                      : null
                    : null;
                return (
                <li key={m.jid} className="flex items-center gap-2 p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{primary}</span>
                      {m.isAdmin && (
                        <Badge variant="secondary" className="text-xs h-4 px-1.5">admin</Badge>
                      )}
                      {m.isLid && !m.name && !m.phone && (
                        <Badge variant="secondary" className="text-xs h-4 px-1.5">LID</Badge>
                      )}
                    </div>
                    {secondary && (
                      <div className="font-mono text-xs text-muted-foreground truncate">
                        {secondary}
                      </div>
                    )}
                  </div>
                  {m.watched ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Watching
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => watchMember(m)}
                      disabled={pending}
                    >
                      Watch
                    </Button>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Manual add */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Add Manually</p>
        <div className="flex gap-2">
          <Input
            value={addJid}
            onChange={(e) => setAddJid(e.target.value)}
            placeholder="628xxx@s.whatsapp.net or 80646@lid"
            className="flex-1 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && addJid.trim() && addToWatch(addJid.trim(), addLabel.trim())}
          />
          <Input
            value={addLabel}
            onChange={(e) => setAddLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-36 text-sm"
          />
          <Button
            onClick={() => addJid.trim() && addToWatch(addJid.trim(), addLabel.trim())}
            disabled={pending || !addJid.trim()}
            size="sm"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

    </div>
  );
}
