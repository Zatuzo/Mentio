import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { parseRepo } from '@/app/lib/github';

export const runtime = 'nodejs';

async function memberRole(projectId: string, userId: string) {
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return m?.role ?? null;
}

// GET /api/projects/[id]/repos — list project repos (any member).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await memberRole(params.id, session.user.id);
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const repos = await prisma.projectRepo.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, fullName: true, branch: true, createdAt: true },
  });

  return NextResponse.json({ repos });
}

// POST /api/projects/[id]/repos — add a repo to the project pool (admin only).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await memberRole(params.id, session.user.id);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only project admins can add repos' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseRepo((body.fullName || body.githubRepo || '').trim());
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid repo — use "owner/repo" or a github.com URL' },
      { status: 400 }
    );
  }
  const branch = (body.branch || 'main').trim() || 'main';

  const repo = await prisma.projectRepo.upsert({
    where: { projectId_fullName: { projectId: params.id, fullName: parsed } },
    update: { branch },
    create: {
      projectId: params.id,
      fullName: parsed,
      branch,
      addedById: session.user.id,
    },
    select: { id: true, fullName: true, branch: true, createdAt: true },
  });

  return NextResponse.json({ repo });
}
