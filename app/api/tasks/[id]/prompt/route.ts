import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { getCodebaseContext } from '@/app/lib/github';
import { resolveGithubToken } from '@/app/lib/github-token';
import { buildTaskPrompt } from '@/app/lib/prompt-builder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/tasks/[id]/prompt?repoId=... — generate a vibe-coding prompt.
// Repo selection order:
//   1. ?repoId=  query param (member override, e.g. dropdown in modal)
//   2. caller's own ProjectMember.defaultRepoId
//   3. first ProjectRepo in the pool
//   4. none (prompt rendered without codebase context)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      group: { select: { name: true } },
      project: { include: { repos: { orderBy: { createdAt: 'asc' } } } },
    },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  if (!task.project) {
    return NextResponse.json(
      { error: 'Task is not linked to a project — assign it to a project first' },
      { status: 400 }
    );
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: task.projectId!, userId: session.user.id } },
  });
  if (!member && task.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const project = task.project;
  const repos = project.repos;

  // Resolve which repo to pull context from.
  const requestedRepoId = req.nextUrl.searchParams.get('repoId');
  let activeRepo = requestedRepoId ? repos.find((r) => r.id === requestedRepoId) : null;
  if (!activeRepo && member?.defaultRepoId) {
    activeRepo = repos.find((r) => r.id === member.defaultRepoId) || null;
  }
  if (!activeRepo && repos.length > 0) {
    activeRepo = repos[0];
  }

  let codebase = null;
  if (activeRepo) {
    const { token } = await resolveGithubToken(session.user.id, project.githubToken);
    codebase = await getCodebaseContext({
      repo: activeRepo.fullName,
      branch: activeRepo.branch,
      token,
    });
  }

  const prompt = buildTaskPrompt(
    {
      title: task.title,
      description: task.description,
      requester: task.requester,
      dueDate: task.dueDate,
      group: task.group,
    },
    {
      name: project.name,
      prd: project.prd,
      techStack: project.techStack,
      conventions: project.conventions,
    },
    codebase
  );

  return NextResponse.json({
    prompt,
    codebaseError: codebase?.error ?? null,
    hasCodebase: !!codebase && !codebase.error,
    hasGithubConfigured: repos.length > 0,
    activeRepoId: activeRepo?.id ?? null,
    repos: repos.map((r) => ({ id: r.id, fullName: r.fullName, branch: r.branch })),
  });
}
