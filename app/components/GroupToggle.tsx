'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export function GroupToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function toggle(checked: boolean) {
    setOn(checked);
    start(async () => {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, enabled: checked }),
      });
      if (!res.ok) {
        setOn(!checked);
        toast.error('Failed to update group');
        return;
      }
      router.refresh();
    });
  }

  return (
    <Switch
      checked={on}
      onCheckedChange={toggle}
      disabled={pending}
      aria-label={on ? 'Monitoring on' : 'Monitoring off'}
    />
  );
}
