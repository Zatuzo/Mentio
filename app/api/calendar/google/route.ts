import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/calendar/google — status koneksi
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = await prisma.googleCalendarToken.findUnique({
    where:  { userId: session.user.id },
    select: { calendarId: true, syncEnabled: true, createdAt: true },
  });

  return NextResponse.json({
    connected:   !!token,
    syncEnabled: token?.syncEnabled ?? false,
    calendarId:  token?.calendarId ?? null,
    connectedAt: token?.createdAt ?? null,
  });
}

// DELETE /api/calendar/google — disconnect (hapus token)
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.googleCalendarToken.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/calendar/google — toggle syncEnabled
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { syncEnabled } = await req.json() as { syncEnabled: boolean };
  const updated = await prisma.googleCalendarToken.update({
    where: { userId: session.user.id },
    data:  { syncEnabled },
  });
  return NextResponse.json({ syncEnabled: updated.syncEnabled });
}
