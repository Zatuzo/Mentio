import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TeamManager } from '@/app/components/TeamManager';

export const dynamic = 'force-dynamic';

export default async function TeamSettingsPage() {
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

  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId: activeMember.projectId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return (
    <section>
      <h3 className="text-lg font-medium mb-1">Team</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Members of <strong>{activeMember.project.name}</strong>. Admins can invite and remove
        members.
      </p>
      <TeamManager
        projectId={activeMember.projectId}
        projectName={activeMember.project.name}
        initialMembers={projectMembers}
        currentUserId={userId}
        currentUserRole={activeMember.role}
      />
    </section>
  );
}
