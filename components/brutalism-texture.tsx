'use client';

import { useThemeVariant } from '@/hooks/use-theme-variant';

export function BrutalismTexture() {
  const variant = useThemeVariant();
  if (variant !== 'brutalism') return null;

  return (
    <>
      {/* Mechanical grain noise via SVG feTurbulence */}
      <svg className="pointer-events-none fixed inset-0 z-[9998] h-full w-full opacity-[0.035]" aria-hidden>
        <filter id="brutalism-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#brutalism-noise)" />
      </svg>

      {/* Corner registration marks */}
      <div className="pointer-events-none fixed inset-0 z-[9997]" aria-hidden>
        {/* TL */}
        <span className="absolute top-3 left-3 text-[10px] font-mono text-foreground/15 select-none tracking-widest">
          REV 2.6 / UNIT-01
        </span>
        {/* TR */}
        <span className="absolute top-3 right-3 text-[10px] font-mono text-foreground/15 select-none tracking-widest">
          SYS: ACTIVE
        </span>
        {/* BL */}
        <span className="absolute bottom-3 left-3 text-[10px] font-mono text-foreground/15 select-none tracking-widest">
          © MENTIO SYSTEMS
        </span>
        {/* BR */}
        <span className="absolute bottom-3 right-3 text-[10px] font-mono text-foreground/15 select-none tracking-widest">
          ▓▒░ STANDBY
        </span>
      </div>
    </>
  );
}
