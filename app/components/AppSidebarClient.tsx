'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  Settings,
  Hash,
  Wifi,
  WifiOff,
  ChevronsUpDown,
  Plus,
  Check,
  LogOut,
} from 'lucide-react';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useThemeVariant } from '@/hooks/use-theme-variant';
import { signOut } from '@/app/lib/auth-client';
import { useRouter } from 'next/navigation';
import { CreateProjectModal } from './CreateProjectModal';

interface Props {
  isOwner: boolean;
  unreadCount: number;
  newDumpCount: number;
  connected: boolean;
  user: { name: string; email: string; plan: string };
  projects: { id: string; name: string; role: string }[];
  activeProjectId: string;
  projectGroups: { id: string; name: string }[];
}

export function AppSidebarClient({
  isOwner,
  unreadCount,
  newDumpCount,
  connected,
  user,
  projects,
  activeProjectId,
  projectGroups,
}: Props) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const pathname = usePathname();
  const t = useT();
  const variant = useThemeVariant();
  const router = useRouter();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  useEffect(() => {
    const handler = () => setCreateProjectOpen(true);
    window.addEventListener('open-create-project-modal', handler);
    return () => window.removeEventListener('open-create-project-modal', handler);
  }, []);

  const navItems = [
    { href: '/dashboard', labelKey: 'nav_dashboard' as const, icon: LayoutDashboard, badge: 0 },
    { href: '/inbox',     labelKey: 'nav_inbox'     as const, icon: Inbox,           badge: unreadCount },
    { href: '/calendar',  labelKey: 'nav_calendar'  as const, icon: CalendarDays,    badge: 0 },
    { href: '/settings',  labelKey: 'nav_settings'  as const, icon: Settings,        badge: 0 },
  ];

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  // Brutalism variant keeps its own nav style
  if (variant === 'brutalism') {
    const BRUTALISM_RED = '#E61919';
    return (
      <>
        <SidebarHeader className={cn(
          'flex md:pt-3.5',
          isCollapsed
            ? 'flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start'
            : 'flex-row items-center justify-between'
        )}>
          <a href="/dashboard" className="flex items-center gap-2 px-1">
            <img src="/logo-icon.png" alt="Mentio" className="h-7 w-7 object-contain dark:invert-0 invert" />
            {!isCollapsed && (
              <span className="font-bold font-mono tracking-tight text-sm">MENTIO</span>
            )}
          </a>
          <motion.div
            key={isCollapsed ? 'h-col' : 'h-exp'}
            className={cn('flex items-center gap-2', isCollapsed ? 'flex-row md:flex-col-reverse' : 'flex-row')}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
          >
            <SidebarTrigger />
          </motion.div>
        </SidebarHeader>

        <SidebarContent>
          <div className="mx-2 mt-2 border-2 border-foreground font-mono">
            <div className="border-b-2 border-foreground bg-foreground/[0.06] px-3 py-1 text-[9px] tracking-[0.18em] text-muted-foreground select-none">
              // NAVIGATION
            </div>
            {navItems.map((item, i) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              const label = t(item.labelKey).toUpperCase();
              const isLast = i === navItems.length - 1;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 text-[11px] tracking-[0.1em]',
                    !isLast && 'border-b border-foreground/20',
                    active ? 'bg-foreground text-background' : 'text-foreground hover:bg-foreground/[0.06]'
                  )}
                  style={active ? { borderLeft: `3px solid ${BRUTALISM_RED}` } : { borderLeft: '3px solid transparent' }}
                >
                  <span className="font-bold">{active ? `[${label}]` : label}</span>
                  {item.badge > 0 && (
                    <span style={{ color: active ? undefined : BRUTALISM_RED }} className="font-bold text-[9px]">
                      {String(item.badge).padStart(2, '0')}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </SidebarContent>

        <SidebarFooter className="px-2">
          <BrutalismUserFooter user={user} connected={connected} onSignOut={handleSignOut} />
        </SidebarFooter>
      </>
    );
  }

  // Default sidebar-02 style
  return (
    <>
      <SidebarHeader className={cn(
        'flex md:pt-3.5',
        isCollapsed
          ? 'flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start'
          : 'flex-row items-center justify-between'
      )}>
        <a href="/dashboard" className="flex items-center gap-2 px-1">
          <img src="/logo.png" alt="Mentio" className="h-7 w-7 object-contain dark:invert-0 invert" />
          {!isCollapsed && (
            <span className="font-bold text-2xl tracking-tight text-foreground">Mentio</span>
          )}
        </a>

        <motion.div
          key={isCollapsed ? 'header-collapsed' : 'header-expanded'}
          className={cn('flex items-center gap-2', isCollapsed ? 'flex-row md:flex-col-reverse' : 'flex-row')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <SidebarTrigger />
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-2">
        {/* Main nav */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={t(item.labelKey)}
                      isActive={active}
                      render={<Link href={item.href} className={cn(
                        'flex w-full items-center rounded-lg px-2 transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                        isCollapsed && 'justify-center'
                      )} />}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!isCollapsed && (
                        <span className="ml-2 flex-1 text-sm font-medium">{t(item.labelKey)}</span>
                      )}
                      {!isCollapsed && item.badge > 0 && (
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

        {/* Groups in Project */}
        {!isCollapsed && projectGroups.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Groups in Project</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectGroups.map((group) => (
                  <SidebarMenuItem key={group.id}>
                    <SidebarMenuButton
                      render={<Link href={`/group/${encodeURIComponent(group.id)}`} className={cn(
                        'flex w-full items-center rounded-lg px-2 transition-colors',
                        'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                      )} />}
                    >
                      <Hash className="size-3.5 shrink-0" />
                      <span className="ml-2 text-sm font-medium truncate">{group.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3 gap-1">
        {/* Workspace / Project switcher — TeamSwitcher pattern */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent/60 transition-colors text-left', isCollapsed && 'justify-center')}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground text-sm font-bold">
                  {(projects.find(p => p.id === activeProjectId)?.name ?? 'W')[0].toUpperCase()}
                </div>
                {!isCollapsed && <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Workspace</span>
                    <span className="truncate font-semibold text-sm">
                      {projects.find(p => p.id === activeProjectId)?.name ?? 'Select project'}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </>}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => {
                      document.cookie = `mentio_project_id=${project.id}; path=/; max-age=31536000`;
                      window.location.href = '/';
                    }}
                    className="gap-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm bg-sidebar-accent text-xs font-bold">
                      {project.name[0].toUpperCase()}
                    </div>
                    <span className="flex-1 truncate">{project.name}</span>
                    {activeProjectId === project.id && <Check className="size-4 shrink-0" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => window.dispatchEvent(new CustomEvent('open-create-project-modal'))}
                  className="gap-2 text-primary"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Plus className="size-3.5" />
                  </div>
                  New Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* User menu */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent/60 transition-colors text-left', isCollapsed && 'justify-center')}>
                <div className="size-8 shrink-0 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-accent-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {!isCollapsed && <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{user.name}</span>
                      <span className={cn(
                        'text-[9px] font-medium px-1 py-0.5 rounded-full shrink-0',
                        user.plan === 'pro' ? 'bg-primary/20 text-primary' : 'bg-sidebar-accent text-sidebar-accent-foreground'
                      )}>{user.plan}</span>
                    </div>
                    <span className={cn('text-xs flex items-center gap-1', connected ? 'text-muted-foreground' : 'text-destructive')}>
                      {connected ? <><Wifi className="size-2.5" />connected</> : <><WifiOff className="size-2.5" />disconnected</>}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </>}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56 mb-1">
                <div className="px-2 py-1.5 text-sm">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 size-4" />Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 size-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <CreateProjectModal open={createProjectOpen} onClose={() => setCreateProjectOpen(false)} />
    </>
  );
}

function BrutalismUserFooter({
  user,
  connected,
  onSignOut,
}: {
  user: { name: string; email: string; plan: string };
  connected: boolean;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <button className="w-full flex items-center gap-2 border-2 border-foreground px-3 py-2 font-mono text-xs hover:bg-foreground hover:text-background transition-colors" />
      }>
        <span className="font-bold truncate">{user.name.toUpperCase()}</span>
        <span className="ml-auto opacity-50">⌄</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-56 font-mono">
        <DropdownMenuItem onClick={() => window.location.href = '/settings'}>SETTINGS</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-destructive">SIGN OUT</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
