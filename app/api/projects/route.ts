import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const members = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: true },
    orderBy: { project: { createdAt: 'asc' } },
  });

  return NextResponse.json(members.map((m) => ({ ...m.project, role: m.role })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      members: {
        create: { userId: session.user.id, role: 'admin' },
      },
      statuses: {
        create: [
          { slug: 'todo',        label: 'To Do',       color: '#6b7280', order: 0, isDone: false },
          { slug: 'in_progress', label: 'In Progress',  color: '#3b82f6', order: 1, isDone: false },
          { slug: 'done',        label: 'Done',         color: '#10b981', order: 2, isDone: true  },
        ],
      },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
