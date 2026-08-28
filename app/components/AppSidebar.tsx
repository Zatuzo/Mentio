import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { SidebarProjectSection } from './SidebarProjectSection';
import { AppSidebarClient } from './AppSidebarClient';
import { MobileBottomBar } from './MobileBottomBar';

export async function AppSidebar() {
  const session = await getSession().catch(() => null);
  if (!session) return null;

  const userId = session.user.id;
  const isOwner = !!(session.user as any).isOwner;
  const cookieProjectId = cookies().get('mentio_project_id')?.value;

  const [members, waSession, unreadCount] = await Promise.all([
    prisma.projectMember.findMany({
      where: { userId },
      include: { project: true },
      orderBy: { project: { createdAt: 'asc' } },
    }),
    prisma.waSession.findUnique({ where: { userId }, select: { connected: true } }),
    prisma.mention.count({ where: { userId, processed: false } }),
  ]);

  const validCookieProject = cookieProjectId && members.some((m) => m.projectId === cookieProjectId);
  const activeProjectId = (validCookieProject ? cookieProjectId : members[0]?.projectId) || '';

  const projectGroups = activeProjectId
    ? await prisma.projectGroup.findMany({
        where: {
          projectId: activeProjectId,
          project: { members: { some: { userId } } },
        },
        include: { group: { select: { id: true, name: true } } },
        orderBy: { group: { name: 'asc' } },
      })
    : [];

  const projects = members.map((m) => ({ id: m.project.id, name: m.project.name, role: m.role }));
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const connected = !!waSession?.connected;

  const user = {
    name: session.user.name ?? 'User',
    email: session.user.email ?? '',
    plan: (session.user as any).plan ?? 'free',
  };

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <AppSidebarClient
          isOwner={isOwner}
          unreadCount={unreadCount}
          newDumpCount={0}
          connected={connected}
          user={user}
          projects={projects}
          activeProjectId={activeProject?.id || ''}
          projectGroups={projectGroups.map((pg) => pg.group)}
        />
      </Sidebar>
      <MobileBottomBar
        isOwner={isOwner}
        unreadCount={unreadCount}
      />
    </>
  );
}
