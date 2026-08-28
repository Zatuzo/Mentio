import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const digest = await prisma.digest.findUnique({ where: { id: params.id } });
  if (!digest || digest.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!digest.readAt) {
    await prisma.digest.update({ where: { id: params.id }, data: { readAt: new Date() } });
  }

  return NextResponse.json({ ok: true });
}
