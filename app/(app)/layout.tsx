import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/app/lib/session';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/app/components/AppSidebar';
import { BrutalismTexture } from '@/components/brutalism-texture';
import { PageTransition } from '@/app/components/PageTransition';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect('/login');

  // Default collapsed (icon-only). Cookie 'true' = expanded.
  const sidebarOpen = cookies().get('sidebar_state')?.value === 'true';

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <BrutalismTexture />
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden shadow-xl bg-card">
        <div className="flex-1 p-4 pb-24 md:pb-6 md:p-6 lg:p-8 min-w-0 overflow-x-hidden">
          <PageTransition>{children}</PageTransition>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
