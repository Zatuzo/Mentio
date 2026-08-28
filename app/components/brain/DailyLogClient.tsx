'use client';

import { useState, useEffect } from 'react';
import { NoteEditor } from './NoteEditor';
import { CalendarDays, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Space { id: string; name: string; icon: string | null }
interface TagItem { id: string; name: string; color: string | null }

interface Props {
  spaces: Space[];
  allTags: TagItem[];
}

export function DailyLogClient({ spaces, allTags }: Props) {
  const [note, setNote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch('/api/brain/daily')
      .then((r) => r.json())
      .then(setNote)
      .finally(() => setLoading(false));
  }, []);

  async function importMentions() {
    setImporting(true);
    try {
      const res = await fetch('/api/brain/daily', { method: 'POST' });
      const data = await res.json();
      if (data.imported > 0) {
        toast.success(`${data.imported} mention diimport ke daily log`);
        // Reload note content
        const updated = await fetch('/api/brain/daily').then((r) => r.json());
        setNote(updated);
      } else {
        toast.info('Tidak ada mention hari ini');
      }
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Memuat daily log…</span>
      </div>
    );
  }

  if (!note) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -m-6 md:-m-8">
      {/* Daily log header bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="w-4 h-4" />
          <span>Daily Log</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={importMentions}
          disabled={importing}
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Import mentions hari ini
        </Button>
      </div>

      {/* Note editor takes the rest */}
      <div className="flex-1 overflow-hidden">
        <NoteEditor
          key={note.updatedAt}
          note={note}
          spaces={spaces}
          allTags={allTags}
          hideBackButton
        />
      </div>
    </div>
  );
}
