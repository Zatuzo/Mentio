'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, FolderKanban, Users, Puzzle, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useThemeVariant } from '@/hooks/use-theme-variant';

const NAV_ITEMS = [
  { href: '/settings/whatsapp',     labelKey: 'settings_whatsapp',     icon: MessageCircle },
  { href: '/settings/project',      labelKey: 'settings_project',      icon: FolderKanban  },
  { href: '/settings/team',         labelKey: 'settings_team',         icon: Users         },
  { href: '/settings/integrations', labelKey: 'settings_integrations', icon: Puzzle        },
  { href: '/settings/appearance',   labelKey: 'settings_appearance',   icon: Palette       },
] as const;

// ── Default variant ──────────────────────────────────────────────────────
function SettingsNavDefault() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Brutalism variant ────────────────────────────────────────────────────
const BRUTALISM_RED = '#E61919';

function SettingsNavBrutalism() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="border-2 border-foreground font-mono">
      {/* Section header */}
      <div className="border-b-2 border-foreground bg-foreground/[0.06] px-3 py-1 text-[9px] tracking-[0.18em] text-muted-foreground select-none">
        // CONFIG
      </div>

      {NAV_ITEMS.map((item, i) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const label = t(item.labelKey).toUpperCase();
        const isLast = i === NAV_ITEMS.length - 1;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-0 px-3 py-2.5 text-[11px] tracking-[0.1em]',
              !isLast && 'border-b border-foreground/20',
              active
                ? 'bg-foreground/[0.07] text-foreground font-bold'
                : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
            )}
            style={active ? { borderLeft: `3px solid ${BRUTALISM_RED}` } : { borderLeft: '3px solid transparent' }}
          >
            <span className="flex-1">
              {active ? `→ ${label}` : `  ${label}`}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Mobile variant: horizontal scrollable tabs ──────────────────────────
export function SettingsNavMobile() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs rounded-md whitespace-nowrap shrink-0 border transition-colors',
              active
                ? 'bg-foreground text-background border-foreground font-medium'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Router ───────────────────────────────────────────────────────────────
export function SettingsNav() {
  const variant = useThemeVariant();
  if (variant === 'brutalism') return <SettingsNavBrutalism />;
  return <SettingsNavDefault />;
}
