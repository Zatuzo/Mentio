'use client';

import { ShapeUtil, Rectangle2d, type TLBaseShape, HTMLContainer } from '@tldraw/tldraw';

export const CARD_W = 220;
export const CARD_H = 88;

export type TaskCardShape = TLBaseShape<
  'task-card',
  {
    taskId: string;
    title: string;
    priority: string;
    status: string;
    assignee: string | null;
    groupName: string | null;
    w: number;
    h: number;
  }
>;

const PRIORITY_DOT: Record<string, string> = {
  urgent: '#ef4444',
  high:   '#fb923c',
  medium: '#facc15',
  low:    '#60a5fa',
  none:   '#9ca3af',
};

export class TaskCardShapeUtil extends ShapeUtil<TaskCardShape> {
  static override type = 'task-card' as const;

  getDefaultProps(): TaskCardShape['props'] {
    return {
      taskId: '',
      title: 'Untitled',
      priority: 'none',
      status: 'todo',
      assignee: null,
      groupName: null,
      w: CARD_W,
      h: CARD_H,
    };
  }

  override canEdit = () => false;
  override canResize = () => false;
  override isAspectRatioLocked = () => true;

  getGeometry(shape: TaskCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: TaskCardShape) {
    const { title, priority, assignee, groupName } = shape.props;
    const dotColor = PRIORITY_DOT[priority] ?? PRIORITY_DOT.none;

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'all',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--color-background, #1c1c1c)',
            border: '1px solid var(--color-border, #333)',
            borderRadius: 8,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            boxSizing: 'border-box',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          {/* Priority dot + title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dotColor,
                marginTop: 4,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1.35,
                color: 'var(--color-text, #e5e7eb)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {title}
            </span>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 'auto' }}>
            {assignee && (
              <span
                style={{
                  fontSize: 10,
                  background: 'rgba(99,102,241,0.2)',
                  color: '#a5b4fc',
                  borderRadius: 4,
                  padding: '1px 5px',
                  maxWidth: 90,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {assignee}
              </span>
            )}
            {groupName && (
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--color-text-3, #6b7280)',
                  maxWidth: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {groupName}
              </span>
            )}
          </div>
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: TaskCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }
}
