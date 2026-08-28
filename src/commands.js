// WhatsApp bot command dispatcher.
//
// Usage: in the group, type "/help" — the listener parses the slash prefix
// and routes to one of the handlers below. Replies go back as a quoted
// message in the same group (no DMs to avoid unsolicited-msg blocks).
//
// Auth: a sender is resolved to an app user via WatchedJid (jid → userId).
// Group must be claimed (linked to a project). The sender must be a member
// of that project; admin-only commands check role === 'admin'.

const { prisma } = require('./db');

const SHORT_ID_LEN = 6;

function defaultTaskDates(startDate, dueDate) {
  const start = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const due = dueDate ? new Date(dueDate) : (() => { const d = new Date(start); d.setDate(d.getDate() + 3); return d; })();
  return { startDate: start, dueDate: due };
}
const SLASH_PREFIX = /^\/(\w+)\s*([\s\S]*)$/;
const TZ = process.env.APP_TIMEZONE || 'Asia/Jakarta';

// Always format timestamps in the app's timezone (WIB by default) so users
// see consistent times regardless of the server's host timezone.
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateOnlyFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
});
const dateFullFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const timeShortFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
});

const fmtDateTime = (d) => dateTimeFmt.format(d instanceof Date ? d : new Date(d));
const fmtDate = (d) => dateFullFmt.format(d instanceof Date ? d : new Date(d));
const fmtShortDateTime = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${dateOnlyFmt.format(x)} ${timeShortFmt.format(x)}`;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortId(id) {
  return id.slice(-SHORT_ID_LEN);
}

function normalizeJid(jid) {
  return (jid || '').replace(/:\d+@/, '@');
}

function formatTask(t) {
  const due = t.dueDate ? ` · due ${fmtDate(t.dueDate)}` : '';
  const req = t.requester ? ` · ${t.requester}` : '';
  return `\`${shortId(t.id)}\` [${t.status}] ${t.title}${req}${due}`;
}

function parseRelative(when) {
  // Supports: 10m, 2h, 3d, 1w, or bare number = minutes
  const m = /^(\d+)\s*([mhdw]?)$/i.exec(when.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 'm').toLowerCase();
  const map = { m: 60, h: 3600, d: 86400, w: 604800 };
  return new Date(Date.now() + n * map[unit] * 1000);
}

// Resolve a sender to an app user via their WatchedJid registration.
// Falls back to GroupClaim.userId if the claimer's JID was captured at claim time.
async function resolveSender(senderJid, groupId) {
  const wj = await prisma.watchedJid.findFirst({
    where: { jid: senderJid },
    include: { user: true },
  });
  if (wj?.user) return wj.user;

  // Fallback: groupClaim — works for the user who claimed this group.
  const claim = await prisma.groupClaim.findFirst({
    where: { groupId, status: 'claimed' },
    orderBy: { claimedAt: 'desc' },
    include: { user: true },
  });
  return claim?.user ?? null;
}

