import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';
import { generateClaimCode, CLAIM_TTL_MS } from '@/app/lib/claim';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve the user's active project (cookie, then first membership). */
async function activeProjectId(userId: string): Promise<string | null> {
  const cookieId = cookies().get('mentio_project_id')?.value;
  if (cookieId) {
    const m = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: cookieId, userId } },
    });
    if (m) return cookieId;
  }
  const first = await prisma.projectMember.findFirst({
    where: { userId },
    orderBy: { project: { createdAt: 'asc' } },
  });
  return first?.projectId ?? null;
}

// GET /api/groups/claim — list this user's pending + recently claimed codes
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Expire stale pending claims lazily.
  await prisma.groupClaim.updateMany({
    where: { userId: session.user.id, status: 'pending', expiresAt: { lt: new Date() } },
    data: { status: 'expired' },
  });

  const claims = await prisma.groupClaim.findMany({
    where: {
      userId: session.user.id,
      OR: [
        { status: 'pending' },
        { status: 'claimed', claimedAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ claims });
}

// POST /api/groups/claim — generate a new claim code
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = await activeProjectId(session.user.id);
  if (!projectId) {
    return NextResponse.json(
      { error: 'Create a project before claiming groups' },
      { status: 400 }
    );
  }

  // Generate a code that isn't already taken.
  let code = generateClaimCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.groupClaim.findUnique({ where: { code } });
    if (!exists) break;
    code = generateClaimCode();
  }

  const claim = await prisma.groupClaim.create({
    data: {
      code,
      userId: session.user.id,
      projectId,
      expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
    },
  });

  return NextResponse.json({ claim }, { status: 201 });
}

// DELETE /api/groups/claim?id=... — cancel a pending claim
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const claim = await prisma.groupClaim.findUnique({ where: { id } });
  if (!claim || claim.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (claim.status === 'pending') {
    await prisma.groupClaim.delete({ where: { id } });
  }
  return NextResponse.json({ ok: true });
}
