import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { CalendarWrapper } from '@/app/components/CalendarWrapper';
import { EmptyState } from '@/app/components/EmptyState';
import { CreateProjectButton } from '@/app/components/CreateProjectButton';
import { FolderKanban } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;
  const cookieStore = cookies();
  const cookieProjectId = cookieStore.get('mentio_project_id')?.value;

  let userMember = cookieProjectId
    ? await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: cookieProjectId, userId } },
        include: { project: true },
      })
    : null;

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
          description="Create a project first to use the calendar."
          action={<CreateProjectButton label="Create project" />}
        />
      </div>
    );
  }

  const projectId = userMember.projectId;

  const [tasks, projectGroupLinks, reminders, projectStatuses, projectMemberLinks] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: {
        group: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.projectGroup.findMany({
      where: { projectId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { group: { name: 'asc' } },
    }),
    prisma.reminder.findMany({
      where: { userId, sent: false, canceledAt: null },
      orderBy: { scheduledAt: 'asc' },
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

  const projectGroups = projectGroupLinks.map(pg => pg.group);
  const members = projectMemberLinks.map(pm => pm.user);

  const serializedTasks = tasks.map(task => ({
    ...task,
    createdAt:  task.createdAt.toISOString(),
    startDate:  task.startDate ? task.startDate.toISOString() : null,
    dueDate:    task.dueDate   ? task.dueDate.toISOString()   : null,
    mention:    null,
  }));

  const serializedReminders = reminders.map(r => ({
    id:          r.id,
    message:     r.message,
    scheduledAt: r.scheduledAt.toISOString(),
    groupId:     r.groupId,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <CalendarWrapper
        initialTasks={serializedTasks}
        initialReminders={serializedReminders}
        projectId={projectId}
        projectGroups={projectGroups}
        statuses={projectStatuses}
        members={members}
      />
    </div>
  );
}
