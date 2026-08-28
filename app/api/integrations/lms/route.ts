import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { syncLmsForUser } from '@/app/lib/lms-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET — get current LMS connection
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conn = await prisma.lmsConnection.findUnique({
    where: { userId: session.user.id },
    select: { icalUrl: true, provider: true, lastSyncAt: true, lastSyncCount: true, createdAt: true },
  });

  return NextResponse.json(conn ?? null);
}

// POST — save iCal URL (upsert)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { icalUrl } = await req.json() as { icalUrl?: string };
  if (!icalUrl?.trim()) return NextResponse.json({ error: 'icalUrl required' }, { status: 400 });

  // Quick validation — must look like a URL
  try { new URL(icalUrl); } catch {
    return NextResponse.json({ error: 'URL tidak valid' }, { status: 400 });
  }

  await prisma.lmsConnection.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, icalUrl: icalUrl.trim() },
    update: { icalUrl: icalUrl.trim() },
  });

  // Trigger initial sync immediately
  const result = await syncLmsForUser(session.user.id);
  return NextResponse.json({ ok: true, ...result });
}

// DELETE — disconnect LMS
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.lmsConnection.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
