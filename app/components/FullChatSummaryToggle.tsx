'use client';
import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ScrollText } from 'lucide-react';

export function FullChatSummaryToggle({ groupId, enabled }: { groupId: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function toggle(checked: boolean) {
    setOn(checked);
    start(async () => {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: groupId, fullChatSummary: checked }),
      });
      if (!res.ok) {
        setOn(!checked);
        toast.error('Gagal update setting');
      } else {
        toast.success(checked ? 'Full chat summary aktif — ringkasan setiap 5 menit setelah chat berhenti' : 'Full chat summary dimatikan');
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5" title="Ringkas semua pesan grup (bukan hanya mention) — AI berjalan 5 menit setelah chat berhenti">
      <ScrollText className={`h-3.5 w-3.5 shrink-0 transition-colors ${on ? 'text-blue-400' : 'text-muted-foreground/40'}`} />
      <Switch
        checked={on}
        onCheckedChange={toggle}
        disabled={pending}
        aria-label={on ? 'Full chat summary on' : 'Full chat summary off'}
      />
    </div>
  );
}
