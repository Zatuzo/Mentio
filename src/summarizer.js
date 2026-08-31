const OpenAI = require('openai');
const cron = require('node-cron');
const { prisma } = require('./db');
const { DEEPSEEK_API_KEY, DEEPSEEK_MODEL, SUMMARY_CRON } = require('./config');
const { decryptText } = require('./crypto');

function defaultTaskDates() {
  const start = new Date(); start.setHours(0,0,0,0);
  const due = new Date(start); due.setDate(due.getDate() + 3);
  return { startDate: start, dueDate: due };
}

const client = DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

// Resolve which project a group's extracted tasks belong to.
// Precedence: explicit opts.projectId (verified) > user's oldest project
// that owns this group (deterministic fallback).
async function resolveProjectId(groupId, userId, opts = {}) {
  if (!userId) return null;
  if (opts.projectId) {
    const allowed = await prisma.projectGroup.findFirst({
      where: {
        projectId: opts.projectId,
        groupId,
        project: { members: { some: { userId } } },
      },
    });
    if (allowed) return opts.projectId;
  }
  const pg = await prisma.projectGroup.findFirst({
    where: { groupId, project: { members: { some: { userId } } } },
    orderBy: { project: { createdAt: 'asc' } },
  });
  return pg?.projectId ?? null;
}

// Member list text (for the AI prompt) + valid id set (to validate the AI's
// suggested assignee before trusting it) for a project.
async function projectMemberContext(projectId) {
  if (!projectId) return { text: '- (no team members)', ids: new Set() };
  const links = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true } } },
  });
  const ids = new Set(links.map((l) => l.user.id));
  const text = links.length > 0
    ? links.map((l) => `- ${l.user.name} (id: ${l.user.id})`).join('\n')
    : '- (no team members)';
  return { text, ids };
}

// Whether AI-extracted tasks for (userId, groupId) may be assigned to a
// teammate instead of just the user themselves — opt-in, default off, so a
// teammate's dashboard never gets a task from a group they never chose to
// be tracked in (UserGroup.assignTeammates).
async function canAssignTeammates(userId, groupId) {
  if (!userId) return false;
  const ug = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { assignTeammates: true },
  });
  return ug?.assignTeammates ?? false;
}

// Validate + gate the AI's suggested assignee: must be a real project member,
// and assigning to someone other than the requesting user requires opt-in.
function resolveAssignee(suggestedId, memberIds, userId, allowTeammates) {
  if (!suggestedId || !memberIds.has(suggestedId)) return null;
  if (suggestedId === userId) return suggestedId;
  return allowTeammates ? suggestedId : null;
}

// Whether a task should be created at all. `directedAt` is the AI's read of
// who the request is actually addressed to (by name) — null means general/
// unaddressed/for the watching user themselves. If it clearly names a
// DIFFERENT person and assignTeammates is off, skip creating the task
// entirely rather than putting an orphaned task on this user's board for
// work that isn't theirs.
function shouldCreateTask(t, allowTeammates) {
  if (!t.directedAt) return true;
  return allowTeammates;
}

