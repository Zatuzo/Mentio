'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function MarkDoneButton({ taskId }: { taskId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const router = useRouter();

  const markDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state !== 'idle') return;
    setState('loading');
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    if (res.ok) {
      setState('done');
      toast.success('Task selesai');
      setTimeout(() => router.refresh(), 600);
    } else {
      setState('idle');
      toast.error('Gagal mengupdate task');
    }
  };

  return (
    <button
      onClick={markDone}
      title="Tandai selesai"
      className={`flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-all duration-150
        ${state === 'done'
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : state === 'loading'
          ? 'border-muted-foreground/30 text-muted-foreground/50'
          : 'border-muted-foreground/20 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-transparent hover:text-emerald-500/60'
        }`}
    >
      {state === 'loading'
        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
        : <Check className="w-2.5 h-2.5" />}
    </button>
  );
}
