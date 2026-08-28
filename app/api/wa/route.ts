import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SM = process.env.SESSION_MANAGER_URL || 'http://localhost:9001';

async function proxy(userId: string, path: string, method = 'GET') {
  try {
    const res = await fetch(`${SM}/session/${userId}${path}`, { method });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Session manager tidak berjalan. Jalankan: npm run sessions' },
      { status: 503 }
    );
  }
}

// GET /api/wa — get session status
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return proxy(session.user.id, '');
}

// POST /api/wa — start session (generate QR)
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return proxy(session.user.id, '/start', 'POST');
}

// DELETE /api/wa — disconnect
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return proxy(session.user.id, '/stop', 'POST');
}
