import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let _client: OpenAI | null = null;
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY ?? 'missing',
      baseURL: 'https://api.deepseek.com',
    });
  }
  return _client;
}
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

function buildSystemPrompt(ctx: {
  projectName: string;
  techStack: string | null;
  prd: string | null;
  members: { id: string; name: string }[];
  existingTasks: { title: string; status: string }[];
}): string {
  const memberList = ctx.members.length > 0
    ? ctx.members.map((m) => `- ${m.name} (id: ${m.id})`).join('\n')
    : '- (no team members)';

  const taskList = ctx.existingTasks.length > 0
    ? ctx.existingTasks.map((t) => `- ${t.title} [${t.status}]`).join('\n')
    : '- (no existing tasks)';

  const prdSection = ctx.prd
    ? `\nProject brief/PRD:\n${ctx.prd.slice(0, 1500)}${ctx.prd.length > 1500 ? '…' : ''}\n`
    : '';

  return `You are a project manager AI agent for "${ctx.projectName}".

## Project Context
Tech stack: ${ctx.techStack ?? 'Not specified'}${prdSection}
## Team Members
${memberList}

## Existing Tasks (avoid duplicating these)
${taskList}

## Output Format
Output NDJSON — one JSON object per line, NO markdown, NO explanation, NO wrapping.

Line 1 — detected input type:
{"type":"meta","inputType":"<bug_report|feature_brief|meeting_notes|feedback|general>"}

Line 2+ — one task per line:
{"type":"task","data":{"title":"<verb + action, max 80 chars>","description":"<1-2 sentences or null>","priority":"<urgent|high|medium|low|none>","suggestedAssigneeId":"<member id or null>","isDuplicate":<true|false>,"confidence":"<high|low>"}}

## Rules
- Generate 2–15 tasks based on complexity
- Each title starts with a verb (Fix, Add, Implement, Update, Remove, Write, etc.)
- priority: infer from urgency — crash/blocker → urgent, important → high, default → medium
- isDuplicate: true only if nearly identical to an existing task title
- suggestedAssigneeId: set to a member id only when input clearly implies that person, otherwise null
- confidence: "high" if task is specific, clear, well-scoped, and not a duplicate; "low" if vague, broad, potentially duplicate, or needs clarification
- Same language as the input
- Output ONLY the JSON lines, nothing else`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { text, projectId } = body as { text?: string; projectId?: string };

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('[ai-generate] DEEPSEEK_API_KEY is not set');
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  // Fetch project context in parallel
  const [project, memberLinks, existingTasks] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, techStack: true, prd: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { title: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const systemPrompt = buildSystemPrompt({
    projectName: project?.name ?? 'Project',
    techStack: project?.techStack ?? null,
    prd: project?.prd ?? null,
    members: memberLinks.map((m) => ({ id: m.user.id, name: m.user.name })),
    existingTasks,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await getClient().chat.completions.create({
          model: MODEL,
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text.trim() },
          ],
        });

        let buffer = '';
        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta?.content ?? '';
          buffer += delta;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              JSON.parse(trimmed); // validate before forwarding
              controller.enqueue(encoder.encode(trimmed + '\n'));
            } catch {
              // skip malformed lines
            }
          }
        }
        // flush remaining buffer
        if (buffer.trim()) {
          try {
            JSON.parse(buffer.trim());
            controller.enqueue(encoder.encode(buffer.trim() + '\n'));
          } catch {}
        }
      } catch (err) {
        console.error('[ai-generate] stream error:', err);
        const msg = err instanceof Error ? err.message : 'AI request failed';
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: msg }) + '\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
