import { prisma } from '../lib/db';
import { getSession } from '../lib/session';
import Link from 'next/link';
import { WifiOff, Wifi } from 'lucide-react';
import { StatCard } from './StatCard';

async function getStats(userId: string, waMode: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessionQuery =
    waMode === 'shared'
      ? prisma.waSession.findFirst({
          where: { user: { isOwner: true } },
          select: { connected: true, updatedAt: true },
        })
      : prisma.waSession.findUnique({
          where: { userId },
          select: { connected: true, updatedAt: true },
        });

  const [mentionsToday, activeTasks, completedToday, waSession] = await Promise.all([
    prisma.mention.count({
      where: { userId, timestamp: { gte: today } },
    }),
    prisma.task.count({
      where: { userId, status: { in: ['todo', 'in_progress'] } },
    }),
    prisma.task.count({
      where: { userId, status: 'done', updatedAt: { gte: today } },
    }),
    sessionQuery,
  ]);

  const staleThreshold = new Date(Date.now() - 3 * 60 * 1000);
  const recentHeartbeat = waSession?.updatedAt && waSession.updatedAt > staleThreshold;
  const connected = waSession?.connected || recentHeartbeat || false;
  const hasEverConnected = waSession !== null;

  return { mentionsToday, activeTasks, completedToday, connected, hasEverConnected };
}

export async function DashboardStats() {
  const session = await getSession().catch(() => null);
  if (!session) return null;

  const user = session.user as any;
  const waMode: string = user.waMode ?? 'shared';

  const { mentionsToday, activeTasks, completedToday, connected, hasEverConnected } = await getStats(session.user.id, waMode);

  // Determine WA status banner variant:
  // - own mode, never connected → soft invite (not an error)
  // - own mode, was connected but now down → red warning
  // - shared mode, bot down → red warning
  const showInvite = waMode === 'own' && !hasEverConnected;
  const showWarning = !showInvite && !connected;

  return (
    <div className="space-y-3 mb-2">
      {showInvite && (
        <Link
          href="/settings/whatsapp"
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-border/60 bg-muted/30 text-muted-foreground text-sm hover:bg-muted/50 transition-colors"
        >
          <Wifi className="h-4 w-4 shrink-0" />
          <span>Connect WhatsApp to auto-capture mentions from your groups.</span>
          <span className="ml-auto text-xs underline underline-offset-2 shrink-0">Set up</span>
        </Link>
      )}
      {showWarning && (
        <Link
          href="/settings/whatsapp"
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/8 text-red-400 text-sm hover:bg-red-500/12 transition-colors"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            {waMode === 'shared'
              ? 'Shared bot disconnected — mentions are not being captured.'
              : 'WhatsApp disconnected — mentions are not being captured.'}
          </span>
          <span className="ml-auto text-xs underline underline-offset-2 shrink-0">
            {waMode === 'shared' ? 'View settings' : 'Reconnect'}
          </span>
        </Link>
      )}

      <div className="grid grid-cols-3 divide-x divide-border border border-border rounded-lg overflow-hidden">
        <StatCard value={mentionsToday} label="Mentions today" index={0} />
        <StatCard value={activeTasks} label="Active tasks" index={1} />
        <StatCard value={completedToday} label="Completed today" highlight index={2} />
      </div>
    </div>
  );
}
