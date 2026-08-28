import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { parseRepo, checkRepo } from '@/app/lib/github';
import { resolveGithubToken } from '@/app/lib/github-token';

export const runtime = 'nodejs';

// POST /api/projects/[id]/github-test — verify repo access before saving
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const repo = parseRepo(body.githubRepo || '');
  if (!repo) {
    return NextResponse.json({ error: 'Invalid repo — use "owner/repo" or a GitHub URL' }, { status: 400 });
  }

  // Priority: token typed into the form → user's GitHub OAuth token → project PAT.
  let token: string | null =
    typeof body.githubToken === 'string' && body.githubToken.trim()
      ? body.githubToken.trim()
      : null;
  let source = token ? 'form' : 'none';
  if (!token) {
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    const resolved = await resolveGithubToken(session.user.id, project?.githubToken);
    token = resolved.token;
    source = resolved.source;
  }

  try {
    const info = await checkRepo({ repo, branch: body.githubBranch, token });
    return NextResponse.json({ ok: true, tokenSource: source, ...info });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Connection failed' }, { status: 200 });
  }
}
