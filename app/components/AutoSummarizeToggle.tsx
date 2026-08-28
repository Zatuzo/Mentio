'use client';
import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';

export function AutoSummarizeToggle({ groupId, enabled }: { groupId: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function toggle(checked: boolean) {
    setOn(checked);
    start(async () => {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: groupId, autoSummarize: checked }),
      });
      if (!res.ok) {
        setOn(!checked);
        toast.error('Gagal update setting');
      } else {
        toast.success(checked ? 'Auto-summary aktif' : 'Auto-summary dimatikan');
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5" title="Auto-summary setiap dapat mention baru (cooldown 30 menit)">
      <Zap className={`h-3.5 w-3.5 shrink-0 transition-colors ${on ? 'text-yellow-400 fill-yellow-400/20' : 'text-muted-foreground/40'}`} />
      <Switch
        checked={on}
        onCheckedChange={toggle}
        disabled={pending}
        aria-label={on ? 'Auto-summary on' : 'Auto-summary off'}
      />
    </div>
  );
}
