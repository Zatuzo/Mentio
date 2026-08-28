import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { searchSemantic } from '@/app/lib/embeddings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '8'), 20);

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  try {
    const results = await searchSemantic(session.user.id, q, limit);
    return NextResponse.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