// Resolve a task by exact short ID (last 6 chars) OR substring of title.
// Returns { task, ambiguous: false } or { task: null, candidates: [...] }
async function findTask(needle, projectId) {
  if (!needle) return { task: null, candidates: [] };
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      status: { not: 'done' },
      OR: [
        { id: { endsWith: needle.toLowerCase() } },
        { title: { contains: needle, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  if (tasks.length === 1) return { task: tasks[0], candidates: [] };
  if (tasks.length === 0) return { task: null, candidates: [] };

  // Prefer exact short-id match if multiple titles also matched.
  const exact = tasks.find((t) => shortId(t.id).toLowerCase() === needle.toLowerCase());
  if (exact) return { task: exact, candidates: [] };
  return { task: null, candidates: tasks };
}

// Get the quoted-message participant (for `/watch` reply-to flow).
function getQuotedParticipant(msg) {
  const ctx =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.conversation?.contextInfo;
  return ctx?.participant ? normalizeJid(ctx.participant) : null;
}

// ── Command handlers ──────────────────────────────────────────────────────────
// Each handler returns the reply text (or null = silent). `ctx` shape below.

const commands = {};

// ── Meta ───
commands.help = async () => `*Mentio commands*

📋 *Task*
\`/task <judul>\` — buat task
\`/tasks\` — list open task
\`/done <id|kata>\` — selesaikan task
\`/inprogress <id>\` — geser ke In Progress
\`/mine\` — task milik saya
\`/assign <id>\` (reply ke target) — assign task
\`/agenda\` — task dengan due date (7 hari)
\`/delete <id>\` — hapus task

🧠 *Insight*
\`/summary\` — generate summary pakai AI
\`/digest\` — list mention unprocessed
\`/search <kata>\` — cari di mention

👥 *Watcher*
\`/watch\` (reply) atau \`/watch <jid>\`
\`/unwatch\` (reply) atau \`/unwatch <jid>\`
\`/watched\` — list watched saya

ℹ️ *Info*
\`/project\` — info project
\`/status\` — health bot
\`/whoami\` — info Anda di sistem

🔇 *Kontrol* (admin)
\`/mute\` — pause grup ini untuk saya
\`/unmute\` — resume
\`/leave\` — bot keluar grup

⏰ *Reminder*
\`/remind <Nm|Nh|Nd> <pesan>\`
   contoh: \`/remind 30m review PR\`
\`/cancel <id>\``;

commands.status = async (ctx) => {
  const owner = await prisma.user.findFirst({ where: { isOwner: true } });
  const wa = owner ? await prisma.waSession.findUnique({ where: { userId: owner.id } }) : null;
  const lastMention = await prisma.mention.findFirst({
    where: { groupId: ctx.groupId },
    orderBy: { timestamp: 'desc' },
  });
  const openTasks = ctx.projectId
    ? await prisma.task.count({
        where: { projectId: ctx.projectId, status: { not: 'done' } },
      })
    : 0;
  return `*Status bot*
WA: ${wa?.connected ? '✅ connected' : '❌ disconnected'}
Last mention: ${lastMention ? fmtDateTime(lastMention.timestamp) : '(none)'}
Open tasks: ${openTasks}`;
};

commands.project = async (ctx) => {
  if (!ctx.projectId) return '⚠️ Grup ini belum di-claim ke project mana pun.';
  const p = await prisma.project.findUnique({
    where: { id: ctx.projectId },
    include: {
      members: { include: { user: { select: { name: true } } } },
      repos: { select: { fullName: true } },
    },
  });
  if (!p) return '⚠️ Project tidak ditemukan.';
  const admins = p.members.filter((m) => m.role === 'admin').map((m) => m.user.name);
  return `*Project: ${p.name}*
Admin: ${admins.join(', ') || '—'}
Member: ${p.members.length}
Repo: ${p.repos.length}${p.repos.length ? '\n  · ' + p.repos.map((r) => r.fullName).join('\n  · ') : ''}`;
};

commands.whoami = async (ctx) => {
  const lines = [
    `JID: \`${ctx.senderJid}\``,
    `Nama (push): ${ctx.senderName || '(none)'}`,
  ];
  if (ctx.user) {
    lines.push(`User: ${ctx.user.name} (${ctx.user.email})`);
  } else {
    lines.push('User app: ❌ tidak ter-link. Tambahkan nomor Anda ke Watched Numbers via web Settings.');
  }
  if (ctx.projectId) {
    const m = await prisma.projectMember.findFirst({
      where: { projectId: ctx.projectId, userId: ctx.user?.id || '__none__' },
    });
    lines.push(`Role di project ini: ${m?.role || '(bukan member)'}`);
  }
  return lines.join('\n');
};

// ── Task ───
commands.task = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link ke user app. Lihat `/whoami`.';
  if (!ctx.projectId) return '⚠️ Grup belum di-claim. Tidak bisa buat task.';
  const title = ctx.args.trim();
  if (!title) return 'Format: `/task <judul task>`';

  // Optional --due YYYY-MM-DD suffix
  let dueDate = null;
  const dueM = /\s+--due\s+(\S+)/.exec(title);
  let cleanTitle = title;
  if (dueM) {
    const d = new Date(dueM[1]);
    if (!isNaN(d.getTime())) dueDate = d;
    cleanTitle = title.replace(dueM[0], '').trim();
  }

  const t = await prisma.task.create({
    data: {
      userId: ctx.user.id,
      projectId: ctx.projectId,
      groupId: ctx.groupId,
      title: cleanTitle,
      requester: ctx.senderName || ctx.user.name,
      requesterJid: ctx.senderJid,
      ...defaultTaskDates(undefined, dueDate ?? undefined),
      status: 'todo',
      source: 'mention',
    },
  });
  return `✅ Task dibuat: \`${shortId(t.id)}\`\n${cleanTitle}${dueDate ? ` · due ${fmtDate(dueDate)}` : ''}`;
};

commands.tasks = async (ctx) => {
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  const tasks = await prisma.task.findMany({
    where: { projectId: ctx.projectId, status: { not: 'done' } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  if (tasks.length === 0) return '_(Tidak ada task aktif.)_';
  return `*Tasks (${tasks.length})*\n${tasks.map(formatTask).join('\n')}`;
};

async function setTaskStatus(ctx, status, doneNotify = false) {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  const needle = ctx.args.trim();
  if (!needle) return `Format: \`/${ctx.cmd} <id|kata kunci>\``;

  const { task, candidates } = await findTask(needle, ctx.projectId);
  if (!task) {
    if (candidates.length === 0) return `Task tidak ditemukan untuk "${needle}".`;
    return `Cocok beberapa, pakai short ID:\n${candidates.map(formatTask).join('\n')}`;
  }
  const prev = task.status;
  await prisma.task.update({ where: { id: task.id }, data: { status } });

  if (doneNotify && prev !== 'done') {
    // Reuse the same notification template as the web flow.
    const { DEFAULT_TASK_DONE_MESSAGE, renderTemplate } = require('./messages');
    const p = task.projectId
      ? await prisma.project.findUnique({
          where: { id: task.projectId },
          select: { taskDoneMessage: true },
        })
      : null;
    const tpl = p?.taskDoneMessage?.trim() || DEFAULT_TASK_DONE_MESSAGE;
    const message = renderTemplate(tpl, {
      taskTitle: task.title,
      requester: task.requester || '',
      requesterSuffix: task.requester ? ` (diminta oleh ${task.requester})` : '',
      userName: ctx.user.name || '',
    });
    // task.groupId may be null for manually-created tasks — fall back to the
    // current WA group context so the notification still goes somewhere sensible.
    const notifyGroupId = task.groupId ?? ctx.groupId;
    if (notifyGroupId) {
      await prisma.messageQueue.create({
        data: { userId: ctx.user.id, groupId: notifyGroupId, taskId: task.id, message },
      });
    }
  }
  return `✅ \`${shortId(task.id)}\` → *${status}*\n${task.title}`;
}

commands.done = (ctx) => setTaskStatus(ctx, 'done', true);
commands.inprogress = (ctx) => setTaskStatus(ctx, 'in_progress', false);

commands.mine = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  const tasks = await prisma.task.findMany({
    where: {
      projectId: ctx.projectId,
      status: { not: 'done' },
      OR: [
        { userId: ctx.user.id },
        { requesterJid: ctx.senderJid },
        { requester: ctx.senderName || undefined },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
  if (tasks.length === 0) return '_(Tidak ada task milik Anda.)_';
  return `*Task milik Anda (${tasks.length})*\n${tasks.map(formatTask).join('\n')}`;
};

commands.assign = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  const argv = ctx.args.trim().split(/\s+/);
  const taskRef = argv[0];
  if (!taskRef) return 'Format: `/assign <id>` sambil reply ke pesan target.';

  const targetJid = getQuotedParticipant(ctx.msg);
  if (!targetJid) return 'Reply pesan dari orang yang ingin Anda assign, lalu kirim `/assign <id>`.';

  const targetUser = await resolveSender(targetJid, ctx.groupId);
  if (!targetUser) return `Target (\`${targetJid}\`) belum ter-link sebagai user app. Minta dia daftar nomornya dulu.`;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: ctx.projectId, userId: targetUser.id } },
  });
  if (!member) return `${targetUser.name} bukan member project ini.`;

  const { task, candidates } = await findTask(taskRef, ctx.projectId);
  if (!task) {
    if (candidates.length === 0) return 'Task tidak ditemukan.';
    return `Cocok beberapa:\n${candidates.map(formatTask).join('\n')}`;
  }
  await prisma.task.update({ where: { id: task.id }, data: { userId: targetUser.id } });
  return `✅ \`${shortId(task.id)}\` di-assign ke *${targetUser.name}*\n${task.title}`;
};

commands.agenda = async (ctx) => {
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  const cutoff = new Date(Date.now() + 7 * 86400 * 1000);
  const tasks = await prisma.task.findMany({
    where: {
      projectId: ctx.projectId,
      status: { not: 'done' },
      dueDate: { not: null, lte: cutoff },
    },
    orderBy: { dueDate: 'asc' },
    take: 20,
  });
  if (tasks.length === 0) return '_(Tidak ada task dengan due date dalam 7 hari.)_';
  return `*Agenda 7 hari*\n${tasks.map(formatTask).join('\n')}`;
};

commands.delete = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  const needle = ctx.args.trim();
  if (!needle) return 'Format: `/delete <id|kata>`';
  const { task, candidates } = await findTask(needle, ctx.projectId);
  if (!task) {
    if (candidates.length === 0) return 'Task tidak ditemukan.';
    return `Cocok beberapa:\n${candidates.map(formatTask).join('\n')}`;
  }
  if (task.userId !== ctx.user.id && !ctx.isAdmin) {
    return '⚠️ Hanya pembuat task atau admin project yang bisa hapus.';
  }
  await prisma.task.delete({ where: { id: task.id } });
  return `🗑️ Task \`${shortId(task.id)}\` dihapus.\n${task.title}`;
};

// ── Insight ───
commands.summary = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  // summarizeGroup uses the user's API key + project; it processes only
  // unprocessed mentions and writes a Summary row.
  const { summarizeGroup } = require('./summarizer');
  try {
    const s = await summarizeGroup(ctx.groupId, ctx.user.id, { projectId: ctx.projectId });
    if (!s) return '_(Tidak ada mention baru untuk diringkas.)_';
    const head = s.content.length > 800 ? s.content.slice(0, 800) + '\n…(potong)' : s.content;
    return `*Summary*\n${head}`;
  } catch (e) {
    return `❌ Gagal summary: ${e.message}`;
  }
};

commands.digest = async (ctx) => {
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  const where = { groupId: ctx.groupId, processed: false };
  if (ctx.user) where.userId = ctx.user.id;
  const ms = await prisma.mention.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: 10,
  });
  if (ms.length === 0) return '_(Tidak ada mention belum diproses.)_';
  const lines = ms.map((m) => {
    const snippet = m.text.length > 90 ? m.text.slice(0, 90) + '…' : m.text;
    return `• [${fmtShortDateTime(m.timestamp)}] *${m.senderName || 'unknown'}*: ${snippet}`;
  });
  return `*Digest (${ms.length} belum diproses)*\n${lines.join('\n')}`;
};

