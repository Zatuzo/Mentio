'use client';
import { useSession, signOut } from '@/app/lib/auth-client';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Palette, LogOut, Settings } from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useT } from '@/lib/i18n';
import { useState } from 'react';

function UserAvatar({
  name,
  image,
  size = 'sm',
}: {
  name: string;
  image?: string | null;
  size?: 'sm' | 'md';
}) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm';

  return (
    <div
      className={`${dim} rounded-full bg-muted border border-border flex items-center justify-center font-semibold text-foreground overflow-hidden shrink-0`}
    >
      {image ? (
        <img src={image} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

export function UserNav() {
  const { data: session } = useSession();
  const t = useT();
  const [showAppearance, setShowAppearance] = useState(false);

  if (!session) return null;
  const user = session.user as any;
  const plan = user.plan || 'free';

  async function handleSignOut() {
    await signOut();
    window.location.href = '/login';
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <UserAvatar
          name={session.user.name ?? ''}
          image={(session.user as any).image}
        />
        <span className="hidden sm:block max-w-[100px] truncate font-medium text-foreground text-sm">
          {session.user.name}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* User info header — static content, not a menu item */}
        <div className="px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-2">
            <UserAvatar
              name={session.user.name ?? ''}
              image={(session.user as any).image}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-foreground">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {session.user.email}
              </p>
            </div>
          </div>
          <Badge
            variant={plan === 'pro' ? 'default' : 'secondary'}
            className="text-[10px] h-4"
          >
            {plan}
          </Badge>
        </div>

        <DropdownMenuSeparator />

        {/* Appearance inline toggle */}
        <div className="px-3 py-2">
          <button
            onClick={() => setShowAppearance((v) => !v)}
            className="flex w-full items-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors"
          >
            <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
            {t('appearance_theme')}
          </button>
          {showAppearance && (
            <div className="mt-3 space-y-3">
              <ThemeSwitcher compact />
              <LanguageSwitcher />
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Settings */}
        <DropdownMenuItem onClick={() => { window.location.href = '/settings'; }}>
          <Settings className="h-4 w-4 text-muted-foreground" />
          {t('nav_settings')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Sign out */}
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {t('btn_sign_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
