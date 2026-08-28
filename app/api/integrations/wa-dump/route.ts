import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { generateClaimCode, CLAIM_TTL_MS } from '@/app/lib/claim';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { waDumpEnabled: true, dumpJid: true },
  });

  const mentioNumber = process.env.MY_JID?.replace(/:\d+@.*/, '').replace(/@.*/, '') ?? null;

  return NextResponse.json({
    enabled: user?.waDumpEnabled ?? false,
    linked: !!user?.dumpJid,
    dumpJid: user?.dumpJid ?? null,
    mentioNumber,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, enabled } = body;

  // Legacy toggle (kept for backwards compat)
  if (enabled !== undefined && !action) {
    await prisma.user.update({ where: { id: session.user.id }, data: { waDumpEnabled: !!enabled } });
    return NextResponse.json({ ok: true, enabled: !!enabled });
  }

  if (action === 'generate_code') {
    let code = generateClaimCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.groupClaim.findUnique({ where: { code } });
      if (!exists) break;
      code = generateClaimCode();
    }

    const identifier = `wa_dump_${session.user.id}`;
    await prisma.verification.deleteMany({ where: { identifier } });
    await prisma.verification.create({
      data: {
        id: randomBytes(12).toString('hex'),
        identifier,
        value: code,
        expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
      },
    });

    const mentioNumber = process.env.MY_JID?.replace(/:\d+@.*/, '').replace(/@.*/, '') ?? null;
    return NextResponse.json({ code, mentioNumber });
  }

  if (action === 'toggle') {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { waDumpEnabled: true },
    });
    const next = !user?.waDumpEnabled;
    await prisma.user.update({ where: { id: session.user.id }, data: { waDumpEnabled: next } });
    return NextResponse.json({ ok: true, enabled: next });
  }

  if (action === 'set_emoji') {
    const { emoji } = body;
    if (!emoji || typeof emoji !== 'string') return NextResponse.json({ error: 'emoji required' }, { status: 400 });
    await prisma.user.update({ where: { id: session.user.id }, data: { dumpTaskEmoji: emoji.trim().slice(0, 4) } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'disconnect') {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { dumpJid: null, waDumpEnabled: false },
    });
    await prisma.verification.deleteMany({ where: { identifier: `wa_dump_${session.user.id}` } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
