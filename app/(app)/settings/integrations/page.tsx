import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/db';
import { GoogleCalendarSettings } from '@/app/components/GoogleCalendarSettings';
import { TelegramSettings } from '@/app/components/TelegramSettings';
import { WaDumpSettings } from '@/app/components/WaDumpSettings';
import { TodoNotifSettings } from '@/app/components/TodoNotifSettings';
import { LmsSettings } from '@/app/components/LmsSettings';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [token, user, lmsConn] = await Promise.all([
    prisma.googleCalendarToken.findUnique({
      where: { userId: session.user.id },
      select: { syncEnabled: true, calendarId: true, createdAt: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { waDumpEnabled: true, dumpJid: true, dumpTaskEmoji: true },
    }),
    prisma.lmsConnection.findUnique({
      where: { userId: session.user.id },
      select: { icalUrl: true, lastSyncAt: true, lastSyncCount: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Integrations</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Hubungkan layanan eksternal untuk reminder dan capture notes.
        </p>
      </div>

      <GoogleCalendarSettings
        connected={!!token}
        syncEnabled={token?.syncEnabled ?? false}
        calendarId={token?.calendarId ?? null}
        connectedAt={token?.createdAt?.toISOString() ?? null}
      />

      <LmsSettings connection={lmsConn ? { ...lmsConn, lastSyncAt: lmsConn.lastSyncAt?.toISOString() ?? null } : null} />

      <TelegramSettings />

      <TodoNotifSettings />

      <WaDumpSettings
        waDumpEnabled={user?.waDumpEnabled ?? false}
        myJid={null}
        dumpTaskEmoji={user?.dumpTaskEmoji ?? '✅'}
      />
    </div>
  );
}
