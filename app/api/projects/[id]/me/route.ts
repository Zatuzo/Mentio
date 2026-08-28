import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';

export const runtime = 'nodejs';

// PATCH /api/projects/[id]/me — current user updates their own member settings
// in this project (e.g. defaultRepoId). Any member can call this for themselves.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, any> = {};

  if ('defaultRepoId' in body) {
    if (body.defaultRepoId === null) {
      data.defaultRepoId = null;
    } else if (typeof body.defaultRepoId === 'string') {
      // Verify the repo belongs to this project before allowing the link.
      const repo = await prisma.projectRepo.findUnique({
        where: { id: body.defaultRepoId },
        select: { projectId: true },
      });
      if (!repo || repo.projectId !== params.id) {
        return NextResponse.json({ error: 'Repo not found in this project' }, { status: 400 });
      }
      data.defaultRepoId = body.defaultRepoId;
    }
  }

  const updated = await prisma.projectMember.update({
    where: { id: me.id },
    data,
    select: { defaultRepoId: true },
  });
  return NextResponse.json(updated);
}
