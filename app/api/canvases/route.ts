import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// GET /api/canvases — list user's canvases
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const canvases = await prisma.canvas.findMany({
    where: { ownerId: session.user.id, entityType: 'user' },
    select: { id: true, name: true, shareToken: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(canvases);
}

// POST /api/canvases — create new canvas
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim() || 'Untitled Canvas';

  const canvas = await prisma.canvas.create({
    data: {
      entityType: 'user',
      entityId: randomBytes(12).toString('hex'),
      name,
      ownerId: session.user.id,
    },
    select: { id: true, entityId: true, name: true, shareToken: true, createdAt: true },
  });

  return NextResponse.json(canvas, { status: 201 });
}
