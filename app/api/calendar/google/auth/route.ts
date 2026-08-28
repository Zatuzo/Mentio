import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { getOAuthUrl } from '@/app/lib/google-calendar';

export const dynamic = 'force-dynamic';

// GET /api/calendar/google/auth — redirect user to Google OAuth for Calendar scope
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = getOAuthUrl(session.user.id);
  return NextResponse.redirect(url);
}
