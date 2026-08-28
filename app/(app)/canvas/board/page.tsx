import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';


export const dynamic = 'force-dynamic';

const BoardCanvas = nextDynamic(
  () => import('@/app/components/BoardCanvas').then((m) => m.BoardCanvas),
  { ssr: false },
);

export default async function BoardCanvasPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const cookieProjectId = cookies().get('mentio_project_id')?.value;

  let projectId = cookieProjectId;
  let projectName = 'Project';

  if (projectId) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!member) projectId = undefined;
    else projectName = member.project.name;
  }

  if (!projectId) {
    // Fall back to earliest project
    const fallback = await prisma.projectMember.findFirst({
      where: { userId: session.user.id },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { project: { createdAt: 'asc' } },
    });
    projectId = fallback?.project.id;
    projectName = fallback?.project.name ?? 'Project';
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Belum ada project. Buat project dulu dari dashboard.
      </div>
    );
  }

  return (
    <div className="-m-6 md:-m-8 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-sm font-medium">{projectName}</span>
        <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-xs text-muted-foreground">Board Canvas</span>
      </div>
      <div className="flex-1 min-h-0">
        <BoardCanvas projectId={projectId} currentUser={{ id: session.user.id, name: session.user.name }} />
      </div>
    </div>
  );
}
