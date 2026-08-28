import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { active, label } = await req.json();
  const row = await prisma.watchedJid.updateMany({
    where: { id: params.id, userId: user.id },
    data: { ...(active !== undefined && { active }), ...(label !== undefined && { label }) },
  });
  return NextResponse.json({ updated: row.count });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.watchedJid.deleteMany({ where: { id: params.id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
