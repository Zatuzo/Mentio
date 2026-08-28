'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Tldraw,
  type Editor,
  createShapeId,
  type TLShapeId,
  inlineBase64AssetStore,
  defaultShapeUtils,
} from '@tldraw/tldraw';
import { useSync } from '@tldraw/sync';
import '@tldraw/tldraw/tldraw.css';
import { TaskCardShapeUtil, CARD_W, CARD_H, type TaskCardShape } from './TaskCardShapeUtil';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { GifPicker } from './GifPicker';
import { TldrawContainer } from './TldrawContainer';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:1999';

// Layout constants
const COL_W = CARD_W + 40;       // column width including padding
const COL_GAP = 32;              // gap between columns
const COL_STEP = COL_W + COL_GAP; // total step per column
const CARD_GAP = 14;             // vertical gap between cards
const HEADER_H = 48;             // column header height
const CARDS_START_Y = HEADER_H + 16;

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo: { id: string; name: string } | null;
  group: { id: string; name: string } | null;
}

interface Status {
  id: string;
  slug: string;
  label: string;
  color: string;
  order: number;
}

const SHAPE_UTILS = [TaskCardShapeUtil];
// Must be module-level (not inline in JSX/useSync) — new array ref on every render causes infinite re-render loop
const ALL_SHAPE_UTILS = [...defaultShapeUtils, ...SHAPE_UTILS];

function getColX(colIndex: number) {
  return colIndex * COL_STEP;
}

function getColIndexFromX(x: number, colCount: number) {
  const raw = Math.round(x / COL_STEP);
  return Math.max(0, Math.min(colCount - 1, raw));
}

function buildBoard(editor: Editor, tasks: Task[], statuses: Status[]) {
  // Remove previous board shapes
  const existing = editor.getCurrentPageShapes().map((s) => s.id);
  if (existing.length) editor.deleteShapes(existing);

  const shapesToCreate: Parameters<typeof editor.createShapes>[0] = [];

  // Column counters for stacking cards
  const colCounts: number[] = statuses.map(() => 0);

  // Column headers (text shapes)
  statuses.forEach((status, colIndex) => {
    shapesToCreate.push({
      id: createShapeId(`col-header-${status.slug}`),
      type: 'text',
      x: getColX(colIndex),
      y: 0,
      props: {
        text: status.label.toUpperCase(),
        size: 's',
        font: 'mono',
        textAlign: 'start',
        autoSize: true,
        w: COL_W,
        scale: 1,
      },
    });
  });

  // Task cards
  tasks.forEach((task) => {
    const colIndex = statuses.findIndex((s) => s.slug === task.status);
    if (colIndex === -1) return;

    const row = colCounts[colIndex];
    colCounts[colIndex]++;

    shapesToCreate.push({
      id: createShapeId(`task-${task.id}`),
      type: 'task-card',
      x: getColX(colIndex),
      y: CARDS_START_Y + row * (CARD_H + CARD_GAP),
      props: {
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        assignee: task.assignedTo?.name ?? null,
        groupName: task.group?.name ?? null,
        w: CARD_W,
        h: CARD_H,
      },
    });
  });

  editor.createShapes(shapesToCreate);
  editor.zoomToFit({ animation: { duration: 300 } });
}

interface Props {
  projectId: string;
  currentUser?: { id: string; name: string } | null;
}

const PRESENCE_COLORS = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#7048e8', '#c2255c'];
function presenceColor(id: string) {
  const hash = id.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

export function BoardCanvas({ projectId, currentUser }: Props) {
  const store = useSync({
    uri: `${WS_BASE}/canvas-ws?roomId=${encodeURIComponent(`board-${projectId}`)}`,
    assets: inlineBase64AssetStore,
    userInfo: { id: currentUser?.id ?? 'anon', name: currentUser?.name ?? 'Anonymous', color: presenceColor(currentUser?.id ?? 'anon') },
    shapeUtils: ALL_SHAPE_UTILS,
  });

  const [fullscreen, setFullscreen] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const tasksRef = useRef<Task[]>([]);
  const statusesRef = useRef<Status[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAndBuild = useCallback(async (editor: Editor) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/canvas/board?projectId=${projectId}`);
      const data = await res.json();
      tasksRef.current = data.tasks ?? [];
      statusesRef.current = data.statuses ?? [];
      buildBoard(editor, tasksRef.current, statusesRef.current);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Drag-end handler — detect column change and update status
    const unsubscribe = editor.store.listen(
      (entry) => {
        const statuses = statusesRef.current;
        if (!statuses.length) return;

        for (const record of Object.values(entry.changes.updated)) {
          const [prev, next] = record as [TaskCardShape, TaskCardShape];
          if (next?.type !== 'task-card') continue;

          const prevColIndex = getColIndexFromX(prev.x, statuses.length);
          const nextColIndex = getColIndexFromX(next.x, statuses.length);
          if (prevColIndex === nextColIndex) continue;

          const newStatus = statuses[nextColIndex]?.slug;
          if (!newStatus || newStatus === next.props.status) continue;

          // Snap card to column grid + update status prop optimistically
          editor.updateShape<TaskCardShape>({
            id: next.id,
            type: 'task-card',
            x: getColX(nextColIndex),
            props: { ...next.props, status: newStatus },
          });

          // Persist to DB
          fetch(`/api/tasks/${next.props.taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          }).catch(() => null);
        }
      },
      { scope: 'document', source: 'user' },
    );

    // Build board on first open (empty room) or on explicit refresh
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) fetchAndBuild(editor);

    return unsubscribe;
  }, [fetchAndBuild]);

  const handleRefresh = useCallback(() => {
    if (editorRef.current) fetchAndBuild(editorRef.current);
  }, [fetchAndBuild]);

  return (
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full w-full'}`} style={{ overscrollBehavior: 'none' }}>
      {/* Top bar — sits above tldraw, never covers its UI */}
      <div className="flex items-center gap-1.5 px-3 h-10 border-b border-border bg-background shrink-0">
        <button
          onClick={handleRefresh}
          title="Refresh board"
          disabled={loading}
          className="flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <div className="flex-1" />
        <GifPicker editorRef={editorRef} />
        <button
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>

      <TldrawContainer className="flex-1 min-h-0">
        <Tldraw
          store={store}
          shapeUtils={SHAPE_UTILS}
          onMount={handleMount}
          inferDarkMode
          hideUi={false}
        />
      </TldrawContainer>
    </div>
  );
}
