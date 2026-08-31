import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { decryptText } from '@/app/lib/crypto';
import { SummarizeButton } from '@/app/components/SummarizeButton';
import { MarkdownContent } from '@/app/components/MarkdownContent';
import { EmptyState } from '@/app/components/EmptyState';
import { FileText, MessageSquare } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function GroupPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;
  const id = decodeURIComponent(params.id);

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return <p>Group not found.</p>;

  const [mentionsRaw, summaries] = await Promise.all([
    prisma.mention.findMany({
      where: { groupId: id, userId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    }),
    prisma.summary.findMany({
      where: { groupId: id, userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);
  const mentions = mentionsRaw.map((m) => ({ ...m, text: decryptText(m.text) }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <a href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">Back</a>
          <h2 className="text-2xl font-semibold mt-1">{group.name}</h2>
          <p className="text-xs text-muted-foreground mt-1">{group.id}</p>
        </div>
        <SummarizeButton groupId={group.id} />
      </div>

      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent summaries</h3>
        {summaries.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-4 h-4" />}
            title="No summaries yet"
            description="Run a summary to condense recent mentions into a readable digest."
            action={<SummarizeButton groupId={group.id} />}
            size="sm"
          />
        ) : (
          <ul className="space-y-3">
            {summaries.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="text-xs text-muted-foreground mb-2">
                  {new Date(s.createdAt).toLocaleString()} · covers{' '}
                  {new Date(s.mentionFrom).toLocaleString()} to {new Date(s.mentionTo).toLocaleString()}
                </div>
                <div className="text-sm text-foreground">
                  <MarkdownContent content={s.content} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Recent mentions {mentions.length > 0 && `(${mentions.length})`}
        </h3>
        {mentions.length === 0 && (
          <EmptyState
            icon={<MessageSquare className="w-4 h-4" />}
            title="No mentions yet"
            description="Mentions of your watched numbers in this group will appear here."
            size="sm"
          />
        )}
        <ul className="space-y-2">
          {mentions.map((m) => (
            <li key={m.id} className="rounded-md border border-border bg-card/30 p-3 text-sm">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {m.senderName || m.senderJid}
                  {m.mentionedJid && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300">
                      <span className="mx-1 text-muted-foreground/40">·</span>{m.mentionedJid.replace(/@(s\.whatsapp\.net|lid)$/, '')}
                    </span>
                  )}
                </span>
                <span>
                  {new Date(m.timestamp).toLocaleString()}
                  {m.processed ? ' · summarized' : ' · pending'}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{m.text}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
