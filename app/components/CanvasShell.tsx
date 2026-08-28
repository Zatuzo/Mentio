'use client';

import { useCallback, useRef, useState } from 'react';
import type { Editor } from '@tldraw/tldraw';
import { Maximize2, Minimize2 } from 'lucide-react';
import { MentioCanvas } from './MentioCanvas';
import { GifPicker } from './GifPicker';
import { TldrawContainer } from './TldrawContainer';

interface Props {
  roomId: string;
  seedContent?: { title: string; body: string } | null;
  currentUser?: { id: string; name: string } | null;
}

export function CanvasShell({ roomId, seedContent, currentUser }: Props) {
  const editorRef = useRef<Editor | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => setFullscreen((v) => !v), []);

  return (
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full w-full'}`} style={{ overscrollBehavior: 'none' }}>
      {/* Top bar — above tldraw, never covers its UI */}
      <div className="flex items-center gap-1.5 px-3 h-10 border-b border-border bg-background shrink-0">
        <div className="flex-1" />
        <GifPicker editorRef={editorRef} />
        <button
          onClick={toggleFullscreen}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>

      <TldrawContainer className="flex-1 min-h-0">
        <MentioCanvas
          roomId={roomId}
          seedContent={seedContent}
          currentUser={currentUser}
          className="h-full w-full"
          onEditorReady={(editor) => { editorRef.current = editor; }}
        />
      </TldrawContainer>
    </div>
  );
}
