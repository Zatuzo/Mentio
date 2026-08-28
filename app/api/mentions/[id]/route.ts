import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mention = await prisma.mention.findUnique({ where: { id: params.id } });
  if (!mention) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (mention.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { processed } = await req.json() as { processed?: boolean };
  const updated = await prisma.mention.update({
    where: { id: params.id },
    data: { processed: processed ?? true },
  });

  return NextResponse.json(updated);
}