commands.search = async (ctx) => {
  if (!ctx.projectId) return '⚠️ Grup belum di-claim.';
  const q = ctx.args.trim();
  if (!q) return 'Format: `/search <kata kunci>`';
  const ms = await prisma.mention.findMany({
    where: {
      groupId: ctx.groupId,
      text: { contains: q, mode: 'insensitive' },
    },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });
  if (ms.length === 0) return `Tidak ada hasil untuk "${q}".`;
  const lines = ms.map((m) => {
    const snippet = m.text.length > 100 ? m.text.slice(0, 100) + '…' : m.text;
    return `• [${fmtShortDateTime(m.timestamp)}] *${m.senderName || 'unknown'}*: ${snippet}`;
  });
  return `*Cari "${q}" (${ms.length})*\n${lines.join('\n')}`;
};

// ── Watcher ───
async function watchToggle(ctx, active) {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  const argJid = ctx.args.trim();
  const quoted = getQuotedParticipant(ctx.msg);
  const targetJid = quoted || (argJid && argJid.includes('@') ? argJid : null);
  if (!targetJid) {
    return `Cara pakai:\n- Reply pesan target lalu \`/${active ? 'watch' : 'unwatch'}\`\n- Atau \`/${active ? 'watch' : 'unwatch'} 628xxx@s.whatsapp.net\``;
  }

  if (active) {
    await prisma.watchedJid.upsert({
      where: { userId_jid: { userId: ctx.user.id, jid: targetJid } },
      update: { active: true },
      create: { userId: ctx.user.id, jid: targetJid, active: true },
    });
    return `✅ Sekarang memantau \`${targetJid}\``;
  } else {
    const existing = await prisma.watchedJid.findUnique({
      where: { userId_jid: { userId: ctx.user.id, jid: targetJid } },
    });
    if (!existing) return `\`${targetJid}\` tidak ada di watched list Anda.`;
    await prisma.watchedJid.delete({ where: { id: existing.id } });
    return `🗑️ \`${targetJid}\` dihapus dari watched.`;
  }
}
commands.watch = (ctx) => watchToggle(ctx, true);
commands.unwatch = (ctx) => watchToggle(ctx, false);

