import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getSession } from '@/app/lib/session';

// GET /api/projects/[id]/members — list members of a project
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ensure the calling user is a member
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json(members);
}

// POST /api/projects/[id]/members — invite a member by email
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only admin can invite
  const callerMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (!callerMember || callerMember.role !== 'admin') {
    return NextResponse.json({ error: 'Only project admins can invite members' }, { status: 403 });
  }

  const { email, role = 'member' } = await req.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (!targetUser) {
    return NextResponse.json(
      { error: `No account found with email "${email}". Ask your team member to register first.` },
      { status: 404 }
    );
  }

  // Check if already a member
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: targetUser.id } },
  });
  if (existing) {
    return NextResponse.json({ error: 'User is already a member of this project' }, { status: 409 });
  }

  const member = await prisma.projectMember.create({
    data: { projectId: params.id, userId: targetUser.id, role },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return NextResponse.json(member, { status: 201 });
}

// DELETE /api/projects/[id]/members — remove a member by userId
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const callerMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (!callerMember || callerMember.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await req.json();

  // Can't remove yourself if you're the only admin
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself from a project' }, { status: 400 });
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: params.id, userId } },
  });

  return NextResponse.json({ success: true });
}
