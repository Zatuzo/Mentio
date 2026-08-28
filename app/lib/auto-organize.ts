import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { prisma } from './db';
import { searchSemantic } from './embeddings';

function getDeepSeek() {
  const provider = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseURL: 'https://api.deepseek.com',
  });
  return provider.chat(process.env.DEEPSEEK_MODEL ?? 'deepseek-chat');
}

export interface AutoOrganizeResult {
  tags: Array<{ name: string; confidence: number }>;
  suggestedTitle?: string;
  suggestedSpaceId?: string;
  suggestedSpaceName?: string;
  extractedTasks?: Array<{ title: string; priority: 'urgent' | 'high' | 'medium' | 'low' | 'none' }>;
  relatedNotes?: Array<{ id: string; title: string; similarity: number; spaceName: string }>;
}

export async function autoOrganizeNote(noteId: string): Promise<void> {
  if (!process.env.DEEPSEEK_API_KEY) return;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      space: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!note) return;
  const contentText = (note.content ?? '').replace(/[#*`_\[\]>]/g, '').trim();
  if (contentText.length < 30) return;

  const [existingTags, spaces] = await Promise.all([
    prisma.tag.findMany({ where: { userId: note.userId }, select: { name: true } }),
    prisma.space.findMany({
      where: { userId: note.userId, isArchived: false },
      select: { id: true, name: true },
    }),
  ]);

  const spaceList = spaces.map((s) => `${s.id}|${s.name}`).join(', ');

  try {
    const { text } = await generateText({
      model: getDeepSeek(),
      prompt: `Analyze this note. Return a JSON object with these fields:

Title: "${note.title}"
Content: "${contentText.slice(0, 700)}"
Current space: "${note.space.name}"
All spaces: ${spaceList}
Existing tags: ${existingTags.length ? existingTags.map((t) => t.name).join(', ') : 'none'}

Fields to return:
- "tags": [{name, confidence}] — 2-5 tags, confidence 0.0-1.0, only >= 0.7, prefer existing tag names
- "suggestedTitle": string (max 60 chars) — ONLY if title is "Untitled" or blank
- "suggestedSpaceId": string — ONLY if a different space clearly fits better (omit if current space is fine)
- "suggestedSpaceName": string — the name of suggested space (required if suggestedSpaceId set)
- "extractedTasks": [{title, priority}] — detect action items (todo, perlu, harus, - [ ], Setup X, Fix Y, Implement Z). priority: urgent/high/medium/low/none. Max 5 tasks. Omit if none found.

Return ONLY valid JSON. No explanation.
Example: {"tags":[{"name":"backend","confidence":0.9}],"extractedTasks":[{"title":"Setup search endpoint","priority":"medium"}]}`,
    });

    let result: AutoOrganizeResult = { tags: [] };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch?.[0] ?? '{"tags":[]}');
    } catch {
      result = { tags: [] };
    }

    // Apply AI tags
    for (const t of result.tags ?? []) {
      if (!t.name || (t.confidence ?? 0) < 0.7) continue;
      const tag = await prisma.tag.upsert({
        where: { userId_name: { userId: note.userId, name: t.name.toLowerCase().trim() } },
        create: { userId: note.userId, name: t.name.toLowerCase().trim() },
        update: {},
      });
      await prisma.noteTag
        .create({ data: { noteId: note.id, tagId: tag.id, confidence: t.confidence, source: 'ai' } })
        .catch(() => {});
    }

    // Auto-title
    if (result.suggestedTitle && (note.title === 'Untitled' || !note.title.trim())) {
      await prisma.note.update({
        where: { id: note.id },
        data: { title: result.suggestedTitle.trim().slice(0, 60) },
      });
    }

    // Fetch related notes via semantic search
    try {
      const related = await searchSemantic(note.userId, `${note.title} ${contentText.slice(0, 300)}`, 4);
      result.relatedNotes = related
        .filter((r) => r.id !== note.id)
        .slice(0, 3)
        .map((r) => ({ id: r.id, title: r.title, similarity: r.similarity, spaceName: r.meta }));
    } catch {
      // non-fatal
    }

    await prisma.autoOrganizeJob.upsert({
      where: { itemType_itemId: { itemType: 'note', itemId: noteId } },
      create: {
        userId: note.userId,
        itemType: 'note',
        itemId: noteId,
        status: 'done',
        attempts: 1,
        processedAt: new Date(),
        result: JSON.stringify(result),
      },
      update: { status: 'done', processedAt: new Date(), result: JSON.stringify(result) },
    });
  } catch {
    await prisma.autoOrganizeJob
      .upsert({
        where: { itemType_itemId: { itemType: 'note', itemId: noteId } },
        create: { userId: note.userId, itemType: 'note', itemId: noteId, status: 'failed', attempts: 1 },
        update: { status: 'failed', attempts: { increment: 1 } },
      })
      .catch(() => {});
  }
}
