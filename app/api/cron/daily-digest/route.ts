import { NextRequest, NextResponse } from 'next/server';
import { runDailyDigestForAllUsers } from '@/app/lib/digest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Protected by CRON_SECRET header — set this in .env and call from cron job:
// curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/daily-digest
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runDailyDigestForAllUsers();
  return NextResponse.json({ ok: true, ...result });
}

// Allow GET for easy manual trigger during dev
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 });
  }
  const result = await runDailyDigestForAllUsers();
  return NextResponse.json({ ok: true, ...result });
}
