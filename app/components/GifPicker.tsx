'use client';

import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Editor } from '@tldraw/tldraw';
import { AssetRecordType } from '@tldraw/tldraw';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import type { GifResult } from '@/app/api/gif/route';

interface Props {
  editorRef: RefObject<Editor | null>;
}

export function GifPicker({ editorRef }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/gif?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Gagal load GIF');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const insertGif = useCallback((gif: GifResult) => {
    const editor = editorRef.current;
    if (!editor) return;

    const assetId = AssetRecordType.createId();
    const bounds = editor.getViewportPageBounds();
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;

    editor.run(() => {
      editor.createAssets([{
        id: assetId,
        typeName: 'asset',
        type: 'image',
        props: {
          src: gif.url,
          w: gif.w,
          h: gif.h,
          mimeType: 'image/gif',
          isAnimated: true,
          name: gif.title || 'gif',
        },
        meta: {},
      }]);

      editor.createShape({
        type: 'image',
        x: cx - gif.w / 2,
        y: cy - gif.h / 2,
        props: { assetId, w: gif.w, h: gif.h },
      });
    });

    setOpen(false);
  }, [editorRef]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        title="Add GIF"
        className="flex items-center justify-center h-7 px-2 rounded-md bg-background/80 border border-border text-muted-foreground hover:text-foreground hover:bg-background transition-colors backdrop-blur-sm text-xs font-bold tracking-tight"
      >
        GIF
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-2 space-y-2"
      >
        <Input
          ref={inputRef}
          placeholder="Cari GIF..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(query)}
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        {loading && (
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-video rounded bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-3 gap-1 max-h-72 overflow-y-auto">
            {results.map((gif) => (
              <button
                key={gif.id}
                onClick={() => insertGif(gif)}
                className="relative aspect-video overflow-hidden rounded hover:ring-2 hover:ring-primary transition-all"
                title={gif.title}
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {!loading && results.length === 0 && query && !error && (
          <p className="text-xs text-muted-foreground text-center py-4">Tidak ada hasil</p>
        )}

        {!loading && results.length === 0 && !query && (
          <p className="text-xs text-muted-foreground text-center py-4">Ketik lalu tekan Enter</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
