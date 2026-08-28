import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({ where: { id: params.id } });
  if (!space || space.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.space.update({
    where: { id: params.id },
    data: {
      name: body.name?.trim() ?? space.name,
      description: body.description !== undefined ? body.description : space.description,
      icon: body.icon !== undefined ? body.icon : space.icon,
      color: body.color !== undefined ? body.color : space.color,
      isArchived: body.isArchived !== undefined ? body.isArchived : space.isArchived,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({ where: { id: params.id } });
  if (!space || space.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (space.isInbox)
    return NextResponse.json({ error: 'Cannot delete Inbox' }, { status: 400 });

  // Archive instead of hard delete to preserve notes
  await prisma.space.update({ where: { id: params.id }, data: { isArchived: true } });
  return NextResponse.json({ ok: true });
}
