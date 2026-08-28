import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { syncLmsForUser } from '@/app/lib/lms-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await syncLmsForUser(session.user.id);
  return NextResponse.json(result);
}
