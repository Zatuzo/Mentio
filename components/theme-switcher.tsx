'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

type ThemeOption = {
  id: string;
  labelKey: 'theme_dark' | 'theme_light' | 'theme_brutalism' | 'theme_nord' | 'theme_mocha' | 'theme_sunset';
  bg: string;
  card: string;
  primary: string;
  noBorderRadius?: boolean;
};

const THEMES: ThemeOption[] = [
  { id: 'dark',       labelKey: 'theme_dark',       bg: '#111111', card: '#1c1c1c', primary: '#f5f5f5' },
  { id: 'light',      labelKey: 'theme_light',      bg: '#f8f8f8', card: '#ffffff', primary: '#1a1a1a' },
  { id: 'brutalism',  labelKey: 'theme_brutalism',  bg: '#ffffff', card: '#f0f0f0', primary: '#000000', noBorderRadius: true },
  { id: 'nord',       labelKey: 'theme_nord',       bg: '#2e3440', card: '#3b4252', primary: '#88c0d0' },
  { id: 'mocha',      labelKey: 'theme_mocha',      bg: '#1e1e2e', card: '#27273a', primary: '#cba6f7' },
  { id: 'sunset',     labelKey: 'theme_sunset',     bg: '#1a1008', card: '#241808', primary: '#e8a84a' },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useT();

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6')}>
      {THEMES.map((thm) => {
        const active = theme === thm.id;
        return (
          <button
            key={thm.id}
            onClick={() => setTheme(thm.id)}
            title={t(thm.labelKey)}
            className={cn(
              'group relative flex flex-col items-center gap-2 rounded-lg p-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'opacity-100' : 'opacity-70 hover:opacity-100'
            )}
          >
            {/* Preview swatch */}
            <div
              className={cn(
                'relative w-full overflow-hidden border-2 transition-all',
                thm.noBorderRadius ? 'rounded-none' : 'rounded-md',
                active ? 'border-primary shadow-md' : 'border-border'
              )}
              style={{ aspectRatio: '4/3', background: thm.bg }}
            >
              {/* Mini card inside preview */}
              <div
                className={cn('absolute left-2 right-2 top-2 bottom-2', thm.noBorderRadius ? 'rounded-none' : 'rounded')}
                style={{ background: thm.card }}
              />
              {/* Accent dot */}
              <div
                className={cn(
                  'absolute bottom-2 right-2 h-3 w-3',
                  thm.noBorderRadius ? 'rounded-none' : 'rounded-full'
                )}
                style={{ background: thm.primary }}
              />
              {/* Checkmark */}
              {active && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={cn(
                      'flex h-5 w-5 items-center justify-center',
                      thm.noBorderRadius ? 'rounded-none' : 'rounded-full'
                    )}
                    style={{ background: thm.primary }}
                  >
                    <Check className="h-3 w-3" style={{ color: thm.bg }} />
                  </div>
                </div>
              )}
            </div>

            <span
              className={cn(
                'text-xs font-medium leading-none',
                active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
              )}
            >
              {t(thm.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