// Raw WA message text encodes @mentions as bare phone digits (e.g.
// "@6282130304142 tolong...") — WhatsApp clients resolve that to a contact
// name for display, but the text Baileys captures never is. Without
// resolving it, the AI only ever sees a phone number and can't tell a task
// is directed at a specific person by name. Resolve using GroupMember
// (synced participant list for the group, covers everyone — not just
// Mentio users) so `directedAt` reasoning actually has a name to work with.
const MENTION_TOKEN_RE = /@(\d{8,15})/g;
async function buildMentionResolver(texts, groupId) {
  const digits = new Set();
  for (const t of texts) {
    for (const m of t.matchAll(MENTION_TOKEN_RE)) digits.add(m[1]);
  }
  if (digits.size === 0) return (t) => t;
  const members = await prisma.groupMember.findMany({
    where: { groupId, phone: { in: [...digits] } },
    select: { phone: true, name: true },
  });
  const nameByPhone = new Map(members.filter((m) => m.name).map((m) => [m.phone, m.name]));
  if (nameByPhone.size === 0) return (t) => t;
  return (t) => t.replace(MENTION_TOKEN_RE, (full, d) => (nameByPhone.get(d) ? `@${nameByPhone.get(d)}` : full));
}

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

  const mentionsRaw = await prisma.mention.findMany({
    where: mentionWhere,
    orderBy: { timestamp: 'asc' },
  });
  if (mentionsRaw.length === 0) return null;

  // Decrypt chat text read back from the DB (see src/crypto.js) before it's
  // used anywhere — the AI prompt, the stored summary, etc.
  const mentions = mentionsRaw.map((m) => ({ ...m, text: decryptText(m.text) }));

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    : null;

  const resolveMentionText = await buildMentionResolver(mentions.map((m) => m.text), groupId);
  const lines = mentions.map(
    (m) => `[${m.timestamp.toISOString()}] ${m.senderName || m.senderJid}: ${resolveMentionText(m.text)}`
  );

  const projectId = await resolveProjectId(groupId, userId, opts);
  const { text: memberListText, ids: memberIds } = await projectMemberContext(projectId);
  const allowTeammates = await canAssignTeammates(userId, groupId);

  const prompt = `You are analyzing WhatsApp messages from group "${group?.name || groupId}" where ${user?.name || 'the user'} was tagged/mentioned. You are extracting tasks on behalf of ${user?.name || 'this user'} specifically.

## Team Members
${memberListText}

Return ONLY a valid JSON object (no markdown, no code block) with this exact shape:
{
  "summary": "<concise markdown summary, max 300 words, grouped by topic, each item: who asked + what they need + deadline/urgency>",
  "tasks": [
    {
      "title": "<short action title>",
      "description": "<detail or context, optional>",
      "requester": "<sender name>",
      "requesterJid": "<sender jid>",
      "priority": "<urgent|high|medium|low|none>",
      "suggestedAssigneeId": "<member id from Team Members above, or null>",
      "directedAt": "<name of the specific person this request is addressed to, or null>"
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
- Only include tasks that require someone to DO something (skip FYI messages)
- Do NOT extract a task from jokes, sarcasm, banter, venting, or casual chit-chat. Only extract when the message is a genuine, sincere work instruction or request. When tone is ambiguous, err on the side of NOT creating a task.
- If no actionable tasks, return empty array for tasks
- summary field must be markdown formatted
- suggestedAssigneeId: set to a Team Member's id ONLY when the message clearly names or directs that specific person to do the task (e.g. "Budi tolong benerin..."); otherwise null — never guess
- directedAt: who the request is actually addressed to, by name. Set to null if the request is general/unaddressed to the whole group, OR if it's addressed to ${user?.name || 'the user'} themselves. If it clearly names/directs a DIFFERENT specific person, put that person's name here instead of null. A literal "@Name" token in the message text is a strong signal of who it's addressed to — treat it as such.

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

  // Create tasks extracted by AI — skip ones clearly directed at someone
  // else when this user hasn't opted into teammate assignment.
  const tasksToCreate = extractedTasks.filter((t) => shouldCreateTask(t, allowTeammates));
  if (tasksToCreate.length > 0 && userId) {
    await prisma.task.createMany({
      data: tasksToCreate.map((t) => {
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
          assignedToId: resolveAssignee(t.suggestedAssigneeId, memberIds, userId, allowTeammates),
          status: 'todo',
          priority,
          ...defaultTaskDates(),
        };
      }),
    });
    console.log(`[summarizer] created ${tasksToCreate.length}/${extractedTasks.length} tasks for user ${userId}`);
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

module.exports = {
  summarizeGroup,
  runOnce,
  // Exported for unit testing — pure functions, no DB/network access.
  resolveAssignee,
  shouldCreateTask,
};
