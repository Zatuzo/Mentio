import { getSession } from '@/app/lib/session';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/app/lib/db';
import nextDynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const CanvasShell = nextDynamic(
  () => import('@/app/components/CanvasShell').then((m) => m.CanvasShell),
  { ssr: false },
);

interface Props {
  params: { id: string };
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default async function NoteCanvasPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');

  const note = await prisma.note.findUnique({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, title: true, content: true },
  });
  if (!note) notFound();

  const seedContent = { title: note.title, body: stripHtml(note.content) };
  const currentUser = { id: session.user.id, name: session.user.name };

  return (
    <div className="-m-6 md:-m-8 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <Link
          href={`/brain/notes/${note.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Note
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-sm font-medium truncate">{note.title}</span>
      </div>
      <div className="flex-1 min-h-0">
        {/* Note canvas is shared — anyone with access to this note can collaborate */}
        <CanvasShell roomId={`note-${note.id}`} seedContent={seedContent} currentUser={currentUser} />
      </div>
    </div>
  );
}
