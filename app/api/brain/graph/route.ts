import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const [notes, wikiLinks, spaces, noteTags] = await Promise.all([
    prisma.note.findMany({
      where: { userId },
      select: { id: true, title: true, spaceId: true, updatedAt: true, content: true },
    }),
    prisma.noteLink.findMany({
      where: { userId },
      select: { sourceId: true, targetId: true },
    }),
    prisma.space.findMany({
      where: { userId },
      select: { id: true, name: true, icon: true, color: true },
    }),
    prisma.noteTag.findMany({
      where: { note: { userId } },
      select: { noteId: true, tag: { select: { id: true, name: true } } },
    }),
  ]);

  const spaceColorMap = new Map(
    spaces.map((s, i) => [s.id, s.color ?? PALETTE[i % PALETTE.length]]),
  );
  const spaceNameMap = new Map(
    spaces.map((s) => [s.id, `${s.icon ?? ''} ${s.name}`.trim()]),
  );

  const noteIds = new Set(notes.map((n) => n.id));

  // Build tag → noteIds mapping
  const tagMap = new Map<string, { name: string; noteIds: Set<string> }>();
  const noteTagsMap = new Map<string, string[]>();
  for (const nt of noteTags) {
    if (!noteIds.has(nt.noteId)) continue;
    if (!tagMap.has(nt.tag.id)) tagMap.set(nt.tag.id, { name: nt.tag.name, noteIds: new Set() });
    tagMap.get(nt.tag.id)!.noteIds.add(nt.noteId);
    if (!noteTagsMap.has(nt.noteId)) noteTagsMap.set(nt.noteId, []);
    noteTagsMap.get(nt.noteId)!.push(nt.tag.name);
  }

  // Note nodes
  const noteNodes = notes.map((n) => ({
    id: n.id,
    type: 'note' as const,
    name: n.title || 'Untitled',
    val: Math.max(1, Math.min(6, Math.sqrt((n.content?.length ?? 0) / 80))),
    color: spaceColorMap.get(n.spaceId) ?? PALETTE[0],
    spaceId: n.spaceId,
    spaceName: spaceNameMap.get(n.spaceId) ?? '',
    date: n.updatedAt.toISOString(),
    tags: noteTagsMap.get(n.id) ?? [],
    preview: n.content
      ? n.content.replace(/[#*`\[\]>]/g, '').replace(/\n+/g, ' ').trim().slice(0, 220)
      : '',
  }));

  // Tag nodes — only for tags shared by 2+ notes
  const tagNodes = Array.from(tagMap.entries())
    .filter(([, t]) => t.noteIds.size >= 2)
    .map(([tagId, t]) => ({
      id: `tag:${tagId}`,
      type: 'tag' as const,
      name: t.name,
      val: Math.min(t.noteIds.size, 5),
      color: '#94a3b8',
      spaceId: undefined,
      spaceName: '',
      date: '',
      tags: [],
      preview: '',
      noteCount: t.noteIds.size,
    }));

  const tagNodeIds = new Set(tagNodes.map((t) => t.id));

  // Wikilinks
  const wikiLinkData = wikiLinks
    .filter((l) => noteIds.has(l.sourceId) && noteIds.has(l.targetId))
    .map((l) => ({ source: l.sourceId, target: l.targetId, type: 'link' as const }));

  // Tag links: note → tag node
  const tagLinks: { source: string; target: string; type: 'tag' }[] = [];
  for (const [tagId, t] of tagMap) {
    const tagNodeId = `tag:${tagId}`;
    if (!tagNodeIds.has(tagNodeId)) continue;
    for (const noteId of t.noteIds) {
      tagLinks.push({ source: noteId, target: tagNodeId, type: 'tag' });
    }
  }

  const spaceData = spaces.map((s, i) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    color: s.color ?? PALETTE[i % PALETTE.length],
  }));

  return NextResponse.json({
    nodes: [...noteNodes, ...tagNodes],
    links: [...wikiLinkData, ...tagLinks],
    spaces: spaceData,
  });
}
