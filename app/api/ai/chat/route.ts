// @ts-nocheck
import { NextRequest } from 'next/server';
import { streamText, tool, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { searchSemantic, embedNote } from '@/app/lib/embeddings';
import { ensureInbox } from '@/app/lib/brain';
import { defaultTaskDates } from '@/app/lib/task-defaults';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function getDeepSeekModel() {
  const provider = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseURL: 'https://api.deepseek.com',
  });
  return provider.chat(MODEL); // .chat() forces /chat/completions endpoint
}

const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const { messages, sessionId, projectId } = await req.json() as {
    messages: { role: string; content: string }[];
    sessionId: string;
    projectId?: string;
  };

  if (!sessionId) return new Response('sessionId required', { status: 400 });

  // Verify session ownership
  const chatSession = await prisma.aiChatSession.findUnique({ where: { id: sessionId } });
  if (!chatSession || chatSession.userId !== session.user.id) {
    return new Response('Not found', { status: 404 });
  }

  // Load project + member context
  const userId = session.user.id;
  const targetProjectId = projectId ?? (await prisma.projectMember.findFirst({
    where: { userId },
    include: { project: { select: { id: true } } },
    orderBy: { project: { createdAt: 'asc' } },
  }))?.project.id;

  const [userProjects, activeProject, projectMembers] = await Promise.all([
    prisma.projectMember.findMany({
      where: { userId },
      include: { project: { select: { id: true, name: true, techStack: true } } },
      take: 10,
    }),
    projectId ? prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, techStack: true },
    }) : null,
    targetProjectId ? prisma.projectMember.findMany({
      where: { projectId: targetProjectId },
      include: { user: { select: { id: true, name: true } } },
    }) : [],
  ]);

  const projectList = userProjects.map((pm) => `${pm.project.name} (id: ${pm.project.id})`).join(', ');
  const currentProjectName = activeProject?.name ?? userProjects[0]?.project.name ?? 'unknown';
  const defaultProjectId = projectId ?? userProjects[0]?.project.id;

  const memberListText = projectMembers.length > 0
    ? projectMembers.map((m) => `- ${m.user.name} (id: ${m.user.id}, role: ${m.role})`).join('\n')
    : '(no members yet — call list_members to fetch)';

  const systemPrompt = `You are Mentio AI — an intelligent assistant for the Mentio WhatsApp task management platform.

Current user: ${session.user.name} (id: ${userId})
Active project: ${currentProjectName}${activeProject ? ` (id: ${activeProject.id})` : ''}
All projects: ${projectList || 'none'}
Current time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB

Project members (use these IDs for assignedToId — do NOT use the current user's id for others):
${memberListText}

You can help with:
- Managing tasks (create, list, update status/priority/assignee, delete)
- Assigning tasks to project members — use member IDs above; call list_members to refresh if needed
- Browsing WhatsApp mentions
- Generating tasks from any text input (briefs, bug reports, meeting notes, feedback)
- Checking project and listener status
- Searching the user's Second Brain knowledge base (notes, ideas, past decisions)
- Creating notes in the user's Brain from the conversation
- Finding related notes, organizing inbox, saving mentions as notes
- Moving notes between spaces in bulk (organize_inbox → bulk_move_notes)
- Creating daily/weekly digest on demand (create_digest)
- Summarizing everything known about a topic (summarize_topic)
- General questions about their work

When listing tasks, format them nicely with status and priority.
Respond in the same language as the user.

## Assigning Tasks to Members
When the user mentions a person's name for assignment:
1. Call list_members (read-only, no confirmation needed) to get the correct user ID.
2. Match the name — if ambiguous, ask the user to clarify.
3. Use the ID as assignedToId when calling create_task, update_task, bulk_update_tasks, or create_task_from_mention.

## Write Action Protocol (MANDATORY)
Before calling ANY write tool (create_task, update_task, bulk_update_tasks, delete_task, create_task_from_mention), you MUST:
1. Describe exactly what you are about to do — list the tasks, fields, values, and assignee if applicable.
2. End your message with this exact token on its own line: ⚡CONFIRM_NEEDED
3. STOP — do not call any write tool yet. Wait for the user to confirm.

When the user confirms (yes / ok / lanjut / iya / proceed / confirmed), call the write tools and report what was done.
When the user cancels (no / batal / cancel), acknowledge and do not execute.

Read-only tools (list_tasks, list_mentions, list_projects, list_members, get_status, search_knowledge_base, find_related, get_inbox_notes, organize_inbox, summarize_topic) do NOT require confirmation.
Write tools (create_note, save_mention_as_note, bulk_move_notes, create_digest) DO require confirmation — follow the Write Action Protocol above.

## organize_inbox workflow
1. Call organize_inbox to get notes + spaces data.
2. Analyze and propose a plan: "Saya akan memindahkan X ke Space Y, A ke Space B, ...". End with ⚡CONFIRM_NEEDED.
3. On confirmation, call bulk_move_notes with the proposed moves.
After executing a confirmed write, do NOT append ⚡CONFIRM_NEEDED again.`;

  // Save the user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (lastUserMsg) {
    await prisma.aiChatMessage.create({
      data: { sessionId, role: 'user', content: lastUserMsg.content },
    });

    // Auto-title session from first message
    if (chatSession.title === 'New chat' && messages.length <= 2) {
      const title = lastUserMsg.content.slice(0, 50).trim();
      await prisma.aiChatSession.update({
        where: { id: sessionId },
        data: { title: title || 'New chat' },
      });
    }
  }

  const result = streamText({
    model: getDeepSeekModel(),
    system: systemPrompt,
    messages: messages as any,
    stopWhen: stepCountIs(5),
    tools: {
      // ── Tasks ──────────────────────────────────────────────────────────────

      list_tasks: tool({
        description: 'List tasks for the user. Default: only todo and in_progress (excludes done). Pass status="done" to see completed tasks, or status="todo,in_progress,done" for all.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('Project ID to filter by'),
          status: z.string().optional().describe('Comma-separated: "todo", "in_progress", "done", or "all" for everything. Default: todo+in_progress only.'),
          priority: z.string().optional().describe('Filter by priority: urgent,high,medium,low,none'),
          limit: z.number().optional().describe('Max number of tasks (default 50)'),
        }),
        execute: async ({ projectId: pid, status, priority, limit = 50 }) => {
          const where: Record<string, unknown> = { userId };
          if (pid) where.projectId = pid;
          else if (defaultProjectId) where.projectId = defaultProjectId;

          if (status === 'all') {
            // no status filter
          } else if (status) {
            where.status = { in: status.split(',').map((s) => s.trim()) };
          } else {
            where.status = { in: ['todo', 'in_progress'] };
          }

          if (priority) where.priority = { in: priority.split(',').map((s) => s.trim()) };

          const allTasks = await prisma.task.findMany({
            where,
            include: {
              group: { select: { name: true } },
              project: { select: { name: true } },
              assignedTo: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
          });

          const statusOrder: Record<string, number> = { todo: 0, in_progress: 1, done: 2 };
          const tasks = allTasks
            .sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))
            .slice(0, Math.min(limit, 100));
          return tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            project: t.project?.name,
            group: t.group?.name,
            assignedTo: t.assignedTo?.name,
            dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
          }));
        },
      }),

      create_task: tool({
        description: 'Create a new task.',
        inputSchema: z.object({
          title: z.string().describe('Task title, starts with a verb'),
          description: z.string().optional().describe('Task description'),
          priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
          projectId: z.string().optional().describe('Project ID (uses active project if omitted)'),
          assignedToId: z.string().optional().describe('User ID to assign to'),
        }),
        execute: async ({ title, description, priority = 'none', projectId: pid, assignedToId }) => {
          const targetProject = pid ?? defaultProjectId;
          if (!targetProject) return { error: 'No project available' };

          const statuses = await prisma.projectStatus.findMany({
            where: { projectId: targetProject },
            orderBy: { order: 'asc' },
            take: 1,
          });
          const defaultStatus = statuses[0]?.slug ?? 'todo';

          const task = await prisma.task.create({
            data: {
              userId,
              projectId: targetProject,
              title: title.trim(),
              description: description?.trim() ?? null,
              priority,
              status: defaultStatus,
              ...(assignedToId ? { assignedToId } : {}),
              ...defaultTaskDates(),
            },
            include: { assignedTo: { select: { name: true } } },
          });
          return { id: task.id, title: task.title, status: task.status, priority: task.priority, assignedTo: task.assignedTo?.name ?? null };
        },
      }),

      update_task: tool({
        description: 'Update a single task — status, priority, title, assignee, or deadline.',
        inputSchema: z.object({
          taskId: z.string().describe('Task ID'),
          status: z.string().optional().describe('New status slug'),
          priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
          title: z.string().optional(),
          assignedToId: z.string().nullable().optional().describe('User ID or null to unassign'),
          dueDate: z.string().nullable().optional().describe('ISO date string (YYYY-MM-DD) or null to clear'),
          startDate: z.string().nullable().optional().describe('ISO date string (YYYY-MM-DD) or null to clear'),
        }),
        execute: async ({ taskId, status, priority, title, assignedToId, dueDate, startDate }) => {
          const task = await prisma.task.findUnique({ where: { id: taskId } });
          if (!task || task.userId !== userId) return { error: 'Task not found' };
          const data: Record<string, unknown> = {};
          if (status !== undefined) data.status = status;
          if (priority !== undefined) data.priority = priority;
          if (title !== undefined) data.title = title.trim();
          if (assignedToId !== undefined) data.assignedToId = assignedToId;
          if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
          if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
          const updated = await prisma.task.update({ where: { id: taskId }, data });
          return { id: updated.id, title: updated.title, status: updated.status, priority: updated.priority, dueDate: updated.dueDate?.toISOString().slice(0, 10) ?? null };
        },
      }),

      bulk_update_tasks: tool({
        description: 'Update multiple tasks at once. Use this when the user wants to apply the same change (deadline, assignee, status, priority) to many tasks — e.g. "set deadline for all tasks to 2026-06-15" or "assign all todo tasks to user X".',
        inputSchema: z.object({
          taskIds: z.array(z.string()).describe('List of task IDs to update'),
          status: z.string().optional(),
          priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
          assignedToId: z.string().nullable().optional().describe('User ID or null to unassign'),
          dueDate: z.string().nullable().optional().describe('ISO date string (YYYY-MM-DD) or null to clear'),
          startDate: z.string().nullable().optional().describe('ISO date string (YYYY-MM-DD) or null to clear'),
        }),
        execute: async ({ taskIds, status, priority, assignedToId, dueDate, startDate }) => {
          if (!taskIds.length) return { error: 'No task IDs provided' };
          const data: Record<string, unknown> = {};
          if (status !== undefined) data.status = status;
          if (priority !== undefined) data.priority = priority;
          if (assignedToId !== undefined) data.assignedToId = assignedToId;
          if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
          if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
          if (!Object.keys(data).length) return { error: 'Nothing to update' };
          const result = await prisma.task.updateMany({
            where: { id: { in: taskIds }, userId },
            data,
          });
          return { updated: result.count };
        },
      }),

      delete_task: tool({
        description: 'Delete a task permanently.',
        inputSchema: z.object({
          taskId: z.string().describe('Task ID to delete'),
        }),
        execute: async ({ taskId }) => {
          const task = await prisma.task.findUnique({ where: { id: taskId } });
          if (!task || task.userId !== userId) return { error: 'Task not found' };
          await prisma.task.delete({ where: { id: taskId } });
          return { deleted: true, title: task.title };
        },
      }),

      // ── Mentions ────────────────────────────────────────────────────────────

      list_mentions: tool({
        description: 'List recent WhatsApp mentions.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Max results (default 10)'),
          processed: z.boolean().optional().describe('Filter by processed status'),
        }),
        execute: async ({ limit = 10, processed }) => {
          const where: Record<string, unknown> = { userId };
          if (processed !== undefined) where.processed = processed;
          const mentions = await prisma.mention.findMany({
            where,
            include: { group: { select: { name: true } } },
            orderBy: { timestamp: 'desc' },
            take: Math.min(limit, 30),
          });
          return mentions.map((m) => ({
            id: m.id,
            text: m.text.slice(0, 200),
            sender: m.senderName ?? m.senderJid,
            group: m.group.name,
            timestamp: m.timestamp.toISOString(),
            processed: m.processed,
          }));
        },
      }),

      create_task_from_mention: tool({
        description: 'Create a task from a WhatsApp mention. Use list_members first if you need to assign it to someone.',
        inputSchema: z.object({
          mentionId: z.string().describe('Mention ID'),
          title: z.string().describe('Task title'),
          priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional(),
          assignedToId: z.string().optional().describe('User ID to assign to (from list_members)'),
        }),
        execute: async ({ mentionId, title, priority = 'medium', assignedToId }) => {
          const mention = await prisma.mention.findUnique({
            where: { id: mentionId },
            include: { group: true },
          });
          if (!mention || mention.userId !== userId) return { error: 'Mention not found' };
          if (!defaultProjectId) return { error: 'No project available' };

          if (assignedToId) {
            const assigneeMember = await prisma.projectMember.findUnique({
              where: { projectId_userId: { projectId: defaultProjectId, userId: assignedToId } },
            });
            if (!assigneeMember) return { error: 'Assignee is not a member of this project' };
          }

          const statuses = await prisma.projectStatus.findMany({
            where: { projectId: defaultProjectId },
            orderBy: { order: 'asc' },
            take: 1,
          });

          const task = await prisma.task.create({
            data: {
              userId,
              projectId: defaultProjectId,
              groupId: mention.groupId,
              mentionId,
              title: title.trim(),
              priority,
              status: statuses[0]?.slug ?? 'todo',
              requester: mention.senderName ?? mention.senderJid,
              requesterJid: mention.senderJid,
              ...(assignedToId ? { assignedToId } : {}),
              ...defaultTaskDates(),
            },
            include: { assignedTo: { select: { name: true } } },
          });
          await prisma.mention.update({ where: { id: mentionId }, data: { processed: true } });
          return { taskId: task.id, title: task.title, from: mention.senderName, assignedTo: task.assignedTo?.name ?? null };
        },
      }),

      // ── Projects & Status ───────────────────────────────────────────────────

      list_projects: tool({
        description: 'List all projects the user belongs to.',
        inputSchema: z.object({}),
        execute: async () => {
          const members = await prisma.projectMember.findMany({
            where: { userId },
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  techStack: true,
                  _count: { select: { tasks: true } },
                },
              },
            },
          });
          return members.map((m) => ({
            id: m.project.id,
            name: m.project.name,
            role: m.role,
            techStack: m.project.techStack,
            totalTasks: m.project._count.tasks,
          }));
        },
      }),

      list_members: tool({
        description: 'List all members of a project with their IDs. ALWAYS call this before assigning tasks to someone, so you know the correct assignedToId.',
        inputSchema: z.object({
          projectId: z.string().optional().describe('Project ID (uses active project if omitted)'),
        }),
        execute: async ({ projectId: pid }) => {
          const targetProject = pid ?? defaultProjectId;
          if (!targetProject) return { error: 'No project available' };
          const members = await prisma.projectMember.findMany({
            where: { projectId: targetProject },
            include: { user: { select: { id: true, name: true, image: true } } },
          });
          return members.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            role: m.role,
          }));
        },
      }),

      get_status: tool({
        description: 'Get WhatsApp listener status and pending mention count.',
        inputSchema: z.object({}),
        execute: async () => {
          const [waSession, pendingCount, todayCount] = await Promise.all([
            prisma.waSession.findUnique({ where: { userId }, select: { connected: true, myJid: true } }),
            prisma.mention.count({ where: { userId, processed: false } }),
            prisma.mention.count({
              where: {
                userId,
                timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              },
            }),
          ]);
          return {
            connected: waSession?.connected ?? false,
            myJid: waSession?.myJid ?? null,
            pendingMentions: pendingCount,
            mentionsToday: todayCount,
          };
        },
      }),

      // ── Brain (Second Brain) ────────────────────────────────────────────────

      search_knowledge_base: tool({
        description: 'Search the user\'s Second Brain (notes, ideas, decisions) using semantic similarity. Use when the user asks about past notes, saved ideas, or things they may have written down.',
        inputSchema: z.object({
          query: z.string().describe('Natural language search query'),
          limit: z.number().optional().describe('Max results (default 5)'),
        }),
        execute: async ({ query, limit = 5 }) => {
          const results = await searchSemantic(userId, query, limit);
          if (!results.length) return { results: [], message: 'No matching notes found.' };
          return {
            results: results.map((r) => ({
              title: r.title,
              snippet: r.snippet,
              similarity: `${r.similarity}%`,
              url: r.url,
              space: r.meta,
              updatedAt: new Date(r.date).toLocaleDateString('id-ID'),
            })),
          };
        },
      }),

      create_note: tool({
        description: 'Create a new note in the user\'s Second Brain. Use when the user asks to save something as a note or capture an idea.',
        inputSchema: z.object({
          title: z.string().describe('Note title'),
          content: z.string().describe('Note content in Markdown'),
          spaceId: z.string().optional().describe('Space ID. If omitted, saves to Inbox.'),
          tags: z.array(z.string()).optional().describe('Tag names to attach'),
        }),
        execute: async ({ title, content, spaceId, tags }) => {
          const inbox = await ensureInbox(userId);
          const targetSpaceId = spaceId ?? inbox.id;

          const space = await prisma.space.findUnique({ where: { id: targetSpaceId } });
          if (!space || space.userId !== userId) return { error: 'Space not found' };

          // Upsert tags
          const tagRecords = await Promise.all(
            (tags ?? []).map((name) =>
              prisma.tag.upsert({
                where: { userId_name: { userId, name: name.toLowerCase().trim() } },
                update: {},
                create: { userId, name: name.toLowerCase().trim() },
              }),
            ),
          );

          const note = await prisma.note.create({
            data: {
              userId,
              spaceId: targetSpaceId,
              title: title.trim(),
              content,
              sourceType: 'manual',
              ...(tagRecords.length
                ? { tags: { create: tagRecords.map((t) => ({ tagId: t.id })) } }
                : {}),
            },
          });

          // Fire-and-forget embedding
          embedNote(note.id).catch(() => {});

          return {
            id: note.id,
            title: note.title,
            url: `/brain/notes/${note.id}`,
            space: space.name,
            message: `Note saved to "${space.name}"`,
          };
        },
      }),

      // ── AI Manage tools ─────────────────────────────────────────────────────

      find_related: tool({
        description: "Find notes semantically related to a given note. Use when user asks 'what's related to this note?' or 'find similar notes'.",
        inputSchema: z.object({
          noteId: z.string().optional().describe('Note ID to find related notes for'),
          query: z.string().optional().describe('Fallback: text query if no noteId'),
          limit: z.number().optional().describe('Max results (default 5)'),
        }),
        execute: async ({ noteId, query, limit = 5 }) => {
          let searchQuery = query ?? '';
          if (noteId) {
            const note = await prisma.note.findUnique({ where: { id: noteId } });
            if (!note || note.userId !== userId) return { error: 'Note not found' };
            searchQuery = `${note.title} ${(note.content ?? '').slice(0, 300)}`;
          }
          if (!searchQuery.trim()) return { results: [], message: 'No query provided.' };
          const results = await searchSemantic(userId, searchQuery, limit + 1);
          const filtered = noteId ? results.filter((r) => r.id !== noteId) : results;
          if (!filtered.length) return { results: [], message: 'No related notes found.' };
          return {
            results: filtered.slice(0, limit).map((r) => ({
              title: r.title,
              snippet: r.snippet,
              relevance: `${r.similarity}%`,
              url: r.url,
              space: r.meta,
            })),
          };
        },
      }),

      get_inbox_notes: tool({
        description: "List notes currently in the user's Inbox space. Use when user asks to organize inbox or review unorganized notes.",
        inputSchema: z.object({
          limit: z.number().optional().describe('Max results (default 20)'),
        }),
        execute: async ({ limit = 20 }) => {
          const inbox = await prisma.space.findFirst({
            where: { userId, isInbox: true },
            select: { id: true, name: true },
          });
          if (!inbox) return { error: 'Inbox not found' };
          const notes = await prisma.note.findMany({
            where: { userId, spaceId: inbox.id, isDaily: false },
            include: { tags: { include: { tag: true } } },
            orderBy: { createdAt: 'asc' },
            take: Math.min(limit, 50),
          });
          return {
            inboxId: inbox.id,
            total: notes.length,
            notes: notes.map((n) => ({
              id: n.id,
              title: n.title,
              preview: (n.content ?? '').replace(/[#*`_\[\]>]/g, '').replace(/\n/g, ' ').slice(0, 120),
              tags: n.tags.map((t) => t.tag.name),
              createdAt: n.createdAt.toLocaleDateString('id-ID'),
            })),
          };
        },
      }),

      save_mention_as_note: tool({
        description: "Save a WhatsApp mention as a note in the user's Brain.",
        inputSchema: z.object({
          mentionId: z.string().describe('Mention ID to save'),
          spaceId: z.string().optional().describe('Target space ID. If omitted, saves to Inbox.'),
          additionalContext: z.string().optional().describe('Extra context or notes to append'),
        }),
        execute: async ({ mentionId, spaceId, additionalContext }) => {
          const mention = await prisma.mention.findUnique({
            where: { id: mentionId },
            include: { group: { select: { name: true } } },
          });
          if (!mention || mention.userId !== userId) return { error: 'Mention not found' };
          if (mention.savedAsNoteId) return { error: 'Mention already saved as a note', noteId: mention.savedAsNoteId };

          const inbox = await ensureInbox(userId);
          const targetSpaceId = spaceId ?? inbox.id;
          const space = await prisma.space.findUnique({ where: { id: targetSpaceId } });
          if (!space || space.userId !== userId) return { error: 'Space not found' };

          const date = mention.timestamp.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
          const content = `> ${mention.text}\n\n**From:** ${mention.senderName ?? mention.senderJid} · **Group:** ${mention.group.name} · **Date:** ${date}${additionalContext ? `\n\n---\n\n${additionalContext}` : ''}`;

          const note = await prisma.note.create({
            data: {
              userId,
              spaceId: targetSpaceId,
              title: mention.text.slice(0, 60).trim() || 'WA Mention',
              content,
              sourceType: 'wa_mention',
              sourceMentionId: mention.id,
            },
          });
          await prisma.mention.update({ where: { id: mentionId }, data: { savedAsNoteId: note.id } });

          embedNote(note.id).catch(() => {});
          return { id: note.id, title: note.title, url: `/brain/notes/${note.id}`, space: space.name };
        },
      }),

      // ── Brain management tools ──────────────────────────────────────────────

      bulk_move_notes: tool({
        description: 'Move multiple notes to a different space. Use after organize_inbox when the user confirms the plan.',
        inputSchema: z.object({
          moves: z.array(
            z.object({
              noteId: z.string().describe('Note ID'),
              spaceId: z.string().describe('Target space ID'),
            }),
          ).describe('List of note → space moves to perform'),
        }),
        execute: async ({ moves }) => {
          if (!moves.length) return { error: 'No moves provided' };
          let moved = 0;
          const errors: string[] = [];
          for (const { noteId, spaceId } of moves) {
            const note = await prisma.note.findUnique({ where: { id: noteId } });
            if (!note || note.userId !== userId) { errors.push(`Note ${noteId} not found`); continue; }
            const space = await prisma.space.findUnique({ where: { id: spaceId } });
            if (!space || space.userId !== userId) { errors.push(`Space ${spaceId} not found`); continue; }
            await prisma.note.update({ where: { id: noteId }, data: { spaceId } });
            moved++;
          }
          return { moved, errors: errors.length ? errors : undefined };
        },
      }),

      organize_inbox: tool({
        description: 'Fetch all inbox notes AND available spaces so you can suggest an organization plan. Call this when the user asks to organize their inbox. After analyzing, propose which note goes to which space, then use bulk_move_notes to execute after confirmation.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Max inbox notes to analyze (default 30)'),
        }),
        execute: async ({ limit = 30 }) => {
          const [inbox, spaces] = await Promise.all([
            prisma.space.findFirst({ where: { userId, isInbox: true }, select: { id: true } }),
            prisma.space.findMany({
              where: { userId, isArchived: false, isInbox: false },
              select: { id: true, name: true, icon: true },
              orderBy: { order: 'asc' },
            }),
          ]);
          if (!inbox) return { error: 'Inbox not found' };
          const notes = await prisma.note.findMany({
            where: { userId, spaceId: inbox.id, isDaily: false },
            select: {
              id: true,
              title: true,
              content: true,
              tags: { include: { tag: { select: { name: true } } } },
            },
            orderBy: { createdAt: 'asc' },
            take: Math.min(limit, 50),
          });
          return {
            inboxId: inbox.id,
            spaces: spaces.map((s) => ({ id: s.id, name: s.name, icon: s.icon })),
            notes: notes.map((n) => ({
              id: n.id,
              title: n.title,
              preview: (n.content ?? '').replace(/[#*`_\[\]>]/g, '').replace(/\n/g, ' ').slice(0, 150),
              tags: n.tags.map((t) => t.tag.name),
            })),
          };
        },
      }),

      create_digest: tool({
        description: "Trigger generation of today's daily digest or this week's weekly review for the user. Use when user asks to create a summary of their day or week.",
        inputSchema: z.object({
          type: z.enum(['daily', 'weekly']).describe('"daily" for today summary, "weekly" for this week review'),
        }),
        execute: async ({ type }) => {
          const { generateDailyDigest } = await import('@/app/lib/digest');
          const { generateWeeklyReview, currentWeekPeriod } = await import('@/app/lib/weekly-review');

          const period =
            type === 'weekly'
              ? currentWeekPeriod()
              : new Date().toISOString().slice(0, 10);

          const existing = await prisma.digest.findUnique({
            where: { userId_type_period: { userId, type, period } },
          });
          if (existing) {
            return {
              cached: true,
              period,
              type,
              preview: existing.content.replace(/[#*`]/g, '').trim().slice(0, 300),
              url: '/brain/digest',
              message: `${type === 'weekly' ? 'Weekly review' : 'Daily digest'} sudah ada untuk ${period}. Lihat di /brain/digest.`,
            };
          }

          const content =
            type === 'weekly'
              ? await generateWeeklyReview(userId)
              : await generateDailyDigest(userId);

          if (!content) {
            return { error: 'Tidak ada aktivitas untuk dirangkum hari ini.' };
          }

          const digest = await prisma.digest.create({
            data: { userId, type, period, content },
          });

          return {
            cached: false,
            id: digest.id,
            period,
            type,
            preview: content.replace(/[#*`]/g, '').trim().slice(0, 300),
            url: '/brain/digest',
            message: `${type === 'weekly' ? 'Weekly review' : 'Daily digest'} berhasil dibuat! Buka /brain/digest untuk melihat.`,
          };
        },
      }),

      summarize_topic: tool({
        description: 'Search notes AND recent mentions about a topic, then return the raw data so you can synthesize a summary. Use when user asks "summarize everything about X" or "apa yang aku tahu tentang X?".',
        inputSchema: z.object({
          topic: z.string().describe('The topic or keyword to search for'),
          includeNotes: z.boolean().optional().describe('Include Brain notes (default true)'),
          includeMentions: z.boolean().optional().describe('Include WA mentions (default true)'),
          limit: z.number().optional().describe('Max items per source (default 8)'),
        }),
        execute: async ({ topic, includeNotes = true, includeMentions = true, limit = 8 }) => {
          const results: Record<string, unknown> = { topic };

          if (includeNotes) {
            const noteResults = await searchSemantic(userId, topic, limit);
            results.notes = noteResults.map((r) => ({
              title: r.title,
              snippet: r.snippet,
              relevance: `${r.similarity}%`,
              space: r.meta,
              url: r.url,
              date: new Date(r.date).toLocaleDateString('id-ID'),
            }));
          }

          if (includeMentions) {
            const mentions = await prisma.mention.findMany({
              where: {
                userId,
                text: { contains: topic, mode: 'insensitive' },
              },
              include: { group: { select: { name: true } } },
              orderBy: { timestamp: 'desc' },
              take: Math.min(limit, 20),
            });
            results.mentions = mentions.map((m) => ({
              text: m.text.slice(0, 200),
              sender: m.senderName ?? m.senderJid,
              group: m.group.name,
              date: m.timestamp.toLocaleDateString('id-ID'),
            }));
          }

          return results;
        },
      }),

      generate_tasks_from_text: tool({
        description: 'Analyze a text (brief, feedback, bug report, meeting notes) and suggest a list of tasks. Returns suggested tasks for the user to review — does NOT insert them automatically.',
        inputSchema: z.object({
          text: z.string().describe('The input text to analyze'),
          projectId: z.string().optional().describe('Project ID'),
        }),
        execute: async ({ text, projectId: pid }) => {
          // Return a structured suggestion — UI handles the actual generation
          return {
            action: 'open_ai_import',
            text,
            projectId: pid ?? defaultProjectId,
            message: 'Use the AI Import button on the dashboard to generate tasks from this text, or I can describe the suggested tasks here.',
          };
        },
      }),
    },

    onFinish: async ({ text }) => {
      // Persist assistant response — strip confirmation token so it doesn't reappear on session reload
      if (text) {
        const cleanText = text.replace('⚡CONFIRM_NEEDED', '').trimEnd();
        await prisma.aiChatMessage.create({
          data: { sessionId, role: 'assistant', content: cleanText },
        });
        await prisma.aiChatSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() },
        });
      }
    },
  });

  return result.toTextStreamResponse();
}
