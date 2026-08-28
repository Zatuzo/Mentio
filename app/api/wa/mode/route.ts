import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { mode } = await req.json();

  if (mode !== 'shared' && mode !== 'own') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { waMode: mode },
  });

  return NextResponse.json({ ok: true, waMode: mode });
}
