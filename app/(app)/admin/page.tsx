import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { AdminAddGroup } from '@/app/components/AdminAddGroup';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!(session.user as any).isOwner) redirect('/dashboard');

  const [users, unwatchedGroups] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { mentions: true, watchedJids: true, userGroups: true },
        },
      },
    }),
    prisma.group.findMany({
      where: { userGroups: { none: { userId: session.user.id } } },
      orderBy: { name: 'asc' },
      include: { _count: { select: { mentions: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Admin</h2>
        <p className="text-sm text-muted-foreground mt-1">{users.length} registered user(s)</p>
      </div>

      <section>
        <h3 className="text-lg font-medium mb-1">Watch a Group</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Langsung watch grup yang sudah dikenal bot, tanpa proses claim code.
        </p>
        <AdminAddGroup
          initialGroups={unwatchedGroups.map((g) => ({
            id: g.id,
            name: g.name,
            mentionCount: g._count.mentions,
          }))}
        />
      </section>

      <section>
        <h3 className="text-lg font-medium mb-3">Users</h3>
        <ul className="divide-y divide-zinc-800 rounded-lg border border-border">
          {users.map((u) => (
            <li key={u.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    {u.isOwner && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300">owner</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-md ${u.plan === 'pro' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                      {u.plan}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md ${u.waMode === 'own' ? 'bg-blue-500/20 text-blue-300' : 'bg-muted text-muted-foreground'}`}>
                      WA: {u.waMode}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{u._count.mentions} mentions</div>
                  <div>{u._count.watchedJids} watched</div>
                  <div>{u._count.userGroups} groups</div>
                  <div className="mt-1">{new Date(u.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              {u.planExpiresAt && (
                <div className="text-xs text-primary mt-1">
                  Plan expires: {new Date(u.planExpiresAt).toLocaleDateString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
