'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';

export function SummarizeButton({ groupId }: { groupId?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function run() {
    setLoading(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(groupId ? { groupId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to summarize');
      toast.success(groupId ? 'Summary generated' : `${data.count} group(s) summarized`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading} size="sm" variant="outline">
      {loading ? (
        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Summarizing…</>
      ) : (
        <><Sparkles className="mr-2 h-3.5 w-3.5" /> Summarize now</>
      )}
    </Button>
  );
}