commands.watched = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  const list = await prisma.watchedJid.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: 'asc' },
  });
  if (list.length === 0) return '_(Belum ada nomor yang dipantau.)_';
  return `*Watched (${list.length})*\n${list
    .map((w) => `${w.active ? '🟢' : '⚪'} \`${w.jid}\`${w.label ? ' — ' + w.label : ''}`)
    .join('\n')}`;
};

// ── Kontrol ───
commands.mute = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  const ug = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId: ctx.user.id, groupId: ctx.groupId } },
  });
  if (!ug) return '⚠️ Anda bukan claimer grup ini.';
  await prisma.userGroup.update({ where: { id: ug.id }, data: { enabled: false } });
  return '🔇 Grup ini di-mute untuk Anda. Mention tidak akan ditangkap. Pakai `/unmute` untuk resume.';
};

commands.unmute = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  const ug = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId: ctx.user.id, groupId: ctx.groupId } },
  });
  if (!ug) return '⚠️ Anda bukan claimer grup ini.';
  await prisma.userGroup.update({ where: { id: ug.id }, data: { enabled: true } });
  return '🔊 Grup ini un-muted. Mention akan ditangkap lagi.';
};

commands.leave = async (ctx) => {
  if (!ctx.isAdmin) return '⚠️ Hanya admin project yang bisa mengeluarkan bot dari grup.';
  await prisma.userGroup.deleteMany({ where: { groupId: ctx.groupId } });
  await prisma.projectGroup.deleteMany({ where: { groupId: ctx.groupId } });
  try {
    await ctx.sock.groupLeave(ctx.groupId);
  } catch (e) {
    return `Bot tidak bisa keluar otomatis: ${e.message}. Project link sudah dihapus.`;
  }
  return null; // already left → no reply
};

// ── Reminder ───
commands.remind = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  const argv = ctx.args.trim().split(/\s+/);
  if (argv.length < 2) {
    return 'Format: `/remind <Nm|Nh|Nd> <pesan>`\nContoh: `/remind 30m review PR Alice`';
  }
  const when = argv[0];
  const message = argv.slice(1).join(' ');
  const scheduledAt = parseRelative(when);
  if (!scheduledAt) return `Format waktu tidak valid: "${when}". Pakai 30m, 2h, 1d, 1w.`;

  const r = await prisma.reminder.create({
    data: {
      userId: ctx.user.id,
      groupId: ctx.groupId,
      message,
      scheduledAt,
    },
  });
  return `⏰ Reminder dibuat \`${shortId(r.id)}\`\nKirim: ${fmtDateTime(scheduledAt)} WIB\nPesan: ${message}`;
};

