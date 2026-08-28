import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/db';
import { cookies } from 'next/headers';
import { AiChatPage } from '@/app/components/AiChatPage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;
  const cookieStore = cookies();
  const cookieProjectId = cookieStore.get('mentio_project_id')?.value;

  const [sessions, projectMember, allMembers] = await Promise.all([
    prisma.aiChatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, updatedAt: true },
    }),
    cookieProjectId
      ? prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: cookieProjectId, userId } },
          include: { project: { select: { id: true, name: true } } },
        })
      : prisma.projectMember.findFirst({
          where: { userId },
          include: { project: { select: { id: true, name: true } } },
          orderBy: { project: { createdAt: 'asc' } },
        }),
    prisma.projectMember.findMany({
      where: { userId },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { project: { createdAt: 'asc' } },
    }),
  ]);

  const projects = allMembers.map((m) => ({ id: m.project.id, name: m.project.name }));

  return (
    <AiChatPage
      initialSessions={sessions.map((s) => ({
        ...s,
        updatedAt: s.updatedAt.toISOString(),
      }))}
      projectId={projectMember?.project.id ?? null}
      projectName={projectMember?.project.name ?? null}
      projects={projects}
      userName={session.user.name ?? 'You'}
    />
  );
}
