import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/canvas/board?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  // Verify membership
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [tasks, statuses] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      select: {
        id: true, title: true, status: true, priority: true, description: true,
        assignedTo: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.projectStatus.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    }),
  ]);

  return NextResponse.json({ tasks, statuses });
}
