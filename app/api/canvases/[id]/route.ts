import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// GET /api/canvases/[id] — fetch canvas meta (used for access check)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const canvas = await prisma.canvas.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true, shareToken: true, entityId: true },
  });
  if (!canvas) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Return minimal public info; caller decides access
  return NextResponse.json({
    id: canvas.id,
    name: canvas.name,
    ownerId: canvas.ownerId,
    entityId: canvas.entityId,
    hasShareToken: !!canvas.shareToken,
    shareToken: canvas.shareToken,
  });
}

// PATCH /api/canvases/[id] — rename or toggle sharing (owner only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const canvas = await prisma.canvas.findUnique({
    where: { id: params.id },
    select: { ownerId: true, shareToken: true },
  });
  if (!canvas) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (canvas.ownerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body.name === 'string') updates.name = body.name.trim() || 'Untitled Canvas';

  if (body.sharing === true && !canvas.shareToken) {
    updates.shareToken = randomBytes(16).toString('hex');
  } else if (body.sharing === false) {
    updates.shareToken = null;
  }

  const updated = await prisma.canvas.update({
    where: { id: params.id },
    data: updates,
    select: { id: true, name: true, shareToken: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/canvases/[id] — delete canvas (owner only)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const canvas = await prisma.canvas.findUnique({
    where: { id: params.id },
    select: { ownerId: true },
  });
  if (!canvas) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (canvas.ownerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.canvas.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
