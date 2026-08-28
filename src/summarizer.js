const OpenAI = require('openai');
const cron = require('node-cron');
const { prisma } = require('./db');
const { DEEPSEEK_API_KEY, DEEPSEEK_MODEL, SUMMARY_CRON } = require('./config');

function defaultTaskDates() {
  const start = new Date(); start.setHours(0,0,0,0);
  const due = new Date(start); due.setDate(due.getDate() + 3);
  return { startDate: start, dueDate: due };
}

const client = DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

// summarizeGroup(groupId, userId, opts?)
//   opts.projectId — force tasks into this project (e.g. user clicked
//   "Summarize now" from a specific project's dashboard). Without it we fall
//   back to the user's earliest-created project that owns this group, so the
//   choice is deterministic even when the group is shared across projects.
async function summarizeGroup(groupId, userId, opts = {}) {
  if (!client) {
    console.error('[summarizer] DEEPSEEK_API_KEY missing — skipping');
    return null;
  }

  const mentionWhere = { groupId, processed: false };
  if (userId) mentionWhere.userId = userId;

  const mentions = await prisma.mention.findMany({
    where: mentionWhere,
    orderBy: { timestamp: 'asc' },
  });
  if (mentions.length === 0) return null;

  const group = await prisma.group.findUnique({ where: { id: groupId } });

  const lines = mentions.map(
    (m) => `[${m.timestamp.toISOString()}] ${m.senderName || m.senderJid}: ${m.text}`
  );

  const prompt = `You are analyzing WhatsApp messages from group "${group?.name || groupId}" where the user was tagged/mentioned.

Return ONLY a valid JSON object (no markdown, no code block) with this exact shape:
{
  "summary": "<concise markdown summary, max 300 words, grouped by topic, each item: who asked + what they need + deadline/urgency>",
  "tasks": [
    {
      "title": "<short action title>",
      "description": "<detail or context, optional>",
      "requester": "<sender name>",
      "requesterJid": "<sender jid>",
      "priority": "<urgent|high|medium|low|none>"
    }
  ]
}

Priority rules (infer from message content and tone):
- urgent: needs to be done TODAY — keywords: ASAP, sekarang, hari ini, urgent, segera, deadline hari ini, immediately
- high: needs to be done THIS WEEK — keywords: besok, minggu ini, this week, soon, cepat
- medium: has a clear but non-urgent deadline, or requester explicitly stated importance
- low: no urgency signal, nice-to-have, someday
- none: unclear, or purely informational with no time pressure

Rules:
- Only include tasks that require the user to DO something (skip FYI messages)
- If no actionable tasks, return empty array for tasks
- summary field must be markdown formatted

Messages:
${lines.join('\n')}`;

  const resp = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const raw = resp.choices[0]?.message?.content?.trim() ?? '{}';
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { summary: raw, tasks: [] };
  }

  const content = parsed.summary || raw;
  const extractedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

  const summaryData = {
    groupId,
    content,
    mentionFrom: mentions[0].timestamp,
    mentionTo: mentions[mentions.length - 1].timestamp,
    mentionIds: JSON.stringify(mentions.map((m) => m.id)),
  };
  if (userId) summaryData.userId = userId;

  const summary = await prisma.summary.create({ data: summaryData });

  // Resolve which project these tasks belong to.
  // Precedence: explicit opts.projectId (verified) > user's oldest project
  // that owns this group (deterministic fallback).
  let projectId = null;
  if (userId) {
    if (opts.projectId) {
      const allowed = await prisma.projectGroup.findFirst({
        where: {
          projectId: opts.projectId,
          groupId,
          project: { members: { some: { userId } } },
        },
      });
      if (allowed) projectId = opts.projectId;
    }
    if (!projectId) {
      const pg = await prisma.projectGroup.findFirst({
        where: { groupId, project: { members: { some: { userId } } } },
        orderBy: { project: { createdAt: 'asc' } },
      });
      if (pg) projectId = pg.projectId;
    }
  }

  // Create tasks extracted by AI
  if (extractedTasks.length > 0 && userId) {
    await prisma.task.createMany({
      data: extractedTasks.map((t) => {
        const validPriorities = ['urgent', 'high', 'medium', 'low', 'none'];
        const priority = validPriorities.includes(t.priority) ? t.priority : 'none';
        return {
          userId,
          projectId,
          groupId,
          summaryId: summary.id,
          title: t.title || 'Untitled task',
          description: t.description || null,
          requester: t.requester || null,
          requesterJid: t.requesterJid || null,
          status: 'todo',
          priority,
          ...defaultTaskDates(),
        };
      }),
    });
    console.log(`[summarizer] created ${extractedTasks.length} tasks for user ${userId}`);
  }

  await prisma.mention.updateMany({
    where: { id: { in: mentions.map((m) => m.id) } },
    data: { processed: true },
  });

  console.log(`[summarizer] ${group?.name || groupId}: summarized ${mentions.length} mentions`);
  return summary;
}

async function runOnce(userId, projectId) {
  // Get enabled groups for this user (or all groups if no userId — cron mode)
  let groupIds;
  if (userId) {
    // Always search ALL groups the user has ever claimed (across all projects).
    // projectId is passed to summarizeGroup for task/summary placement only —
    // restricting group lookup by projectId caused "0 groups" when the active
    // project had no claimed groups yet.
    const userGroups = await prisma.projectGroup.findMany({
      where: { project: { members: { some: { userId } } } },
      select: { groupId: true },
    });
    // Remove duplicates
    groupIds = [...new Set(userGroups.map((ug) => ug.groupId))];
  } else {
    // Cron: process all users' enabled groups
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    const results = [];
    for (const u of allUsers) {
      const r = await runOnce(u.id);
      results.push(...r);
    }
    return results;
  }

  const results = [];
  for (const groupId of groupIds) {
    try {
      const s = await summarizeGroup(groupId, userId, { projectId });
      if (s) results.push(s);
    } catch (err) {
      console.error(`[summarizer] failed for ${groupId}`, err.message);
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--once')) {
    await runOnce();
    process.exit(0);
  } else if (args.includes('--cron')) {
    console.log(`[summarizer] cron scheduled: ${SUMMARY_CRON}`);
    cron.schedule(SUMMARY_CRON, () => {
      console.log('[summarizer] cron tick');
      runOnce().catch((e) => console.error(e));
    });
  } else {
    console.log('Usage: node summarizer.js [--once|--cron]');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[summarizer] fatal:', e);
    process.exit(1);
  });
}

module.exports = { summarizeGroup, runOnce };
