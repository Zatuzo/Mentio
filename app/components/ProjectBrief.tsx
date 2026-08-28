'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BlockEditor } from './brain/BlockEditor';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { FileText } from 'lucide-react';

interface Props {
  projectId: string;
  initialBrief: string | null;
  briefUpdatedAt: string | null;
  briefUpdaterName: string | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function ProjectBrief({ projectId, initialBrief, briefUpdatedAt: initialUpdatedAt, briefUpdaterName: initialUpdaterName }: Props) {
  const [content, setContent] = useState(initialBrief ?? '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [updaterName, setUpdaterName] = useState(initialUpdaterName);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContent = useRef(content);

  const save = useCallback(async (text: string) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/projects/${projectId}/brief`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: text }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUpdatedAt(data.briefUpdatedAt);
      setUpdaterName(data.briefUpdaterName);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [projectId]);

  const handleChange = useCallback((json: string) => {
    setContent(json);
    latestContent.current = json;
    setSaveStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(latestContent.current), 1500);
  }, [save]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        save(latestContent.current);
      }
    };
  }, [save]);

  const metaText = updatedAt
    ? `Terakhir diubah ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: idLocale })}${updaterName ? ` oleh ${updaterName}` : ''}`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span className="text-sm font-medium">Brief</span>
        </div>
        <div className="flex items-center gap-3">
          {metaText && (
            <span className="text-[11px] text-muted-foreground/60">{metaText}</span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-[11px] text-muted-foreground animate-pulse">Menyimpan…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[11px] text-emerald-500">Tersimpan</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-[11px] text-destructive">Gagal simpan</span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border min-h-[400px]">
        <BlockEditor
          content={content}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
