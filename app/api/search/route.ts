import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type SearchResultItem = {
  id: string;
  type: 'note' | 'mention' | 'summary' | 'task';
  title: string;
  snippet: string;
  meta: string; // e.g. space name, group name
  url: string;
  date: string;
};

function snippet(text: string, query: string, maxLen = 160): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase().split(' ')[0]);
  const start = Math.max(0, idx - 40);
  const raw = text.slice(start, start + maxLen);
  return (start > 0 ? '…' : '') + raw + (raw.length === maxLen ? '…' : '');
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const types = searchParams.get('types')?.split(',').filter(Boolean) ?? ['note', 'mention', 'summary', 'task'];

  if (!q || q.length < 2) return NextResponse.json([]);

  const userId = session.user.id;
  const results: SearchResultItem[] = [];

  // Build a safe tsquery — join words with &, strip special chars
  const tsQuery = q
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w}:*`)
    .join(' & ');

  if (!tsQuery) return NextResponse.json([]);

  await Promise.all([
    // ── Notes ──────────────────────────────────────────────────────────────
    types.includes('note')
      ? prisma.$queryRaw<{ id: string; title: string; content: string; spaceName: string; updatedAt: Date }[]>`
          SELECT n.id, n.title, n.content, s.name AS "spaceName", n."updatedAt"
          FROM "Note" n
          JOIN "Space" s ON s.id = n."spaceId"
          WHERE n."userId" = ${userId}
            AND to_tsvector('english', n.title || ' ' || n.content) @@ to_tsquery('english', ${tsQuery})
          ORDER BY n."updatedAt" DESC
          LIMIT 10
        `.then((rows) =>
          rows.forEach((r) =>
            results.push({
              id: r.id,
              type: 'note',
              title: r.title,
              snippet: snippet(r.content, q),
              meta: r.spaceName,
              url: `/brain/notes/${r.id}`,
              date: r.updatedAt.toISOString(),
            })
          )
        )
      : Promise.resolve(),

    // ── Mentions ───────────────────────────────────────────────────────────
    types.includes('mention')
      ? prisma.$queryRaw<{ id: string; text: string; senderName: string | null; groupName: string; timestamp: Date }[]>`
          SELECT m.id, m.text, m."senderName", g.name AS "groupName", m.timestamp
          FROM "Mention" m
          JOIN "Group" g ON g.id = m."groupId"
          WHERE m."userId" = ${userId}
            AND to_tsvector('english', m.text) @@ to_tsquery('english', ${tsQuery})
          ORDER BY m.timestamp DESC
          LIMIT 10
        `.then((rows) =>
          rows.forEach((r) =>
            results.push({
              id: r.id,
              type: 'mention',
              title: r.senderName ? `${r.senderName} di ${r.groupName}` : r.groupName,
              snippet: snippet(r.text, q),
              meta: r.groupName,
              url: `/inbox`,
              date: r.timestamp.toISOString(),
            })
          )
        )
      : Promise.resolve(),

    // ── Summaries ──────────────────────────────────────────────────────────
    types.includes('summary')
      ? prisma.$queryRaw<{ id: string; content: string; groupName: string; createdAt: Date }[]>`
          SELECT s.id, s.content, g.name AS "groupName", s."createdAt"
          FROM "Summary" s
          JOIN "Group" g ON g.id = s."groupId"
          WHERE s."userId" = ${userId}
            AND to_tsvector('english', s.content) @@ to_tsquery('english', ${tsQuery})
          ORDER BY s."createdAt" DESC
          LIMIT 5
        `.then((rows) =>
          rows.forEach((r) =>
            results.push({
              id: r.id,
              type: 'summary',
              title: `Summary — ${r.groupName}`,
              snippet: snippet(r.content, q),
              meta: r.groupName,
              url: `/group/${r.id}`,
              date: r.createdAt.toISOString(),
            })
          )
        )
      : Promise.resolve(),

    // ── Tasks ──────────────────────────────────────────────────────────────
    types.includes('task')
      ? prisma.$queryRaw<{ id: string; title: string; description: string | null; status: string; updatedAt: Date }[]>`
          SELECT t.id, t.title, t.description, t.status, t."updatedAt"
          FROM "Task" t
          WHERE t."userId" = ${userId}
            AND to_tsvector('english', t.title || ' ' || coalesce(t.description, '')) @@ to_tsquery('english', ${tsQuery})
          ORDER BY t."updatedAt" DESC
          LIMIT 10
        `.then((rows) =>
          rows.forEach((r) =>
            results.push({
              id: r.id,
              type: 'task',
              title: r.title,
              snippet: r.description ? snippet(r.description, q) : r.status,
              meta: r.status,
              url: `/dashboard`,
              date: r.updatedAt.toISOString(),
            })
          )
        )
      : Promise.resolve(),
  ]);

  // Sort all results by date descending
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json(results);
}
