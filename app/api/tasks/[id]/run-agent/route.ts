import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { resolveGithubToken } from '@/app/lib/github-token';
import { runAgent, type AgentModel, AGENT_MODELS } from '@/app/lib/agent-executor';
import { notifyAgentDone } from '@/app/lib/telegram-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: {
        include: { repos: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (!task.project) return NextResponse.json({ error: 'Task harus terhubung ke project yang memiliki repo GitHub' }, { status: 400 });

  // Allow task owner OR any project member to run the agent
  const isOwner = task.userId === session.user.id;
  const isMember = !isOwner && await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: task.project.id, userId: session.user.id } },
    select: { id: true },
  });
  if (!isOwner && !isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const repoId = body.repoId as string | undefined;
  const validModelIds = AGENT_MODELS.map((m) => m.id);
  const model: AgentModel = validModelIds.includes(body.model) ? body.model : 'deepseek-coder';

  const repos = task.project.repos;
  const repo = repoId ? repos.find((r) => r.id === repoId) : repos[0];
  if (!repo) return NextResponse.json({ error: 'Repo GitHub belum dikonfigurasi di project ini' }, { status: 400 });

  if (task.agentStatus === 'running') {
    return NextResponse.json({ error: 'Agent sedang berjalan' }, { status: 409 });
  }

  // Mark as running
  await prisma.task.update({
    where: { id: task.id },
    data: {
      agentEnabled: true,
      agentStatus: 'running',
      agentError: null,
      agentResult: null,
      agentPrUrl: null,
      agentBranch: null,
      agentStartedAt: new Date(),
      agentFinishedAt: null,
    },
  });

  // Run agent (async: response is returned immediately, agent runs in background)
  runAgentBackground({
    taskId: task.id,
    userId: session.user.id,
    model,
    projectGithubToken: task.project.githubToken,
    repo: { id: repo.id, fullName: repo.fullName, branch: repo.branch },
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      requester: task.requester,
      dueDate: task.dueDate,
      group: null,
    },
    project: {
      name: task.project.name,
      prd: task.project.prd,
      techStack: task.project.techStack,
      conventions: task.project.conventions,
    },
  });

  return NextResponse.json({ status: 'running', taskId: task.id });
}

async function runAgentBackground(args: {
  taskId: string;
  userId: string;
  projectGithubToken: string | null;
  repo: { id: string; fullName: string; branch: string };
  task: Parameters<typeof runAgent>[0]['task'];
  project: Parameters<typeof runAgent>[0]['project'];
  model: AgentModel;
}) {
  const { token } = await resolveGithubToken(args.userId, args.projectGithubToken);

  if (!token) {
    await prisma.task.update({
      where: { id: args.taskId },
      data: {
        agentStatus: 'failed',
        agentError: 'GitHub token tidak ditemukan. Hubungkan akun GitHub di Settings.',
        agentFinishedAt: new Date(),
      },
    });
    return;
  }

  try {
    const result = await runAgent({
      task: args.task,
      project: args.project,
      repo: { fullName: args.repo.fullName, branch: args.repo.branch, token },
      model: args.model,
    });

    await prisma.task.update({
      where: { id: args.taskId },
      data: {
        agentStatus: 'done',
        agentResult: result.summary,
        agentPrUrl: result.pr.url,
        agentBranch: result.branch,
        agentFinishedAt: new Date(),
        status: 'in_progress',
      },
    });

    await notifyAgentDone(args.taskId, args.userId, result.pr.url, result.summary);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.task.update({
      where: { id: args.taskId },
      data: {
        agentStatus: 'failed',
        agentError: msg,
        agentFinishedAt: new Date(),
      },
    });
  }
}
