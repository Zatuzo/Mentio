import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { NoteEditor } from '@/app/components/brain/NoteEditor';

export const dynamic = 'force-dynamic';

export default async function NotePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const [note, spaces, tags] = await Promise.all([
    prisma.note.findUnique({
      where: { id: params.id },
      include: {
        tags: { include: { tag: true } },
        space: { select: { id: true, name: true, icon: true } },
        tasks: { select: { id: true }, take: 1 },
        sourceMention: {
          select: {
            id: true, text: true, senderName: true, timestamp: true,
            group: { select: { name: true } },
          },
        },
      },
    }),
    prisma.space.findMany({
      where: { userId: session.user.id, isArchived: false },
      orderBy: [{ isInbox: 'desc' }, { order: 'asc' }],
    }),
    prisma.tag.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!note || note.userId !== session.user.id) notFound();

  // Clear isNew flag as soon as user opens the note
  if (note.isNew) {
    await prisma.note.update({ where: { id: params.id }, data: { isNew: false } });
  }

  const serialized = {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    sourceMention: note.sourceMention
      ? { ...note.sourceMention, timestamp: note.sourceMention.timestamp.toISOString() }
      : null,
  };

  return <NoteEditor note={serialized} spaces={spaces} allTags={tags} hasTask={note.tasks.length > 0} />;
}
