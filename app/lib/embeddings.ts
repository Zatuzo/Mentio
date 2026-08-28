import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { prisma } from './db';

function getDeepSeek() {
  const provider = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseURL: 'https://api.deepseek.com',
  });
  return provider.chat(process.env.DEEPSEEK_MODEL ?? 'deepseek-chat');
}

export interface SemanticResult {
  id: string;
  type: 'note';
  title: string;
  snippet: string;
  similarity: number;
  url: string;
  meta: string;
  date: string;
}

export async function searchSemantic(
  userId: string,
  query: string,
  limit = 8,
): Promise<SemanticResult[]> {
  const notes = await prisma.note.findMany({
    where: { userId },
    include: { space: { select: { name: true, icon: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 60,
  });

  if (!notes.length) return [];

  const noteList = notes
    .map((n, i) =>
      `[${i}] id="${n.id}" title="${n.title}" preview="${n.content.replace(/[#*`_\[\]]/g, '').slice(0, 120)}"`,
    )
    .join('\n');

  const { text } = await generateText({
    model: getDeepSeek(),
    prompt: `Semantic search engine. Find the most relevant notes for the query.

Query: "${query}"

Notes:
${noteList}

Return a JSON object with a "results" array. Each item has "id" (the note id string) and "relevance" (0-100).
Return up to ${limit} most relevant notes. Omit notes with relevance below 30.
Return ONLY valid JSON, no explanation.

Example: {"results":[{"id":"abc","relevance":85},{"id":"xyz","relevance":72}]}`,
  });

  let parsed: { results: Array<{ id: string; relevance: number }> };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? '{"results":[]}');
  } catch {
    return [];
  }

  const noteMap = new Map(notes.map((n) => [n.id, n]));
  return (parsed.results ?? [])
    .sort((a: { id: string; relevance: number }, b: { id: string; relevance: number }) => b.relevance - a.relevance)
    .flatMap((r: { id: string; relevance: number }) => {
      const note = noteMap.get(r.id);
      if (!note) return [];
      return [
        {
          id: note.id,
          type: 'note' as const,
          title: note.title,
          snippet: note.content.replace(/[#*`_\[\]]/g, '').slice(0, 160),
          similarity: r.relevance,
          url: `/brain/notes/${note.id}`,
          meta: `${note.space.icon ?? ''} ${note.space.name}`.trim(),
          date: note.updatedAt.toISOString(),
        },
      ];
    });
}

// Stub — used when OPENAI_API_KEY is available for vector embeddings (future)
export async function embedNote(_noteId: string): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return;
  // Vector embedding logic here when orchestrator is set up
}
