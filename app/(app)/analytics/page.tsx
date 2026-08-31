import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AnalyticsDashboard } from '@/app/components/AnalyticsDashboard';
import { EmptyState } from '@/app/components/EmptyState';
import { CreateProjectButton } from '@/app/components/CreateProjectButton';
import { BarChart2 } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics - Mentio',
};

export default async function AnalyticsPage() {
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
          icon={<BarChart2 className="w-5 h-5" />}
          title="No projects yet"
          description="Create your first project to see analytics."
          action={<CreateProjectButton label="Create project" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{userMember.project.name}</p>
      </div>
      <AnalyticsDashboard projectId={userMember.projectId} />
    </div>
  );
}
