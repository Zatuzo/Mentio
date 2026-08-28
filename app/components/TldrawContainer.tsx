'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wrapper untuk tldraw canvas.
 * Menambahkan non-passive touchstart listener untuk mencegah Android Chrome
 * mengambil alih touch sequence (yang menyebabkan drawing hanya menghasilkan titik-titik).
 * CSS touch-action:none saja tidak cukup di Chrome Android karena browser bisa
 * tetap fire pointercancel jika ada ancestor dengan scroll behavior.
 */
export function TldrawContainer({ children, className, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', preventDefault, { passive: false });
    return () => el.removeEventListener('touchstart', preventDefault);
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ touchAction: 'none', overscrollBehavior: 'none', ...style }}
    >
      {children}
    </div>
  );
}
