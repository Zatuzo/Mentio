'use client';

import { useState } from 'react';
import { CheckSquare, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ConvertToTaskButton({ noteId, noteTitle, inline }: { noteId: string; noteTitle: string; inline?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const convert = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state !== 'idle') return;
    setState('loading');
    const res = await fetch(`/api/notes/${noteId}/to-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: noteTitle }),
    });
    if (res.ok) {
      setState('done');
      toast.success('Task dibuat');
    } else {
      setState('idle');
      toast.error('Gagal membuat task');
    }
  };

  return (
    <button
      onClick={convert}
      title="Tambah ke To Do"
      className={`flex items-center justify-center w-6 h-6 rounded-md transition-all
        ${inline
          ? state === 'done'
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
          : `absolute top-2.5 right-2.5 ${state === 'done'
              ? 'bg-primary/20 text-primary opacity-100'
              : 'opacity-0 group-hover:opacity-100 bg-white/[0.07] hover:bg-primary/20 hover:text-primary text-muted-foreground/50'
            }`
        }`}
    >
      {state === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
       state === 'done'    ? <Check className="w-3.5 h-3.5" /> :
                             <CheckSquare className="w-3.5 h-3.5" />}
    </button>
  );
}
