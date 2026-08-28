import { NextRequest, NextResponse } from 'next/server';
import { syncAllLmsUsers } from '@/app/lib/lms-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const total = await syncAllLmsUsers();
  return NextResponse.json({ ok: true, totalCreated: total });
}
