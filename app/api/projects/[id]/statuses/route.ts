import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return member?.role === 'admin' ? member : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const statuses = await prisma.projectStatus.findMany({
    where: { projectId: params.id },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(statuses);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await requireAdmin(params.id, session.user.id);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { label, color, isDone } = await req.json() as {
    label?: string;
    color?: string;
    isDone?: boolean;
  };

  if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 });

  // Generate slug from label: lowercase, replace spaces/special chars with underscore
  const baseSlug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!baseSlug) return NextResponse.json({ error: 'Invalid label' }, { status: 400 });

  // Ensure slug uniqueness within the project
  const existing = await prisma.projectStatus.findMany({
    where: { projectId: params.id, slug: { startsWith: baseSlug } },
    select: { slug: true },
  });
  const slugSet = new Set(existing.map((s) => s.slug));
  let slug = baseSlug;
  let suffix = 2;
  while (slugSet.has(slug)) slug = `${baseSlug}_${suffix++}`;

  const maxOrder = await prisma.projectStatus.aggregate({
    where: { projectId: params.id },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const status = await prisma.projectStatus.create({
    data: {
      projectId: params.id,
      slug,
      label: label.trim(),
      color: color ?? '#6b7280',
      order,
      isDone: isDone ?? false,
    },
  });

  return NextResponse.json(status, { status: 201 });
}

// POST /reorder — body: { slugs: string[] } (full ordered list)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await requireAdmin(params.id, session.user.id);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { slugs } = await req.json() as { slugs: string[] };
  if (!Array.isArray(slugs)) return NextResponse.json({ error: 'slugs array required' }, { status: 400 });

  await prisma.$transaction(
    slugs.map((slug, index) =>
      prisma.projectStatus.updateMany({
        where: { projectId: params.id, slug },
        data: { order: index },
      })
    )
  );

  const updated = await prisma.projectStatus.findMany({
    where: { projectId: params.id },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(updated);
}
