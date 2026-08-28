'use client';

import { useCallback, useRef, useState } from 'react';
import type { Editor } from '@tldraw/tldraw';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Link2, Link2Off, Check, Loader2 } from 'lucide-react';
import { MentioCanvas } from './MentioCanvas';
import { GifPicker } from './GifPicker';
import { TldrawContainer } from './TldrawContainer';
import { toast } from 'sonner';

interface Props {
  canvasId: string;
  entityId: string;
  name: string;
  isOwner: boolean;
  shareToken: string | null;
  currentUser: { id: string; name: string };
}

export function CanvasEditor({ canvasId, entityId, name: initialName, isOwner, shareToken: initialToken, currentUser }: Props) {
  const router = useRouter();
  const editorRef = useRef<Editor | null>(null);
  const [name, setName] = useState(initialName);
  const [shareToken, setShareToken] = useState(initialToken);
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveName = async (newName: string) => {
    const trimmed = newName.trim() || 'Untitled Canvas';
    setName(trimmed);
    setEditing(false);
    await fetch(`/api/canvases/${canvasId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
  };

  const toggleShare = useCallback(async () => {
    setToggling(true);
    const enabling = !shareToken;
    const res = await fetch(`/api/canvases/${canvasId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharing: enabling }),
    });
    setToggling(false);
    if (!res.ok) { toast.error('Gagal update sharing'); return; }
    const updated = await res.json();
    setShareToken(updated.shareToken);
    if (enabling && updated.shareToken) {
      const link = `${window.location.origin}/canvas/${canvasId}?token=${updated.shareToken}`;
      await navigator.clipboard.writeText(link);
      toast.success('Link sharing aktif & disalin!');
    } else {
      toast.success('Link sharing dinonaktifkan');
    }
  }, [canvasId, shareToken]);

  const copyLink = useCallback(async () => {
    if (!shareToken) return;
    const link = `${window.location.origin}/canvas/${canvasId}?token=${shareToken}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link disalin!');
  }, [canvasId, shareToken]);

  return (
    <div className="flex flex-col h-full" style={{ overscrollBehavior: 'none' }}>
      {/* Top bar — above tldraw, never overlaps tldraw UI */}
      <div className="flex items-center gap-1.5 px-2 h-10 border-b border-border bg-background shrink-0 min-w-0">
        <button
          onClick={() => router.push('/canvas')}
          className="flex items-center justify-center h-7 w-7 shrink-0 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>

        {isOwner && editing ? (
          <input
            defaultValue={name}
            className="text-sm font-medium bg-transparent border-b border-primary outline-none px-0.5 min-w-0 flex-1"
            autoFocus
            onBlur={(e) => saveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className={`text-sm font-medium truncate flex-1 min-w-0 ${isOwner ? 'cursor-pointer hover:text-primary' : ''}`}
            onClick={() => isOwner && setEditing(true)}
            title={isOwner ? 'Klik untuk rename' : name}
          >
            {name}
          </span>
        )}

        {/* GIF — semua user yang punya akses bisa insert */}
        <GifPicker editorRef={editorRef} />

        {/* Share controls — owner only */}
        {isOwner && (
          <>
            {shareToken && (
              <button
                onClick={copyLink}
                title={copied ? 'Disalin!' : 'Salin link sharing'}
                className="flex items-center justify-center h-7 w-7 shrink-0 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
              </button>
            )}
            <button
              onClick={toggleShare}
              disabled={toggling}
              title={shareToken ? 'Nonaktifkan link sharing' : 'Aktifkan link sharing'}
              className="flex items-center justify-center h-7 w-7 shrink-0 rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              {toggling ? <Loader2 className="size-3.5 animate-spin" /> : shareToken ? <Link2Off className="size-3.5" /> : <Link2 className="size-3.5" />}
            </button>
          </>
        )}

        {!isOwner && (
          <span title="Akses via link">
            <Link2 className="size-3.5 text-muted-foreground shrink-0" />
          </span>
        )}
      </div>

      <TldrawContainer className="flex-1 min-h-0">
        <MentioCanvas
          roomId={`user-${entityId}`}
          currentUser={currentUser}
          className="h-full w-full"
          onEditorReady={(editor) => { editorRef.current = editor; }}
        />
      </TldrawContainer>
    </div>
  );
}
