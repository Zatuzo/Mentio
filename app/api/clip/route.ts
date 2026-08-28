import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { ensureInbox } from '@/app/lib/brain';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 });
  }
  const token = auth.slice(7).trim();

  const user = await prisma.user.findFirst({ where: { clipToken: token }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { title, url, selection, description } = body as Record<string, string>;

  const inbox = await ensureInbox(user.id);

  const parts: string[] = [];
  if (selection?.trim()) parts.push(`> ${selection.trim().replace(/\n/g, '\n> ')}`);
  if (description?.trim()) parts.push(description.trim());
  if (url) parts.push(`---\n[Source](${url})`);
  const content = parts.join('\n\n');

  const note = await prisma.note.create({
    data: {
      userId: user.id,
      spaceId: inbox.id,
      title: title?.trim() || 'Web clip',
      content,
      sourceType: 'web_clip',
      sourceUrl: url?.trim() || null,
    },
  });

  return NextResponse.json({ id: note.id, ok: true }, { status: 201 });
}
