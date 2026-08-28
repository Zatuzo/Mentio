'use client';

import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';

const ROUTE_MAP: Record<string, string> = {
  '/dashboard':             'nav_dashboard',
  '/inbox':                 'nav_inbox',
  '/calendar':              'nav_calendar',
  '/settings':              'nav_settings',
  '/settings/whatsapp':     'nav_settings',
  '/settings/project':      'nav_settings',
  '/settings/team':         'nav_settings',
  '/settings/integrations': 'nav_settings',
  '/settings/appearance':   'nav_settings',
  '/onboarding':            'nav_dashboard',
};

const SETTINGS_SUBROUTE_MAP: Record<string, string> = {
  '/settings/whatsapp':     'WhatsApp',
  '/settings/project':      'Project',
  '/settings/team':         'Team',
  '/settings/integrations': 'Integrations',
  '/settings/appearance':   'Appearance',
};

export function PageHeader() {
  const pathname = usePathname();
  const t = useT();

  // Find the best matching route
  const matchedKey = Object.keys(ROUTE_MAP)
    .filter((k) => pathname === k || pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0];

  const sectionKey = matchedKey ? ROUTE_MAP[matchedKey] : null;
  const sectionLabel = sectionKey ? t(sectionKey as any) : null;

  // Check for sub-routes
  const settingsSubLabel = SETTINGS_SUBROUTE_MAP[pathname] ?? null;

  // Group pages (group/:id)
  const isGroupDetail = pathname.startsWith('/group/');

  if (!sectionLabel && !isGroupDetail) return null;

  const subLabel = settingsSubLabel ?? (isGroupDetail ? 'Group' : null);

  return (
    <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
      {sectionLabel ? (
        <>
          <span className="text-muted-foreground font-medium truncate">{sectionLabel}</span>
          {subLabel && (
            <>
              <span className="text-muted-foreground/40 select-none">/</span>
              <span className="text-foreground font-medium truncate">{subLabel}</span>
            </>
          )}
        </>
      ) : (
        <span className="text-foreground font-medium truncate">
          {isGroupDetail ? 'Group' : ''}
        </span>
      )}
    </nav>
  );
}
