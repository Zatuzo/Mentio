import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import type { AutoOrganizeResult } from '@/app/lib/auto-organize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note || note.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const job = await prisma.autoOrganizeJob.findUnique({
    where: { itemType_itemId: { itemType: 'note', itemId: params.id } },
  });

  if (!job) return NextResponse.json({ status: 'none' });
  if (job.status !== 'done') return NextResponse.json({ status: job.status });

  let result: AutoOrganizeResult = { tags: [] };
  try {
    result = JSON.parse(job.result ?? '{}');
  } catch {
    return NextResponse.json({ status: 'failed' });
  }

  // Resolve space name if suggestion is present (validate it still exists)
  let suggestedSpace: { id: string; name: string; icon: string | null } | null = null;
  if (result.suggestedSpaceId && result.suggestedSpaceId !== note.spaceId) {
    suggestedSpace = await prisma.space.findFirst({
      where: { id: result.suggestedSpaceId, userId: session.user.id, isArchived: false },
      select: { id: true, name: true, icon: true },
    });
  }

  return NextResponse.json({
    status: 'done',
    suggestedSpace: suggestedSpace
      ? { id: suggestedSpace.id, name: suggestedSpace.name, icon: suggestedSpace.icon }
      : null,
    extractedTasks: result.extractedTasks ?? [],
    relatedNotes: result.relatedNotes ?? [],
    aiTags: result.tags?.filter((t) => t.confidence >= 0.7) ?? [],
  });
}
