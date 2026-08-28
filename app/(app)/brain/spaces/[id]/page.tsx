import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { NewNoteButton } from '@/app/components/brain/NewNoteButton';
import { ConvertToTaskButton } from '@/app/components/brain/ConvertToTaskButton';
import { Pin, BookOpen, ChevronLeft, MessageCircle } from 'lucide-react';

function getNotePreview(content: string | null, sourceType: string | null): string {
  if (!content) return '';
  if (sourceType === 'wa_mention') {
    const match = content.match(/^>\s*(.+)/m);
    if (match) return match[1].replace(/[*`_\[\]]/g, '').trim().slice(0, 120);
  }
  return content
    .replace(/^>\s*/gm, '')
    .replace(/\*\*(From|Group|Date|To):\*\*[^\n]*/g, '')
    .replace(/[#*`_\[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 120);
}

export const dynamic = 'force-dynamic';

export default async function SpacePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const [space] = await Promise.all([
    prisma.space.findUnique({
      where: { id: params.id },
      include: {
        notes: {
          select: {
            id: true, title: true, content: true, isPinned: true,
            updatedAt: true, sourceType: true,
            tags: { include: { tag: true } },
            tasks: { select: { id: true }, take: 1 },
          },
          orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        },
      },
    }),
  ]);

  if (!space || space.userId !== session.user.id) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/brain"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold leading-none truncate">{space.name}</h1>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {space.notes.length} notes
              </span>
            </div>
            {space.description && (
              <p className="text-sm text-muted-foreground mt-1 truncate">{space.description}</p>
            )}
          </div>
        </div>
        <NewNoteButton spaceId={space.id} />
      </div>

      {space.notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
          <BookOpen className="w-10 h-10 opacity-20" />
          <p className="text-sm">No notes in this space yet.</p>
          <NewNoteButton spaceId={space.id} variant="outline" label="Create note" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {space.notes.map((note) => {
            const preview = getNotePreview(note.content, note.sourceType);
            const isWaMention = note.sourceType === 'wa_mention';
            return (
              <div key={note.id} className="group relative">
                <Link
                  href={`/brain/notes/${note.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 hover:border-white/15 hover:bg-white/[0.03] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-150 min-h-[96px]"
                >
                  {/* Title */}
                  <div className="flex items-start gap-1.5 min-w-0 pr-6">
                    {note.isPinned && <Pin className="w-3 h-3 text-muted-foreground/50 shrink-0 mt-0.5" />}
                    {isWaMention && <MessageCircle className="w-3 h-3 text-emerald-500/70 shrink-0 mt-0.5" />}
                    <p className="font-medium text-sm leading-snug line-clamp-2">{note.title}</p>
                  </div>

                  {/* Preview */}
                  {preview && (
                    <p className="text-xs text-muted-foreground/55 line-clamp-3 leading-relaxed flex-1">
                      {preview}
                    </p>
                  )}

                  {/* Footer: tags + date */}
                  <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                    <p className="text-[11px] text-muted-foreground/40 truncate">
                      {note.tags.slice(0, 3).map(t => `#${t.tag.name}`).join(' ')}
                    </p>
                    <span className="text-[10px] text-muted-foreground/35 tabular-nums shrink-0">
                      {new Date(note.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </Link>

                {note.tasks.length === 0 && (
                  <ConvertToTaskButton noteId={note.id} noteTitle={note.title} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