commands.cancel = async (ctx) => {
  if (!ctx.user) return '⚠️ Anda belum ter-link.';
  const needle = ctx.args.trim();
  if (!needle) {
    // List active reminders for the user
    const list = await prisma.reminder.findMany({
      where: { userId: ctx.user.id, sent: false, canceledAt: null },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });
    if (list.length === 0) return '_(Tidak ada reminder aktif.)_';
    return `Reminder aktif:\n${list
      .map(
        (r) =>
          `\`${shortId(r.id)}\` ${fmtDateTime(r.scheduledAt)} — ${r.message.slice(0, 60)}`
      )
      .join('\n')}\n\nUntuk batalkan: \`/cancel <id>\``;
  }
  const r = await prisma.reminder.findFirst({
    where: {
      userId: ctx.user.id,
      sent: false,
      canceledAt: null,
      id: { endsWith: needle.toLowerCase() },
    },
  });
  if (!r) return `Reminder \`${needle}\` tidak ditemukan.`;
  await prisma.reminder.update({
    where: { id: r.id },
    data: { canceledAt: new Date() },
  });
  return `🗑️ Reminder \`${shortId(r.id)}\` dibatalkan.`;
};

// ── Dispatcher ────────────────────────────────────────────────────────────────

// Parse a text into command name + raw args. Returns null if not a command.
function parseCommand(text) {
  const m = SLASH_PREFIX.exec(text || '');
  if (!m) return null;
  return { cmd: m[1].toLowerCase(), args: m[2] || '' };
}

