import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { BotMessagesSettings } from '@/app/components/BotMessagesSettings';
import { WorkflowSettings } from '@/app/components/WorkflowSettings';
import { ProjectGroupsSettings } from '@/app/components/ProjectGroupsSettings';

export const dynamic = 'force-dynamic';

export default async function ProjectSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  const cookieStore = cookies();
  const cookieProjectId = cookieStore.get('mentio_project_id')?.value;

  let activeMember = cookieProjectId
    ? await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: cookieProjectId, userId } },
        include: { project: true },
      })
    : null;
  if (!activeMember) {
    activeMember = await prisma.projectMember.findFirst({
      where: { userId },
      include: { project: true },
      orderBy: { project: { createdAt: 'asc' } },
    });
  }

  if (!activeMember) {
    return (
      <p className="text-sm text-muted-foreground">
        No active project. Create or select a project from the sidebar first.
      </p>
    );
  }

  const [projectStatuses, projectGroupsData] = await Promise.all([
    prisma.projectStatus.findMany({
      where: { projectId: activeMember.projectId },
      orderBy: { order: 'asc' },
    }),
    Promise.all([
      prisma.projectGroup.findMany({
        where: { projectId: activeMember.projectId },
        include: { group: true },
        orderBy: { group: { name: 'asc' } },
      }),
      prisma.userGroup.findMany({
        where: { userId },
        include: { group: true },
        orderBy: { group: { name: 'asc' } },
      }),
    ]),
  ]);

  const linkedGroups = projectGroupsData[0].map((pg) => ({ id: pg.group.id, name: pg.group.name }));
  const linkedIds = new Set(linkedGroups.map((g) => g.id));
  const availableGroups = projectGroupsData[1]
    .filter((ug) => !linkedIds.has(ug.groupId))
    .map((ug) => ({ id: ug.group.id, name: ug.group.name }));

  const isAdmin = activeMember.role === 'admin';

  return (
    <div className="space-y-10">

      <section>
        <h3 className="text-lg font-medium mb-1">Bot Messages</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Pesan otomatis yang dikirim bot ke grup WhatsApp untuk{' '}
          <strong>{activeMember.project.name}</strong>.
        </p>
        <BotMessagesSettings
          projectId={activeMember.project.id}
          isAdmin={isAdmin}
          initialClaim={activeMember.project.claimMessage}
          initialTaskDone={activeMember.project.taskDoneMessage}
          initialSilentMode={activeMember.project.silentMode}
        />
      </section>

      <hr className="border-border" />

      <section>
        <h3 className="text-lg font-medium mb-1">WhatsApp Groups</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Grup yang terhubung ke <strong>{activeMember.project.name}</strong>. Grup ini muncul
          sebagai pilihan saat assign task, dan menerima notifikasi bot.
        </p>
        <ProjectGroupsSettings
          projectId={activeMember.project.id}
          isAdmin={isAdmin}
          initialLinked={linkedGroups}
          initialAvailable={availableGroups}
        />
      </section>

      <hr className="border-border" />

      <section>
        <h3 className="text-lg font-medium mb-1">Workflow</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Kustomisasi kolom status kanban untuk <strong>{activeMember.project.name}</strong>.
          Jumlah kolom di board menyesuaikan jumlah status yang kamu buat.
        </p>
        <WorkflowSettings
          projectId={activeMember.project.id}
          isAdmin={isAdmin}
          initialStatuses={projectStatuses}
        />
      </section>
    </div>
  );
}
