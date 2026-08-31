import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { MentionInbox } from '@/app/components/MentionInbox';
import { decryptText } from '@/app/lib/crypto';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inbox — Mentio',
  description: 'Unread WhatsApp mentions awaiting action.',
};

export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  const cookieProjectId = cookies().get('mentio_project_id')?.value;
  const member = cookieProjectId
    ? await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: cookieProjectId, userId } },
      })
    : await prisma.projectMember.findFirst({
        where: { userId },
        orderBy: { project: { createdAt: 'asc' } },
      });

  const projectId = member?.projectId ?? null;

  const [mentions, userGroups] = await Promise.all([
    prisma.mention.findMany({
      where: { userId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 200,
    }),
    prisma.userGroup.findMany({
      where: { userId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { group: { name: 'asc' } },
    }),
  ]);

  const serialized = mentions.map((m) => ({
    id: m.id,
    text: decryptText(m.text),
    category: m.category,
    senderName: m.senderName,
    senderJid: m.senderJid,
    mentionedJid: m.mentionedJid,
    timestamp: m.timestamp.toISOString(),
    processed: m.processed,
    group: m.group,
  }));

  const groups = userGroups.map((ug) => ug.group);

  const unreadCount = mentions.filter((m) => !m.processed).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Inbox</h2>
          {unreadCount > 0 && (
            <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              {unreadCount} unread
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          All WhatsApp mentions across your groups, in one place.
        </p>
      </div>

      <MentionInbox
        initialMentions={serialized}
        groups={groups}
        projectId={projectId}
      />
    </div>
  );
}
