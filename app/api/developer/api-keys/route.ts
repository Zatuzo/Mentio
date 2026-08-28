import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { createHash, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function hashKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, scopes, expiresAt } = body as {
    name?: string;
    scopes?: string;
    expiresAt?: string | null;
  };

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const validScopes = ['read', 'read,write'];
  const scope = scopes && validScopes.includes(scopes) ? scopes : 'read';

  const rawKey = `mentio_${randomBytes(24).toString('hex')}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = hashKey(rawKey);

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      keyPrefix,
      keyHash,
      scopes: scope,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    select: { id: true, name: true, keyPrefix: true, scopes: true, expiresAt: true, createdAt: true },
  });

  // Return raw key ONCE — never stored again
  return NextResponse.json({ ...apiKey, rawKey }, { status: 201 });
}
