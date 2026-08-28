'use client';

import { useState } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function DumpToTasksButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const run = async () => {
    if (loading) return;
    setLoading(true);
    const res = await fetch('/api/brain/dump-to-tasks', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      if (data.created === 0) {
        toast.info(data.message ?? 'Tidak ada dump note baru');
      } else {
        toast.success(`${data.created} dump note dikonversi ke task`);
        router.refresh();
      }
    } else {
      toast.error('Gagal mengkonversi dump notes');
    }
    setLoading(false);
  };

  return (
    <button
      onClick={run}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white/[0.04] text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.07] transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
      Semua dump → To Do
    </button>
  );
}
