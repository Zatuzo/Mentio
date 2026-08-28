import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { validateMcpKey, requireScope } from '@/app/lib/mcp-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const groupId = searchParams.get('groupId');
  const date = searchParams.get('date'); // ISO date, filters by that day

  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  // Verify user has access to this group
  const userGroup = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId: key.userId, groupId } },
  });
  if (!userGroup) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const where: Record<string, unknown> = { groupId, userId: key.userId };
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { gte: start, lte: end };
  }

  const summary = await prisma.summary.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      mentionFrom: true,
      mentionTo: true,
      createdAt: true,
      group: { select: { id: true, name: true } },
    },
  });

  if (!summary) return NextResponse.json({ error: 'No summary found' }, { status: 404 });

  return NextResponse.json({
    id: summary.id,
    content: summary.content,
    mentionFrom: summary.mentionFrom.toISOString(),
    mentionTo: summary.mentionTo.toISOString(),
    createdAt: summary.createdAt.toISOString(),
    group: summary.group,
  });
}

export async function POST(req: NextRequest) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!requireScope(key, 'write')) {
    return NextResponse.json({ error: 'Forbidden: write scope required' }, { status: 403 });
  }

  const body = await req.json();
  const { groupId } = body as { groupId?: string };
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  const userGroup = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId: key.userId, groupId } },
  });
  if (!userGroup) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  // Trigger summarization by calling the internal summarize endpoint
  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, userId: key.userId }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown error');
    return NextResponse.json({ error: `Summarize failed: ${err}` }, { status: 502 });
  }

  const result = await res.json();
  return NextResponse.json({ ok: true, jobId: result.id ?? null });
}
