import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { HubBoard } from './hub-board';

export const dynamic = 'force-dynamic';

export default async function HubPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-lg font-medium">Belum ada data demo.</p>
          <p className="text-sm text-[#8b93a7]">
            Jalankan <code className="rounded bg-white/10 px-1.5 py-0.5">npm run db:seed-demo</code> setelah{' '}
            <code className="rounded bg-white/10 px-1.5 py-0.5">DATABASE_URL</code> di <code>.env</code> terisi.
          </p>
        </div>
      </div>
    );
  }

  const userId = session.user.id;

  const project = await prisma.project.findFirst({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: 'asc' },
  });

  const [mentions, statuses, tasks] = await Promise.all([
    prisma.mention.findMany({
      where: { userId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 20,
    }),
    project
      ? prisma.projectStatus.findMany({ where: { projectId: project.id }, orderBy: { order: 'asc' } })
      : Promise.resolve([]),
    project
      ? prisma.task.findMany({
          where: { projectId: project.id },
          include: { group: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  return (
    <HubBoard
      projectId={project?.id ?? null}
      projectName={project?.name ?? 'Workspace'}
      statuses={statuses.map((s) => ({ slug: s.slug, label: s.label, color: s.color }))}
      mentions={mentions.map((m) => ({
        id: m.id,
        text: m.text,
        senderName: m.senderName,
        groupName: m.group?.name ?? null,
        timestamp: m.timestamp.toISOString(),
      }))}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        groupName: t.group?.name ?? null,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}
