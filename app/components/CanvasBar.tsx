'use client';

import type { ReactNode } from 'react';

interface Props {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function CanvasBar({ left, center, right }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background shrink-0 z-10">
      {left && <div className="flex items-center gap-1.5">{left}</div>}
      {center && <div className="flex-1 flex items-center justify-center">{center}</div>}
      <div className="flex-1" />
      {right && <div className="flex items-center gap-1.5">{right}</div>}
    </div>
  );
}
