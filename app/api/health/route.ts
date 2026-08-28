import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Heartbeat is considered stale after this many seconds.
const STALE_AFTER_SEC = 5 * 60;

// GET /api/health — public ops endpoint.
// Returns 200 when everything is healthy, 503 otherwise.
// Shape: { ok, db, listener: { connected, jid, lastSeen, stale }, lastMentionAt }
export async function GET() {
  const checks: Record<string, unknown> = {};
  let ok = true;

  // DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch (e: any) {
    checks.db = `error: ${e.message}`;
    ok = false;
  }

  // Listener heartbeat: owner's WaSession row, written by src/listener.js
  // on every connection.open / connection.close.
  try {
    const owner = await prisma.user.findFirst({
      where: { isOwner: true },
      select: { id: true },
    });
    if (!owner) {
      checks.listener = { connected: false, error: 'no owner user' };
      ok = false;
    } else {
      const wa = await prisma.waSession.findUnique({ where: { userId: owner.id } });
      if (!wa) {
        checks.listener = { connected: false, error: 'no WaSession row — listener never started' };
        ok = false;
      } else {
        const ageSec = (Date.now() - new Date(wa.updatedAt).getTime()) / 1000;
        const stale = ageSec > STALE_AFTER_SEC;
        const connected = wa.connected && !stale;
        checks.listener = {
          connected,
          jid: wa.myJid,
          lastSeen: wa.updatedAt,
          ageSec: Math.round(ageSec),
          stale,
        };
        if (!connected) ok = false;
      }
    }
  } catch (e: any) {
    checks.listener = { connected: false, error: e.message };
    ok = false;
  }

  // Most recent mention captured — useful "is data still flowing" signal.
  try {
    const last = await prisma.mention.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    checks.lastMentionAt = last?.timestamp ?? null;
  } catch {
    checks.lastMentionAt = null;
  }

  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 503 });
}
