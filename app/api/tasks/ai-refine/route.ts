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

type TaskInput = {
  title: string;
  description: string | null;
  priority: string;
  suggestedAssigneeId: string | null;
  isDuplicate: boolean;
};

function buildRefinePrompt(
  tasks: TaskInput[],
  instruction: string,
  members: { id: string; name: string }[],
): string {
  const memberList = members.length > 0
    ? members.map((m) => `- ${m.name} (id: ${m.id})`).join('\n')
    : '- (no team members)';

  const taskList = tasks
    .map((t, i) => {
      const assignee = members.find((m) => m.id === t.suggestedAssigneeId);
      const assigneeStr = assignee ? ` → assigned: ${assignee.name}` : '';
      return `${i}. [${t.priority}] ${t.title}${assigneeStr}${t.description ? `\n   ${t.description}` : ''}`;
    })
    .join('\n');

  return `You are a project manager AI helping to refine a task list.

## Team Members
${memberList}

## Current Task List
${taskList}

## User Instruction
"${instruction}"

## Output Format
Output the COMPLETE updated task list as NDJSON — one task per line, NO markdown, NO explanation.
{"type":"task","data":{"title":"<string>","description":"<string or null>","priority":"<urgent|high|medium|low|none>","suggestedAssigneeId":"<member id or null>","isDuplicate":<true|false>,"confidence":"<high|low>"}}

Rules:
- Return ALL tasks, including unmodified ones
- Apply the instruction precisely
- If asked to split a task, replace it with multiple tasks
- If asked to delete, omit it
- If asked to assign, set suggestedAssigneeId to the correct member id
- confidence: "high" if specific and clear; "low" if vague or needs clarification
- Keep the same language as the original tasks
- Output ONLY the JSON lines`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tasks, instruction, projectId } = body as {
    tasks?: TaskInput[];
    instruction?: string;
    projectId?: string;
  };

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'tasks is required' }, { status: 400 });
  }
  if (!instruction?.trim()) {
    return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('[ai-refine] DEEPSEEK_API_KEY is not set');
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  const memberLinks = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true } } },
  });
  const members = memberLinks.map((m) => ({ id: m.user.id, name: m.user.name }));

  const systemPrompt = buildRefinePrompt(tasks, instruction.trim(), members);
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
            { role: 'user', content: instruction.trim() },
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
              JSON.parse(trimmed);
              controller.enqueue(encoder.encode(trimmed + '\n'));
            } catch {}
          }
        }
        if (buffer.trim()) {
          try {
            JSON.parse(buffer.trim());
            controller.enqueue(encoder.encode(buffer.trim() + '\n'));
          } catch {}
        }
      } catch (err) {
        console.error('[ai-refine] stream error:', err);
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
