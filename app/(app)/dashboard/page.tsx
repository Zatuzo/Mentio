import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { DashboardStats } from '@/app/components/DashboardStats';
import { DashboardTabs } from '@/app/components/DashboardTabs';
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

  const [tasks, projectGroupLinks, projectStatuses, projectMemberLinks, todoTasks, projectMeta] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: {
        group: { select: { id: true, name: true } },
        mention: { select: { id: true, text: true, senderName: true, senderJid: true, timestamp: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
      // agent fields auto-included via include
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
    prisma.task.findMany({
      where: { assignedToId: userId },
      select: {
        id: true, title: true, status: true, priority: true, source: true,
        dueDate: true, completedAt: true, startDate: true, createdAt: true,
        requester: true, description: true, imageUrls: true,
        sourceNoteId: true,
        sourceNote: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { brief: true, briefUpdatedAt: true, briefUpdaterName: true },
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

  const serializedTodoTasks = todoTasks.map(task => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    source: (task as { source?: string }).source ?? null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt ? task.createdAt.toISOString() : null,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    requester: task.requester ?? null,
    description: task.description ?? null,
    sourceNoteId: task.sourceNoteId ?? null,
    sourceNote: task.sourceNote ?? null,
    project: task.project ?? null,
    assignedTo: task.assignedTo ?? null,
    imageUrls: (task as { imageUrls?: string[] }).imageUrls ?? [],
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

      <DashboardTabs
        projectTasks={serializedTasks}
        todoTasks={serializedTodoTasks}
        projectId={projectId}
        projectName={projectName}
        projectGroups={projectGroups}
        statuses={projectStatuses}
        members={members}
        currentUserId={userId}
        initialBrief={projectMeta?.brief ?? null}
        briefUpdatedAt={projectMeta?.briefUpdatedAt?.toISOString() ?? null}
        briefUpdaterName={projectMeta?.briefUpdaterName ?? null}
      />
    </div>
  );
}
