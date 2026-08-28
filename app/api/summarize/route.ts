import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { auth } from '../../lib/auth';
// @ts-ignore
import { runOnce, summarizeGroup } from '../../../src/summarizer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

// POST /api/summarize  { groupId?, projectId? }
// projectId — force tasks into a specific project. Falls back to the user's
// active project cookie, so the dashboard "Summarize now" button always lands
// tasks in the project the user is currently looking at.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const cookieProjectId = cookies().get('mentio_project_id')?.value || undefined;
    const projectId = body.projectId || cookieProjectId;

    if (body.groupId) {
      const s = await summarizeGroup(body.groupId, user.id, { projectId });
      return NextResponse.json({ ok: true, summary: s });
    }
    const results = await runOnce(user.id, projectId);
    return NextResponse.json({ ok: true, count: results.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
