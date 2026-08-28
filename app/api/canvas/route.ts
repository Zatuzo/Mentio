import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/canvas?type=scratch&id=<entityId>
// Used by WS server (internal) and client fallback
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('type') ?? 'scratch';
  const entityId = searchParams.get('id') ?? session.user.id; // scratch defaults to userId

  const canvas = await prisma.canvas.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
  });

  return NextResponse.json({ snapshot: canvas?.snapshot ?? null });
}

// PUT /api/canvas  { type, id?, snapshot }
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const entityType: string = body.type ?? 'scratch';
  const entityId: string = body.id ?? session.user.id;
  const snapshot = body.snapshot;

  if (!snapshot) return NextResponse.json({ error: 'snapshot required' }, { status: 400 });

  const canvas = await prisma.canvas.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    update: { snapshot, updatedAt: new Date() },
    create: { entityType, entityId, snapshot },
  });

  return NextResponse.json({ ok: true, id: canvas.id });
}
