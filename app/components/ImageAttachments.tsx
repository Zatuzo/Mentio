'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X, Loader2, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
  readonly?: boolean;
  maxImages?: number;
}

function Lightbox({
  urls,
  index,
  onClose,
  onNav,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNav((index + 1) % urls.length);
      if (e.key === 'ArrowLeft') onNav((index - 1 + urls.length) % urls.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, urls.length, onClose, onNav]);

  const hasPrev = urls.length > 1;
  const hasNext = urls.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* close */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* counter */}
      {urls.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
          {index + 1} / {urls.length}
        </div>
      )}

      {/* prev */}
      {hasPrev && (
        <button
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); onNav((index - 1 + urls.length) % urls.length); }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt={`image ${index + 1}`}
        className="max-w-[88vw] max-h-[88vh] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* next */}
      {hasNext && (
        <button
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); onNav((index + 1) % urls.length); }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>,
    document.body
  );
}

export function ImageAttachments({ urls, onChange, readonly = false, maxImages = 20 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File): Promise<string | null> {
    // Try presigned direct-to-R2 upload first (bypasses Nginx entirely)
    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mimeType: file.type }),
    });

    if (presignRes.ok) {
      const { uploadUrl, publicUrl } = await presignRes.json();
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!putRes.ok) { toast.error('Upload to R2 failed'); return null; }
      return publicUrl as string;
    }

    // Fallback: server-side upload via /api/upload
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? 'Upload failed');
      return null;
    }
    const { url } = await res.json();
    return url as string;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = maxImages - urls.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploading(true);
    try {
      const results = await Promise.all(toUpload.map(uploadFile));
      const uploaded = results.filter(Boolean) as string[];
      if (uploaded.length > 0) onChange([...urls, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove(url: string) {
    onChange(urls.filter((u) => u !== url));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [urls]); // eslint-disable-line react-hooks/exhaustive-deps

  if (readonly && urls.length === 0) return null;

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={url} className="relative group">
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="block rounded-lg overflow-hidden border border-border hover:border-foreground/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`attachment ${i + 1}`}
                  className="w-20 h-20 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
              {!readonly && (
                <button
                  type="button"
                  onClick={() => remove(url)}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readonly && urls.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImagePlus className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Uploading...' : 'Add image'}
          </button>
          <span className="text-[11px] text-muted-foreground">or drag & drop</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          urls={urls}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={setLightboxIndex}
        />
      )}
    </div>
  );
}
