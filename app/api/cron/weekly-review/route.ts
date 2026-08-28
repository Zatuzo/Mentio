import { NextRequest, NextResponse } from 'next/server';
import { runWeeklyReviewForAllUsers } from '@/app/lib/weekly-review';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Call every Monday 08:30:
// 30 8 * * 1 curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/weekly-review
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runWeeklyReviewForAllUsers();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 });
  }
  const result = await runWeeklyReviewForAllUsers();
  return NextResponse.json({ ok: true, ...result });
}
