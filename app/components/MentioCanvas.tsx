'use client';

import { useCallback, useRef } from 'react';
import { Tldraw, type Editor, createShapeId, inlineBase64AssetStore } from '@tldraw/tldraw';
import { TldrawContainer } from './TldrawContainer';
import { useSync } from '@tldraw/sync';
import '@tldraw/tldraw/tldraw.css';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:1999';

const PRESENCE_COLORS = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#7048e8', '#c2255c'];
function presenceColor(id: string) {
  const hash = id.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

interface Props {
  roomId: string;
  className?: string;
  seedContent?: { title: string; body: string } | null;
  currentUser?: { id: string; name: string } | null;
  onEditorReady?: (editor: Editor) => void;
}

function seedNote(editor: Editor, title: string, body: string) {
  const titleId = createShapeId();
  const bodyId = createShapeId();
  editor.createShapes([
    { id: titleId, type: 'text', x: 80, y: 80, props: { text: title, size: 'xl', font: 'sans', textAlign: 'start', autoSize: true, w: 640, scale: 1 } },
    { id: bodyId, type: 'text', x: 80, y: 160, props: { text: body || '(empty)', size: 'm', font: 'sans', textAlign: 'start', autoSize: true, w: 640, scale: 1 } },
  ]);
  editor.zoomToFit({ animation: { duration: 0 } });
}

export function MentioCanvas({ roomId, className, seedContent, currentUser, onEditorReady }: Props) {
  const editorRef = useRef<Editor | null>(null);

  const store = useSync({
    uri: `${WS_BASE}/canvas-ws?roomId=${encodeURIComponent(roomId)}`,
    assets: inlineBase64AssetStore,
    userInfo: {
      id: currentUser?.id ?? 'anon',
      name: currentUser?.name ?? 'Anonymous',
      color: presenceColor(currentUser?.id ?? 'anon'),
    },
  });

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      onEditorReady?.(editor);
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0 && seedContent) {
        seedNote(editor, seedContent.title, seedContent.body);
      }
    },
    [seedContent, onEditorReady],
  );

  return (
    <TldrawContainer className={className ?? 'h-full w-full'}>
      <Tldraw store={store} onMount={handleMount} inferDarkMode />
    </TldrawContainer>
  );
}
