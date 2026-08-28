'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, User, Inbox, CalendarDays, BarChart2, Sparkles, Brain, PenLine } from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useT } from '@/lib/i18n';
import { useThemeVariant } from '@/hooks/use-theme-variant';
import { cn } from '@/lib/utils';

interface Props {
  isOwner: boolean;
  unreadCount?: number;
  newDumpCount?: number;
}

// ── Default variant (dark / light / nord / mocha / sunset) ──────────────
function SidebarNavDefault({ isOwner, unreadCount = 0, newDumpCount = 0 }: Props) {
  const pathname = usePathname();
  const t = useT();

  const items = [
    { href: '/dashboard', labelKey: 'nav_dashboard'  as const, icon: LayoutDashboard, badge: 0 },
    { href: '/inbox',     labelKey: 'nav_inbox'      as const, icon: Inbox,           badge: unreadCount },
    { href: '/brain',     labelKey: 'nav_brain'      as const, icon: Brain,           badge: newDumpCount },
    { href: '/canvas',    labelKey: 'nav_canvas'     as const, icon: PenLine,         badge: 0 },
    { href: '/ai',        labelKey: 'nav_ai_agent'   as const, icon: Sparkles,        badge: 0 },
    { href: '/calendar',  labelKey: 'nav_calendar'   as const, icon: CalendarDays,    badge: 0 },
    { href: '/analytics', labelKey: 'nav_analytics'  as const, icon: BarChart2,       badge: 0 },
    { href: '/settings',  labelKey: 'nav_settings'   as const, icon: Settings,        badge: 0 },
    ...(isOwner ? [{ href: '/admin', labelKey: 'nav_admin' as const, icon: User, badge: 0 }] : []),
  ];

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton render={<Link href={item.href} />} isActive={active}>
                  <Icon />
                  <span>{t(item.labelKey)}</span>
                  {item.badge > 0 && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary min-w-[1.25rem] text-center">
                      {item.badge}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ── Brutalism variant (Swiss Industrial Print) ──────────────────────────
const BRUTALISM_RED = '#E61919';

function SidebarNavBrutalism({ isOwner, unreadCount = 0, newDumpCount = 0 }: Props) {
  const pathname = usePathname();
  const t = useT();

  const items = [
    { href: '/dashboard', labelKey: 'nav_dashboard' as const, code: 'D-01', badge: 0 },
    { href: '/inbox',     labelKey: 'nav_inbox'     as const, code: 'D-02', badge: unreadCount },
    { href: '/brain',     labelKey: 'nav_brain'     as const, code: 'D-03', badge: newDumpCount },
    { href: '/canvas',    labelKey: 'nav_canvas'    as const, code: 'D-04', badge: 0 },
    { href: '/ai',        labelKey: 'nav_ai_agent'  as const, code: 'D-05', badge: 0 },
    { href: '/calendar',  labelKey: 'nav_calendar'  as const, code: 'D-06', badge: 0 },
    { href: '/analytics', labelKey: 'nav_analytics' as const, code: 'D-07', badge: 0 },
    { href: '/settings',  labelKey: 'nav_settings'  as const, code: 'SYS-1', badge: 0 },
    ...(isOwner ? [{ href: '/admin', labelKey: 'nav_admin' as const, code: 'SYS-2', badge: 0 }] : []),
  ];

  return (
    <div className="mx-2 mt-2 border-2 border-foreground font-mono">
      {/* Section header */}
      <div className="border-b-2 border-foreground bg-foreground/[0.06] px-3 py-1 text-[9px] tracking-[0.18em] text-muted-foreground select-none">
        // NAVIGATION
      </div>

      {items.map((item, i) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const label = t(item.labelKey).toUpperCase();
        const isLast = i === items.length - 1;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-between px-3 py-2.5 text-[11px] tracking-[0.1em]',
              !isLast && 'border-b border-foreground/20',
              active
                ? 'bg-foreground text-background'
                : 'text-foreground hover:bg-foreground/[0.06]'
            )}
            style={active ? { borderLeft: `3px solid ${BRUTALISM_RED}` } : { borderLeft: '3px solid transparent' }}
          >
            <span className="font-bold">
              {active ? `[${label}]` : label}
            </span>
            <span className={cn(
              'text-[9px] tabular-nums font-normal',
              active ? 'text-background/60' : ''
            )}>
              {item.badge > 0
                ? <span style={{ color: active ? undefined : BRUTALISM_RED }} className="font-bold">{String(item.badge).padStart(2, '0')}</span>
                : <span className="opacity-30">{item.code}</span>
              }
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────────────────
export function SidebarNav(props: Props) {
  const variant = useThemeVariant();
  if (variant === 'brutalism') return <SidebarNavBrutalism {...props} />;
  return <SidebarNavDefault {...props} />;
}

