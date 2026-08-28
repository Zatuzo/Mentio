import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import { SettingsNav, SettingsNavMobile } from '@/app/components/SettingsNav';

export const dynamic = 'force-dynamic';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as any;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {user.name} · {user.email} ·{' '}
          <span className={user.plan === 'pro' ? 'text-emerald-400' : 'text-muted-foreground'}>
            {user.plan} plan
          </span>
        </p>
      </div>

      {/* Mobile: horizontal tab nav */}
      <div className="md:hidden mb-6">
        <SettingsNavMobile />
      </div>

      {/* Desktop: sidebar layout */}
      <div className="grid gap-8 md:grid-cols-[180px_1fr]">
        <aside className="hidden md:block">
          <SettingsNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