// dispatch(sock, msg) — call from listener when an incoming group message
// starts with "/". Sends reply via sock.sendMessage with quoted ref.
async function dispatch(sock, msg) {
  const text =
    msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const parsed = parseCommand(text);
  if (!parsed) return false; // not a command

  const groupId = msg.key.remoteJid;

  // Determine project linked to this group (if any), and whether it's silenced.
  const pg = await prisma.projectGroup.findFirst({
    where: { groupId },
    include: { project: { select: { silentMode: true } } },
  });
  const projectId = pg?.projectId || null;
  const silentMode = pg?.project?.silentMode ?? false;

  const handler = commands[parsed.cmd];
  if (!handler) {
    if (!silentMode) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❓ Command \`/${parsed.cmd}\` tidak dikenal. Coba \`/help\`.` },
        { quoted: msg }
      );
    }
    return true;
  }

  const senderJid = normalizeJid(msg.key.participant || msg.participant || '');
  const senderName = msg.pushName || null;

  const user = await resolveSender(senderJid, groupId);

  let isAdmin = false;
  if (user && projectId) {
    const m = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    isAdmin = m?.role === 'admin';
  }

  const ctx = {
    cmd: parsed.cmd,
    args: parsed.args,
    sock,
    msg,
    groupId,
    senderJid,
    senderName,
    user,
    projectId,
    isAdmin,
  };

  try {
    const reply = await handler(ctx);
    if (reply && !silentMode) {
      await sock.sendMessage(groupId, { text: reply }, { quoted: msg });
    }
  } catch (err) {
    console.error(`[command /${parsed.cmd}]`, err);
    if (!silentMode) {
      await sock.sendMessage(
        groupId,
        { text: `❌ Error menjalankan \`/${parsed.cmd}\`: ${err.message}` },
        { quoted: msg }
      );
    }
  }
  return true;
}

module.exports = { dispatch, parseCommand, commands };
