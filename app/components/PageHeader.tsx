'use client';

import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';

const ROUTE_MAP: Record<string, string> = {
  '/dashboard':            'nav_dashboard',
  '/inbox':                'nav_inbox',
  '/brain':                'nav_brain',
  '/brain/search':         'nav_brain',
  '/brain/daily':          'nav_brain',
  '/brain/digest':         'nav_brain',
  '/brain/todo':           'nav_brain',
  '/brain/graph':          'nav_brain',
  '/canvas':               'nav_canvas',
  '/canvas/board':         'nav_canvas',
  '/ai':                   'nav_ai_agent',
  '/calendar':             'nav_calendar',
  '/analytics':            'nav_analytics',
  '/settings':             'nav_settings',
  '/settings/whatsapp':    'nav_settings',
  '/settings/project':     'nav_settings',
  '/settings/team':        'nav_settings',
  '/settings/integrations':'nav_settings',
  '/settings/brain':       'nav_settings',
  '/settings/ai-manage':   'nav_settings',
  '/settings/developer':   'nav_settings',
  '/settings/appearance':  'nav_settings',
  '/admin':                'nav_admin',
  '/onboarding':           'nav_dashboard',
};

const SETTINGS_SUBROUTE_MAP: Record<string, string> = {
  '/settings/whatsapp':     'WhatsApp',
  '/settings/project':      'Project',
  '/settings/team':         'Team',
  '/settings/integrations': 'Integrations',
  '/settings/brain':        'Brain',
  '/settings/ai-manage':    'AI Manage',
  '/settings/developer':    'Developer',
  '/settings/appearance':   'Appearance',
};

const BRAIN_SUBROUTE_MAP: Record<string, string> = {
  '/brain/search':  'Search',
  '/brain/daily':   'Daily Log',
  '/brain/digest':  'Digest',
  '/brain/todo':    'To-Do',
  '/brain/graph':   'Graph',
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
  const brainSubLabel = BRAIN_SUBROUTE_MAP[pathname] ?? null;

  // Group pages (canvas/:id, brain/notes/:id, group/:id)
  const isGroupDetail = pathname.startsWith('/group/');
  const isCanvasDetail = pathname.startsWith('/canvas/') && !pathname.startsWith('/canvas/board') && pathname !== '/canvas';
  const isBrainNote = pathname.startsWith('/brain/notes/') || pathname.startsWith('/brain/spaces/');

  if (!sectionLabel && !isGroupDetail && !isCanvasDetail && !isBrainNote) return null;

  const subLabel = settingsSubLabel ?? brainSubLabel ?? (isGroupDetail ? 'Group' : isCanvasDetail ? 'Canvas' : isBrainNote ? 'Note' : null);

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
          {isGroupDetail ? 'Group' : isCanvasDetail ? 'Canvas' : isBrainNote ? 'Note' : ''}
        </span>
      )}
    </nav>
  );
}
