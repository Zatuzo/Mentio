import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { DashboardStats } from '@/app/components/DashboardStats';
import { KanbanBoard } from '@/app/components/KanbanBoard';
import { SummarizeButton } from '@/app/components/SummarizeButton';
import { CreateProjectButton } from '@/app/components/CreateProjectButton';
import { EmptyState } from '@/app/components/EmptyState';
import { FolderKanban } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard — Mentio',
  description: 'Overview of your project tasks and WhatsApp mentions.',
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  const cookieStore = cookies();
  const cookieProjectId = cookieStore.get('mentio_project_id')?.value;

  // Prefer cookie project, fall back to first project
  let userMember = cookieProjectId
    ? await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: cookieProjectId, userId } },
        include: { project: true },
      })
    : null;

  // Fallback if cookie project is invalid or not set
  if (!userMember) {
    userMember = await prisma.projectMember.findFirst({
      where: { userId },
      include: { project: true },
      orderBy: { project: { createdAt: 'asc' } },
    });
  }

  if (!userMember) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <EmptyState
          icon={<FolderKanban className="w-5 h-5" />}
          title="No projects yet"
          description="Create your first project to start tracking tasks from WhatsApp."
          action={<CreateProjectButton label="Create project" />}
        />
      </div>
    );
  }

  const projectId = userMember.projectId;
  const projectName = userMember.project.name;

  const [tasks, projectGroupLinks, projectStatuses, projectMemberLinks] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: {
        group: { select: { id: true, name: true } },
        mention: { select: { id: true, text: true, senderName: true, senderJid: true, timestamp: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.projectGroup.findMany({
      where: { projectId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { group: { name: 'asc' } },
    }),
    prisma.projectStatus.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, image: true } } },
    }),
  ]);

  const projectGroups = projectGroupLinks.map((pg) => pg.group);
  const members = projectMemberLinks.map((pm) => pm.user);

  const serializedTasks = tasks.map(task => ({
    ...task,
    createdAt: task.createdAt.toISOString(),
    startDate: task.startDate ? task.startDate.toISOString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    agentStartedAt: task.agentStartedAt ? task.agentStartedAt.toISOString() : null,
    agentFinishedAt: task.agentFinishedAt ? task.agentFinishedAt.toISOString() : null,
    mention: task.mention ? {
      ...task.mention,
      timestamp: task.mention.timestamp.toISOString(),
    } : null,
  }));

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{projectName}</h2>
        </div>
        <SummarizeButton />
      </div>

      <DashboardStats />

      <KanbanBoard
        initialTasks={serializedTasks}
        projectId={projectId}
        projectName={projectName}
        projectGroups={projectGroups}
        statuses={projectStatuses}
        members={members}
        currentUserId={userId}
      />
    </div>
  );
}
