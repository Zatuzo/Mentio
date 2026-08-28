import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { validateMcpKey } from '@/app/lib/mcp-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const key = await validateMcpKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userGroups = await prisma.userGroup.findMany({
    where: { userId: key.userId, enabled: true },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          _count: { select: { mentions: true, tasks: true } },
        },
      },
    },
  });

  return NextResponse.json(
    userGroups.map((ug) => ({
      id: ug.group.id,
      name: ug.group.name,
      mentionCount: ug.group._count.mentions,
      taskCount: ug.group._count.tasks,
    }))
  );
}
