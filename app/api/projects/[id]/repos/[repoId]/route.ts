import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';

export const runtime = 'nodejs';

async function memberRole(projectId: string, userId: string) {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return m?.role ?? null;
}

// DELETE /api/projects/[id]/repos/[repoId] — admin only.
// Members whose defaultRepoId points here are reset to null (SetNull on FK).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; repoId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await memberRole(params.id, session.user.id);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only project admins can remove repos' }, { status: 403 });
  }

  const repo = await prisma.projectRepo.findUnique({ where: { id: params.repoId } });
  if (!repo || repo.projectId !== params.id) {
    return NextResponse.json({ error: 'Repo not found in this project' }, { status: 404 });
  }

  await prisma.projectRepo.delete({ where: { id: params.repoId } });
  return NextResponse.json({ ok: true });
}
