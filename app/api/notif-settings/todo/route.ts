import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.todoNotifSettings.findUnique({
    where: { userId: session.user.id },
  });

  // Return defaults if not yet configured
  return NextResponse.json(settings ?? {
    dailyEnabled: false,
    dailyTime: '08:00',
    timezone: 'Asia/Jakarta',
    periodicEnabled: false,
    periodicHours: 4,
    deadlineEnabled: true,
    deadlineDays: '1,3',
    overdueEnabled: true,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    dailyEnabled, dailyTime, timezone,
    periodicEnabled, periodicHours,
    deadlineEnabled, deadlineDays,
    overdueEnabled,
  } = body;

  const data: Record<string, unknown> = {};
  if (dailyEnabled !== undefined) data.dailyEnabled = !!dailyEnabled;
  if (dailyTime !== undefined) data.dailyTime = String(dailyTime).slice(0, 5);
  if (timezone !== undefined) data.timezone = String(timezone);
  if (periodicEnabled !== undefined) data.periodicEnabled = !!periodicEnabled;
  if (periodicHours !== undefined) data.periodicHours = Math.max(1, Math.min(24, Number(periodicHours)));
  if (deadlineEnabled !== undefined) data.deadlineEnabled = !!deadlineEnabled;
  if (deadlineDays !== undefined) data.deadlineDays = String(deadlineDays);
  if (overdueEnabled !== undefined) data.overdueEnabled = !!overdueEnabled;

  const settings = await prisma.todoNotifSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return NextResponse.json(settings);
}
