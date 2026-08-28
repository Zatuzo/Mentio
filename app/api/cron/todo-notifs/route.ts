import { NextRequest, NextResponse } from 'next/server';
import { sendTodoNotifications } from '@/app/lib/telegram-notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const count = await sendTodoNotifications();
  return NextResponse.json({ ok: true, sent: count });
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }
  return POST(req);
}
