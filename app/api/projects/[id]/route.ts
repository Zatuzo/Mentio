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

// GET /api/projects/[id] — project + codebase config (token never returned raw)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await memberRole(params.id, session.user.id);
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Repos and the current user's default-repo live in dedicated routes
  // (/repos and /me) — this endpoint exposes only project-shared context.
  const me = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
    select: { defaultRepoId: true },
  });

  return NextResponse.json({
    id: project.id,
    name: project.name,
    prd: project.prd,
    techStack: project.techStack,
    conventions: project.conventions,
    claimMessage: project.claimMessage,
    taskDoneMessage: project.taskDoneMessage,
    silentMode: project.silentMode,
    hasToken: !!project.githubToken,
    role,
    myDefaultRepoId: me?.defaultRepoId ?? null,
  });
}

// PATCH /api/projects/[id] — update project context + GitHub config (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await memberRole(params.id, session.user.id);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only project admins can edit settings' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, any> = {};

  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if ('prd' in body) data.prd = body.prd?.trim() || null;
  if ('techStack' in body) data.techStack = body.techStack?.trim() || null;
  if ('conventions' in body) data.conventions = body.conventions?.trim() || null;
  if ('claimMessage' in body) data.claimMessage = body.claimMessage?.trim() || null;
  if ('taskDoneMessage' in body) data.taskDoneMessage = body.taskDoneMessage?.trim() || null;
  if ('silentMode' in body) data.silentMode = !!body.silentMode;

  // Token: non-empty string updates it; explicit null clears it; '' means "unchanged".
  if ('githubToken' in body) {
    if (body.githubToken === null) data.githubToken = null;
    else if (typeof body.githubToken === 'string' && body.githubToken.trim()) {
      data.githubToken = body.githubToken.trim();
    }
  }

  const project = await prisma.project.update({ where: { id: params.id }, data });

  return NextResponse.json({
    id: project.id,
    name: project.name,
    prd: project.prd,
    techStack: project.techStack,
    conventions: project.conventions,
    claimMessage: project.claimMessage,
    taskDoneMessage: project.taskDoneMessage,
    silentMode: project.silentMode,
    hasToken: !!project.githubToken,
  });
}
