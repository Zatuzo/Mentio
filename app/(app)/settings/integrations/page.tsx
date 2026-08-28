import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/db';
import { GoogleCalendarSettings } from '@/app/components/GoogleCalendarSettings';
import { TelegramSettings } from '@/app/components/TelegramSettings';
import { TodoNotifSettings } from '@/app/components/TodoNotifSettings';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const token = await prisma.googleCalendarToken.findUnique({
    where: { userId: session.user.id },
    select: { syncEnabled: true, calendarId: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Integrations</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Hubungkan layanan eksternal untuk reminder dan sinkronisasi task.
        </p>
      </div>

      <GoogleCalendarSettings
        connected={!!token}
        syncEnabled={token?.syncEnabled ?? false}
        calendarId={token?.calendarId ?? null}
        connectedAt={token?.createdAt?.toISOString() ?? null}
      />

      <TelegramSettings />

      <TodoNotifSettings />
    </div>
  );
}
