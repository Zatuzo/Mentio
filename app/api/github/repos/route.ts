import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { resolveGithubToken } from '@/app/lib/github-token';
import { listUserRepos } from '@/app/lib/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/github/repos — list the current user's GitHub repos
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token, source } = await resolveGithubToken(session.user.id);
  if (!token || source !== 'oauth') {
    return NextResponse.json(
      { error: 'Connect your GitHub account first', needsConnect: true },
      { status: 400 }
    );
  }

  try {
    const repos = await listUserRepos(token);
    return NextResponse.json({ repos });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list repos' }, { status: 502 });
  }
}
