import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { DailyLogClient } from '@/app/components/brain/DailyLogClient';

export const dynamic = 'force-dynamic';

export default async function DailyLogPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  // Load spaces + all tags for NoteEditor
  const [spaces, allTags] = await Promise.all([
    prisma.space.findMany({
      where: { userId, isArchived: false },
      orderBy: [{ isInbox: 'desc' }, { order: 'asc' }],
    }),
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <DailyLogClient spaces={spaces} allTags={allTags} />;
}
