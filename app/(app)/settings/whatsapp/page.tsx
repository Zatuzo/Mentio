import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { WatchedJidManager } from '@/app/components/WatchedJidManager';
import { GroupToggle } from '@/app/components/GroupToggle';
import { AutoSummarizeToggle } from '@/app/components/AutoSummarizeToggle';
import { FullChatSummaryToggle } from '@/app/components/FullChatSummaryToggle';
import { ClaimGroup } from '@/app/components/ClaimGroup';
import { WaConnect } from '@/app/components/WaConnect';
import { EmptyState } from '@/app/components/EmptyState';
import { Hash } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings — Mentio',
};

export default async function WhatsappSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;
  const user = session.user as any;
  const botPhone = (process.env.MY_JID || '').replace('@s.whatsapp.net', '');

  const [watched, userGroups, pendingClaims] = await Promise.all([
    prisma.watchedJid.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.userGroup.findMany({
      where: { userId },
      include: { group: true },
      orderBy: { group: { name: 'asc' } },
    }),
    prisma.groupClaim.findMany({
      where: {
        userId,
        OR: [
          { status: 'pending' },
          { status: 'claimed', claimedAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h3 className="text-lg font-medium mb-1">Connection</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Pilih bagaimana Mentio terhubung ke WhatsApp kamu.
        </p>
        <WaConnect initialMode={user.waMode || 'shared'} botPhone={botPhone} />
      </section>

      <hr className="border-border" />

      <section>
        <h3 className="text-lg font-medium mb-1">Numbers to Watch</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Mentions of these numbers in your monitored groups will be captured.
          {user.plan === 'free' && (
            <span className="ml-1 text-primary">Free plan: max 3 numbers.</span>
          )}
        </p>
        <WatchedJidManager
          watched={watched}
          groups={userGroups.map((ug) => ({ id: ug.group.id, name: ug.group.name }))}
        />
      </section>

      <hr className="border-border" />

      <section>
        <h3 className="text-lg font-medium mb-1">Monitored Groups</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Claim a WhatsApp group to start monitoring it — you only see groups you've claimed.
          {user.plan === 'free' && (
            <span className="ml-1 text-primary">Free plan: max 2 groups.</span>
          )}
        </p>

        <div className="mb-4">
          <ClaimGroup initialClaims={pendingClaims} />
        </div>

        {userGroups.length === 0 ? (
          <EmptyState
            icon={<Hash className="w-4 h-4" />}
            title="No groups claimed yet"
            description="Generate a claim code above and post it in your WhatsApp group to link it."
            size="sm"
          />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_120px_140px] items-center px-4 py-2 bg-muted/30 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground">Group</span>
              <span className="text-xs font-medium text-muted-foreground text-center">Monitor</span>
              <span className="text-xs font-medium text-muted-foreground text-center">Auto-summary</span>
              <span className="text-xs font-medium text-muted-foreground text-center">Full chat summary</span>
            </div>
            {userGroups.map((ug) => (
              <div key={ug.id} className="grid grid-cols-[1fr_80px_120px_140px] items-center px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{ug.group.name}</div>
                  <div className="text-[11px] text-muted-foreground/40 font-mono truncate">
                    {ug.group.id.replace('@g.us', '').slice(0, 12)}…
                  </div>
                </div>
                <div className="flex justify-center">
                  <GroupToggle id={ug.group.id} enabled={ug.enabled} />
                </div>
                <div className="flex justify-center">
                  <AutoSummarizeToggle groupId={ug.group.id} enabled={ug.autoSummarize} />
                </div>
                <div className="flex justify-center">
                  <FullChatSummaryToggle groupId={ug.group.id} enabled={ug.fullChatSummary} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
