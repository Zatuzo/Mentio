'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Copy, Check, Loader2, Plus, X, CircleCheck } from 'lucide-react';
import { copyToClipboard } from '@/app/lib/clipboard';

type Claim = {
  id: string;
  code: string;
  status: string;
  groupName: string | null;
  expiresAt: string | Date;
  claimedAt: string | Date | null;
};

interface Props {
  initialClaims: Claim[];
}

function expiresIn(d: string | Date): string {
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}

export function ClaimGroup({ initialClaims }: Props) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const router = useRouter();
  const knownClaimed = useRef(
    new Set(initialClaims.filter((c) => c.status === 'claimed').map((c) => c.id))
  );

  const pending = claims.filter((c) => c.status === 'pending');
  const claimed = claims.filter((c) => c.status === 'claimed');

  // Poll while there are pending claims so a successful claim shows up live.
  useEffect(() => {
    if (pending.length === 0) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch('/api/groups/claim');
        if (!res.ok) return;
        const data = await res.json();
        const next: Claim[] = data.claims || [];
        for (const c of next) {
          if (c.status === 'claimed' && !knownClaimed.current.has(c.id)) {
            knownClaimed.current.add(c.id);
            toast.success(`Group "${c.groupName || ''}" claimed!`);
            router.refresh();
          }
        }
        setClaims(next);
      } catch {
        /* ignore poll errors */
      }
    }, 7000);
    return () => clearInterval(t);
  }, [pending.length, router]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/groups/claim', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate code');
      setClaims((prev) => [data.claim, ...prev]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function cancel(id: string) {
    setClaims((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/groups/claim?id=${id}`, { method: 'DELETE' }).catch(() => {});
  }

  async function copy(code: string) {
    try {
      await copyToClipboard(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy');
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="font-medium">Claim a group</div>
          <div className="text-xs text-muted-foreground">
            Generate a code, then post it in the WhatsApp group you want to monitor. Make sure the
            Mentio bot number is already in that group.
          </div>
        </div>
        <Button size="sm" onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          New code
        </Button>
      </div>

      {pending.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-3 rounded-md border border-border bg-background p-3"
        >
          <code className="font-mono text-sm text-primary tracking-wider">{c.code}</code>
          <button
            type="button"
            onClick={() => copy(c.code)}
            className="text-muted-foreground hover:text-foreground"
            title="Copy code"
          >
            {copied === c.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <span className="text-xs text-muted-foreground">{expiresIn(c.expiresAt)}</span>
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Waiting for you to post it…
          </span>
          <button
            type="button"
            onClick={() => cancel(c.id)}
            className="text-muted-foreground hover:text-destructive"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {claimed.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300"
        >
          <CircleCheck className="w-3.5 h-3.5" />
          Group <strong>{c.groupName}</strong> claimed successfully.
        </div>
      ))}
    </div>
  );
}
