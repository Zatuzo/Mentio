// Shared listener — runs on the owner's WA account.
// Captures mentions for ALL users who have waMode='shared' and active WatchedJids.
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'wa-dump');

function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}

async function uploadBufferToR2(buffer, mimeType = 'image/jpeg', folder = 'wa-dump') {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const key = `${folder}/${randomUUID()}.${ext}`;
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

async function downloadWaImage(msg) {
  try {
    if (!msg.message?.imageMessage) return null;
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const buffer = await downloadMediaMessage(msg, 'buffer', {});
    if (!buffer || buffer.length === 0) {
      console.warn('[listener] image buffer empty — skipping upload');
      return null;
    }
    console.log(`[listener] image downloaded, size: ${buffer.length} bytes`);

    if (isR2Configured()) {
      const url = await uploadBufferToR2(buffer, 'image/jpeg', 'wa-dump');
      console.log('[listener] image uploaded to R2:', url);
      return url;
    }

    // Fallback: local filesystem
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.jpg`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    const url = `/uploads/wa-dump/${filename}`;
    console.log('[listener] image saved locally:', url);
    return url;
  } catch (err) {
    console.error('[listener] image download error:', err.message);
    return null;
  }
}
const { summarizeGroup } = require('./summarizer');
const qrcode = require('qrcode-terminal');
const { prisma } = require('./db');
const { MY_JID, assertConfig } = require('./config');
const { notify } = require('./notify');
const { DEFAULT_CLAIM_MESSAGE, renderTemplate } = require('./messages');
const { dispatch: dispatchCommand, parseCommand } = require('./commands');
const { classifyDumpMessage } = require('./dump-classifier');
const { bufferMessage } = require('./group-chat-buffer');
const { shouldRecordMention } = require('./listener-policy');
const { encryptText } = require('./crypto');
const { classifyMessage } = require('./watsonx');

// Emoji yang memicu pembuatan task dari pesan yang di-react.
const TASK_EMOJI = process.env.TASK_EMOJI || '📌';

function defaultTaskDates(startDate, dueDate) {
  const start = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const due = dueDate ? new Date(dueDate) : (() => { const d = new Date(start); d.setDate(d.getDate() + 3); return d; })();
  return { startDate: start, dueDate: due };
}

// In-memory cache: messageId → { text, senderName } untuk lookup saat reaction masuk.
// Dibatasi 1000 entry untuk cegah memory leak.
const recentMessages = new Map();
const RECENT_MSG_LIMIT = 1000;
function cacheMessage(id, text, senderName) {
  if (recentMessages.size >= RECENT_MSG_LIMIT) {
    // Hapus entry paling lama
    recentMessages.delete(recentMessages.keys().next().value);
  }
  recentMessages.set(id, { text, senderName });
}

// Bersihkan teks WA menjadi judul task: hapus @mentions, trim, max 100 char.
function extractTitle(text) {
  return text
    .replace(/@\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'Task baru';
}

// Owner heartbeat — listener writes its WA connection state to the owner's
// WaSession row so /api/health can report it.
async function writeHeartbeat({ connected, myJid }) {
  try {
    const owner = await prisma.user.findFirst({ where: { isOwner: true } });
    if (!owner) return;
    await prisma.waSession.upsert({
      where: { userId: owner.id },
      update: { connected, myJid: myJid ?? undefined, authDir: 'shared' },
      create: { userId: owner.id, connected, myJid: myJid ?? null, authDir: 'shared' },
    });
  } catch (e) {
    console.error('[listener] heartbeat failed:', e.message);
  }
}

const AUTH_DIR = path.join(__dirname, '..', 'auth_info');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

let sharedSock = null;
let _queueInterval = null;
let _heartbeatInterval = null;
let _hasBackfilled = false;
let _activeSock = null; // track active socket to close before reconnect

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ''
  );
}

function extractMentions(msg) {
  const m = msg.message;
  if (!m) return [];
  return (
    m.extendedTextMessage?.contextInfo?.mentionedJid ||
    m.imageMessage?.contextInfo?.mentionedJid ||
    m.videoMessage?.contextInfo?.mentionedJid ||
    []
  );
}

async function ensureGroupRow(sock, groupJid) {
  const existing = await prisma.group.findUnique({ where: { id: groupJid } });
  if (existing && existing.name !== groupJid) return existing;

  let name = groupJid;
  try {
    const meta = await sock.groupMetadata(groupJid);
    name = meta?.subject || groupJid;
  } catch (_) {}

  if (existing) {
    return prisma.group.update({ where: { id: groupJid }, data: { name } });
  }
  return prisma.group.create({ data: { id: groupJid, name } });
}

async function ensureOwnerWatched() {
  if (!MY_JID) return;
  const owner = await prisma.user.findFirst({ where: { isOwner: true } });
  if (!owner) return;
  await prisma.watchedJid.upsert({
    where: { userId_jid: { userId: owner.id, jid: MY_JID } },
    update: {},
    create: { userId: owner.id, jid: MY_JID, label: 'Me', active: true },
  });
}

// ── Group claim ───────────────────────────────────────────────────────────────
// Mirror of CLAIM_CODE_REGEX in app/lib/claim.ts (CJS listener can't import TS).
const CLAIM_CODE_REGEX = /MENTIO-[A-Z0-9]{4,12}/i;

// Sync a group's participant list into GroupMember so users can pick watched
// numbers from a list. Names are best-effort, recovered from message history.
async function syncGroupMembers(sock, groupId) {
  let participants = [];
  try {
    const meta = await sock.groupMetadata(groupId);
    participants = meta?.participants || [];
  } catch (e) {
    console.error('[listener] groupMetadata failed for', groupId, e.message);
    return;
  }

  // Names captured from past messages (pushName).
  const [mentions, existingMembers] = await Promise.all([
    prisma.mention.findMany({
      where: { groupId },
      select: { senderJid: true, senderName: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId },
      select: { jid: true, name: true, phone: true },
    }),
  ]);
  const nameMap = {};
  for (const m of existingMembers) {
    if (m.name) nameMap[m.jid] = m.name;
  }
  for (const m of mentions) {
    if (m.senderName) nameMap[m.senderJid.replace(/:\d+@/, '@')] = m.senderName;
  }

  // Resolve LID → phone via Baileys' mapping store (best-effort).
  const lidMapping = sock.signalRepository?.lidMapping;
  const lidJids = participants
    .map((p) => (p.id || '').replace(/:\d+@/, '@'))
    .filter((j) => j.endsWith('@lid'));
  const lidToPhone = {};
  if (lidMapping && lidJids.length > 0) {
    try {
      const pairs = await lidMapping.getPNsForLIDs(lidJids);
      if (Array.isArray(pairs)) {
        for (const { lid, pn } of pairs) {
          if (pn) lidToPhone[lid] = pn.replace(/:\d+@/, '@');
        }
      }
    } catch (e) {
      console.error('[listener] LID batch lookup failed', e.message);
    }
  }

  for (const p of participants) {
    const jid = (p.id || '').replace(/:\d+@/, '@');
    if (!jid) continue;

    let phone = null;
    if (jid.endsWith('@s.whatsapp.net')) {
      phone = jid.split('@')[0];
    } else if (jid.endsWith('@lid')) {
      const pnJid = lidToPhone[jid];
      if (pnJid && pnJid.endsWith('@s.whatsapp.net')) {
        phone = pnJid.split('@')[0];
      }
    }

    await prisma.groupMember.upsert({
      where: { groupId_jid: { groupId, jid } },
      update: {
        isAdmin: !!p.admin,
        ...(phone ? { phone } : {}),
        ...(nameMap[jid] ? { name: nameMap[jid] } : {}),
      },
      create: { groupId, jid, phone, name: nameMap[jid] || null, isAdmin: !!p.admin },
    });
  }
  console.log(`[listener] synced ${participants.length} member(s) for group ${groupId}`);
}

// Backfill members for every claimed group — run once when the listener connects,
// so groups claimed before the member-sync feature still get their lists.
async function syncAllClaimedGroups(sock) {
  const links = await prisma.userGroup.findMany({
    distinct: ['groupId'],
    select: { groupId: true },
  });
  if (links.length === 0) return;
  console.log(`[listener] backfilling members for ${links.length} claimed group(s)…`);
  for (const { groupId } of links) {
    await syncGroupMembers(sock, groupId);
  }
}

// A user posted their claim code inside a group → link that group to them.
// `senderJid` is captured so we can register it as a WatchedJid for the
// claimer — this also bootstraps their identity for slash commands.
async function handleClaim(sock, code, groupId, groupName, senderJid) {
  const claim = await prisma.groupClaim.findUnique({ where: { code } });
  if (!claim || claim.status !== 'pending') return;

  if (claim.expiresAt < new Date()) {
    await prisma.groupClaim.update({
      where: { id: claim.id },
      data: { status: 'expired' },
    });
    return;
  }

  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: claim.userId, groupId } },
    update: { enabled: true },
    create: { userId: claim.userId, groupId, enabled: true },
  });
  await prisma.projectGroup.upsert({
    where: { projectId_groupId: { projectId: claim.projectId, groupId } },
    update: {},
    create: { projectId: claim.projectId, groupId },
  });
  await prisma.groupClaim.update({
    where: { id: claim.id },
    data: { status: 'claimed', groupId, groupName, claimedAt: new Date() },
  });

  // Pull the member list so the user can pick watched numbers from it.
  await syncGroupMembers(sock, groupId);

  // Adopt any manual tasks (groupId: null) the claimer has in this project —
  // assign them to the newly claimed group so slash commands can find them.
  const adopted = await prisma.task.updateMany({
    where: { projectId: claim.projectId, userId: claim.userId, groupId: null },
    data: { groupId },
  });
  if (adopted.count > 0) {
    console.log(`[listener] adopted ${adopted.count} manual task(s) → group ${groupId}`);
  }

  // Register the claimer's sender JID so slash commands can identify them.
  if (senderJid) {
    await prisma.watchedJid.upsert({
      where: { userId_jid: { userId: claim.userId, jid: senderJid } },
      update: { active: true },
      create: { userId: claim.userId, jid: senderJid, label: 'Saya', active: true },
    });
  }

  // Confirmation message — use the project's custom template if set.
  const project = await prisma.project.findUnique({
    where: { id: claim.projectId },
    select: { claimMessage: true },
  });
  const claimer = await prisma.user.findUnique({
    where: { id: claim.userId },
    select: { name: true },
  });
  const template = project?.claimMessage?.trim() || DEFAULT_CLAIM_MESSAGE;
  const message = renderTemplate(template, {
    groupName,
    userName: claimer?.name || '',
  });

  await prisma.messageQueue.create({
    data: { userId: claim.userId, groupId, message },
  });

  console.log(`[listener] group "${groupName}" claimed by user ${claim.userId}`);
}

// ── Message queue ─────────────────────────────────────────────────────────────

async function processMessageQueue() {
  if (!sharedSock) return;

  const pending = await prisma.messageQueue.findMany({
    where: { status: 'pending', attempts: { lt: 3 } },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });

  for (const item of pending) {
    try {
      const pg = await prisma.projectGroup.findFirst({
        where: { groupId: item.groupId },
        select: { project: { select: { silentMode: true } } },
      });
      if (pg?.project?.silentMode) {
        await prisma.messageQueue.update({
          where: { id: item.id },
          data: { status: 'skipped', sentAt: new Date() },
        });
        continue;
      }

      await sharedSock.sendMessage(item.groupId, { text: item.message });
      await prisma.messageQueue.update({
        where: { id: item.id },
        data: { status: 'sent', sentAt: new Date() },
      });
      console.log(`[listener] sent queued message to ${item.groupId}`);
    } catch (err) {
      await prisma.messageQueue.update({
        where: { id: item.id },
        data: {
          attempts: { increment: 1 },
          status: item.attempts >= 2 ? 'failed' : 'pending',
        },
      });
      console.error('[listener] failed to send queued message', err.message);
    }
  }
}

// ── Reaction → Task ───────────────────────────────────────────────────────────

async function handleReactionTask(sock, msg, groupId, reaction) {
  try {
    const reactorJid = normalizeJid(msg.key.participant || msg.participant || '');
    const originalMsgId = reaction.key?.id;

    if (!reactorJid || !originalMsgId) return;

    // Cari teks pesan asli dari cache
    const cached = recentMessages.get(originalMsgId);
    if (!cached?.text) {
      console.log('[reaction] pesan asli tidak ada di cache, skip');
      return;
    }

    // Cari user dari JID reactor via WatchedJid
    const wj = await prisma.watchedJid.findFirst({
      where: { jid: reactorJid },
      include: { user: true },
    });
    const user = wj?.user ?? null;

    // Cari project yang terhubung ke grup ini
    const projectGroup = await prisma.projectGroup.findFirst({
      where: { groupId },
      include: { project: true },
    });
    if (!projectGroup) {
      console.log('[reaction] grup belum terhubung ke project, skip');
      return;
    }

    // Jika user ditemukan, pastikan dia member project
    let assignedToId = null;
    if (user) {
      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: projectGroup.projectId, userId: user.id } },
      });
      if (membership) assignedToId = user.id;
    }

    // Cari owner/admin project sebagai userId task
    const adminMember = await prisma.projectMember.findFirst({
      where: { projectId: projectGroup.projectId, role: 'admin' },
      include: { user: true },
    });
    if (!adminMember) return;

    const title = extractTitle(cached.text);

    const task = await prisma.task.create({
      data: {
        title,
        userId: adminMember.userId,
        projectId: projectGroup.projectId,
        groupId,
        assignedToId: assignedToId ?? null,
        status: 'todo',
        priority: 'none',
        requester: cached.senderName || reactorJid,
        requesterJid: reactorJid,
        ...defaultTaskDates(),
      },
    });

    console.log(`[reaction] task dibuat: "${title}" (id: ${task.id}) di project ${projectGroup.project.name}`);

    await prisma.messageQueue.create({
      data: {
        userId: adminMember.userId,
        groupId,
        taskId: task.id,
        message: `📌 *Task dibuat*\n\n*${title}*\n\n_Dibuat via reaksi oleh ${msg.pushName || reactorJid} — Mentio_`,
      },
    });
  } catch (err) {
    console.error('[reaction] error handling reaction task', err);
  }
}

function normalizeJid(jid) {
  return (jid || '').replace(/:\d+@/, '@');
}

// ── WA Dump ───────────────────────────────────────────────────────────────────
// Users send a DM to the Mentio number. If it's a claim code, link their JID.
// Subsequent DMs from a linked JID → save as Brain note for that user.

function normJid(jid) {
  return (jid || '').replace(/:\d+@/, '@').toLowerCase();
}

async function handleWaDumpIncoming(sock, msg, senderJid) {
  try {
    const text = extractText(msg);
    const hasImage = !!msg.message?.imageMessage;
    if (!text || text.length < 2) {
      // Image-only message (no caption) → save as note with image
      if (hasImage) {
        const senderNorm = normJid(senderJid);
        const user = await prisma.user.findFirst({
          where: { dumpJid: senderNorm, waDumpEnabled: true },
          select: { id: true },
        });
        if (!user) return;
        const inbox = await prisma.space.findFirst({
          where: { userId: user.id, isInbox: true },
          select: { id: true },
        });
        if (!inbox) return;
        const imageUrl = await downloadWaImage(msg);
        await prisma.note.create({
          data: {
            userId: user.id,
            spaceId: inbox.id,
            title: 'WA Image',
            content: '',
            sourceType: 'wa_dump',
            sourceWaMsgId: msg.key?.id ?? null,
            isNew: true,
            imageUrls: imageUrl ? [imageUrl] : [],
          },
        });
        console.log('[listener] WA dump image-only → note');
      }
      return;
    }

    const senderNorm = normJid(senderJid);

    // Check if this is a claim code
    const codeMatch = text.trim().match(CLAIM_CODE_REGEX);
    if (codeMatch) {
      const code = codeMatch[0].toUpperCase();
      const verification = await prisma.verification.findFirst({
        where: { value: code, identifier: { startsWith: 'wa_dump_' } },
      });
      if (!verification) return;
      if (verification.expiresAt < new Date()) {
        await prisma.verification.delete({ where: { id: verification.id } });
        return;
      }
      const userId = verification.identifier.replace('wa_dump_', '');
      await prisma.user.update({
        where: { id: userId },
        data: { dumpJid: senderNorm, waDumpEnabled: true },
      });
      await prisma.verification.delete({ where: { id: verification.id } });
      console.log('[listener] WA dump linked:', senderNorm, '→ user', userId);
      return;
    }

    // Not a claim code — save as note/task if this JID is linked to a user
    const user = await prisma.user.findFirst({
      where: { dumpJid: senderNorm, waDumpEnabled: true },
      select: { id: true },
    });
    if (!user) return;

    // Download image if present (runs in background alongside classification)
    const imageUrlPromise = hasImage ? downloadWaImage(msg) : Promise.resolve(null);

    const isTodo = /^!todo\b/i.test(text.trim());

    if (isTodo) {
      // !todo prefix → create one or more tasks, separated by comma (no AI needed)
      const raw = text.trim().replace(/^!todo\s*/i, '').split('\n')[0];
      const titles = raw.split(',').map((t) => t.trim()).filter(Boolean);
      if (titles.length === 0) return;
      const { startDate, dueDate } = defaultTaskDates();
      const imageUrl = await imageUrlPromise;
      // createMany doesn't support scalar list fields well — use create loop if image
      if (imageUrl) {
        for (const title of titles) {
          await prisma.task.create({
            data: {
              userId: user.id, assignedToId: user.id,
              title: title.slice(0, 200), status: 'todo', priority: 'none',
              source: 'wa_dump', startDate, dueDate, imageUrls: [imageUrl],
            },
          });
        }
      } else {
        await prisma.task.createMany({
          data: titles.map((title) => ({
            userId: user.id, assignedToId: user.id,
            title: title.slice(0, 200), status: 'todo', priority: 'none',
            source: 'wa_dump', startDate, dueDate,
          })),
        });
      }
      console.log(`[listener] WA dump !todo created ${titles.length} task(s):`, titles);
      return;
    }

    // AI auto-classify: note or task?
    const [classified, imageUrl] = await Promise.all([classifyDumpMessage(text), imageUrlPromise]);

    if (classified.type === 'task') {
      const { startDate, dueDate } = defaultTaskDates();
      await prisma.task.create({
        data: {
          userId: user.id,
          assignedToId: user.id,
          title: classified.title,
          status: 'todo',
          priority: 'none',
          source: 'wa_dump',
          startDate,
          dueDate,
          ...(imageUrl ? { imageUrls: [imageUrl] } : {}),
        },
      });
      console.log('[listener] WA dump AI→task:', classified.title);
      return;
    }

    // classified.type === 'note'
    const inbox = await prisma.space.findFirst({
      where: { userId: user.id, isInbox: true },
      select: { id: true },
    });
    if (!inbox) return;

    await prisma.note.create({
      data: {
        userId: user.id,
        spaceId: inbox.id,
        title: classified.title,
        content: text,
        sourceType: 'wa_dump',
        sourceWaMsgId: msg.key?.id ?? null,
        isNew: true,
        ...(imageUrl ? { imageUrls: [imageUrl] } : {}),
      },
    });
    console.log('[listener] WA dump AI→note:', classified.title);
  } catch (err) {
    console.error('[listener] WA dump error:', err.message);
  }
}

// Handle emoji reaction on a DM dump note → convert note to task
async function handleDumpReaction(msg, senderJid) {
  try {
    const reaction = msg.message?.reactionMessage;
    if (!reaction?.text || !reaction.key?.id) return;

    const senderNorm = normJid(senderJid);
    const user = await prisma.user.findFirst({
      where: { dumpJid: senderNorm, waDumpEnabled: true },
      select: { id: true, dumpTaskEmoji: true },
    });
    if (!user) return;

    const emoji = user.dumpTaskEmoji || '✅';
    if (reaction.text !== emoji) return;

    // Find note by WA message ID
    const note = await prisma.note.findFirst({
      where: { userId: user.id, sourceWaMsgId: reaction.key.id },
      select: { id: true, title: true, tasks: { select: { id: true }, take: 1 } },
    });
    if (!note || note.tasks.length > 0) return; // already converted

    const { startDate, dueDate } = defaultTaskDates();
    // No projectId — personal task, no group notification
    await prisma.task.create({
      data: {
        userId: user.id,
        assignedToId: user.id,
        sourceNoteId: note.id,
        title: note.title,
        status: 'todo',
        priority: 'none',
        source: 'wa_dump',
        startDate,
        dueDate,
      },
    });
    console.log('[listener] WA dump emoji → task:', note.title);
  } catch (err) {
    console.error('[listener] handleDumpReaction error:', err.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function start() {
  assertConfig();
  await ensureOwnerWatched();

  // Close previous socket before opening a new one to prevent dual-session 440 loop.
  if (_activeSock) {
    try { _activeSock.end(); } catch (_) {}
    _activeSock = null;
  }

  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default;
  const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  let myLid = null;
  _activeSock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('[listener] Scan this QR with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      sharedSock = sock;
      myLid = sock.user?.lid?.replace(/:\d+@/, '@') || null;
      console.log('[listener] connected. MY_JID =', MY_JID, '| MY_LID =', myLid || '(none)');
      console.log(
        '[listener] features: encryption=%s, watsonx=%s, rate-limit=%s/window',
        process.env.ENCRYPTION_KEY ? 'on' : 'off (plaintext)',
        process.env.WATSONX_PROJECT_ID ? 'on' : 'off',
        process.env.MENTION_RATE_LIMIT_MAX ?? '5 (default)'
      );
      writeHeartbeat({ connected: true, myJid: MY_JID });
      notify(`✅ *Mentio listener connected*\nJID: \`${MY_JID}\`\nLID: \`${myLid || 'none'}\``);

      // Register intervals only once — prevent accumulation across reconnects.
      if (!_queueInterval) {
        _queueInterval = setInterval(processMessageQueue, 5000);
      }
      if (!_heartbeatInterval) {
        // Periodic heartbeat — refreshes connected=true every 2 min.
        _heartbeatInterval = setInterval(() => {
          if (sharedSock) writeHeartbeat({ connected: true, myJid: MY_JID });
        }, 2 * 60 * 1000);
      }

      // Backfill only once per process lifetime — not on every reconnect.
      if (!_hasBackfilled) {
        _hasBackfilled = true;
        syncAllClaimedGroups(sock).catch((e) =>
          console.error('[listener] syncAllClaimedGroups error', e.message)
        );
      }
    }
    if (connection === 'close') {
      sharedSock = null;
      _activeSock = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      // 440 = session conflict (another instance connected). Use long backoff
      // so the ghost session has time to expire on WA's server side.
      const isConflict = code === 440;
      const delay = isConflict ? 30000 : 3000;
      console.log('[listener] connection closed', code, loggedOut ? '(logged out)' : `(reconnecting in ${delay/1000}s)`);
      writeHeartbeat({ connected: false });
      // Suppress spam notifications for conflict loops — only notify once per minute.
      if (!isConflict) {
        notify(
          loggedOut
            ? `🚨 *Mentio listener LOGGED OUT* (code ${code})\nNeed to re-scan QR on VPS.`
            : `⚠️ Mentio listener disconnected (code ${code}) — reconnecting…`
        );
      }
      if (loggedOut) {
        // Exit code 5 = needs re-auth. PM2 is configured with --stop-exit-codes 5
        // so it won't auto-restart and spam Telegram on every PM2 restart.
        console.log('[listener] exiting with code 5 (needs re-auth) — PM2 will not auto-restart');
        process.exit(5);
      }
      if (!isConflict) setTimeout(start, delay);
    }
  });

  // Keep claimed groups' member lists fresh as people join/leave.
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const gid = update?.id;
      if (!gid) return;
      const claimed = await prisma.userGroup.findFirst({ where: { groupId: gid } });
      if (claimed) await syncGroupMembers(sock, gid);
    } catch (e) {
      console.error('[listener] group-participants.update error', e.message);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        const remoteJid = msg.key?.remoteJid;

        // ── WA Dump: incoming DM to this number (claim code or note from linked JID)
        if (!msg.key.fromMe && remoteJid && !remoteJid.endsWith('@g.us')) {
          if (msg.message?.reactionMessage) {
            await handleDumpReaction(msg, remoteJid);
          } else {
            await handleWaDumpIncoming(sock, msg, remoteJid);
          }
          continue;
        }

        // ── Self-chat: user kirim pesan ke nomornya sendiri (remoteJid === MY_JID)
        // Baileys set fromMe=true untuk self-message — perlu dihandle terpisah
        if (msg.key.fromMe && remoteJid && normJid(remoteJid) === normJid(MY_JID || '')) {
          await handleWaDumpIncoming(sock, msg, remoteJid);
          continue;
        }

        if (!remoteJid || !remoteJid.endsWith('@g.us')) continue;
        if (msg.key.fromMe) continue;

        // ── Reaction: react dengan TASK_EMOJI → buat task ────────────────────
        const reaction = msg.message?.reactionMessage;
        if (reaction) {
          if (reaction.text === TASK_EMOJI) {
            await handleReactionTask(sock, msg, remoteJid, reaction);
          }
          continue;
        }

        const text = extractText(msg);
        const mentioned = extractMentions(msg);
        const normalizedMentions = mentioned.map((j) => j.replace(/:\d+@/, '@'));

        // Cache pesan supaya bisa di-lookup saat reaction datang
        if (msg.key.id && text) {
          cacheMessage(msg.key.id, text, msg.pushName || null);
        }

        console.log(`[debug] group msg | from: ${msg.pushName || msg.key.participant} | mentions: [${normalizedMentions.join(', ')}] | text: ${text.slice(0, 60)}`);

        const group = await ensureGroupRow(sock, remoteJid);

        // Slash commands: handle and short-circuit (don't process as mention).
        if (text.startsWith('/')) {
          const parsed = parseCommand(text);
          if (parsed) {
            await dispatchCommand(sock, msg);
            continue;
          }
        }

        // Capture sender's pushName into GroupMember so the picker shows real
        // names instead of raw LIDs — for claimed groups only (avoid bloat).
        const senderJidRaw = msg.key.participant || msg.participant;
        if (senderJidRaw && msg.pushName) {
          const senderJidNorm = senderJidRaw.replace(/:\d+@/, '@');
          const isClaimed = await prisma.userGroup.findFirst({
            where: { groupId: remoteJid },
            select: { id: true },
          });
          if (isClaimed) {
            const phone = senderJidNorm.endsWith('@s.whatsapp.net')
              ? senderJidNorm.split('@')[0]
              : null;
            await prisma.groupMember.upsert({
              where: { groupId_jid: { groupId: remoteJid, jid: senderJidNorm } },
              update: { name: msg.pushName, ...(phone ? { phone } : {}) },
              create: {
                groupId: remoteJid,
                jid: senderJidNorm,
                name: msg.pushName,
                phone,
                isAdmin: false,
              },
            });
          }
        }

        // Group claim: a user posted their one-time code in this group.
        const claimMatch = text.match(CLAIM_CODE_REGEX);
        if (claimMatch) {
          const claimerJid = (msg.key.participant || msg.participant || '').replace(/:\d+@/, '@');
          await handleClaim(sock, claimMatch[0].toUpperCase(), remoteJid, group.name, claimerJid);
        }

        // Full Chat Summary: buffer every message for groups where any user has it enabled
        if (text) {
          const fullChatLinks = await prisma.userGroup.findMany({
            where: { groupId: remoteJid, fullChatSummary: true },
            select: { userId: true },
          });
          if (fullChatLinks.length > 0) {
            const sender = msg.pushName || (msg.key.participant || '').split('@')[0] || 'Unknown';
            bufferMessage(
              remoteJid,
              group.name,
              sender,
              text,
              fullChatLinks.map((l) => l.userId)
            );
          }
        }

        // Only users who have CLAIMED this group may receive mentions from it.
        const claimedLinks = await prisma.userGroup.findMany({
          where: { groupId: remoteJid },
          select: { userId: true },
        });
        const claimedUserIds = new Set(claimedLinks.map((l) => l.userId));
        if (claimedUserIds.size === 0) continue; // group not claimed by anyone yet

        const watchedRows = await prisma.watchedJid.findMany({
          where: { active: true, userId: { in: [...claimedUserIds] } },
          include: { user: { select: { id: true, waMode: true } } },
        });
        const sharedWatched = watchedRows.filter((w) => !w.user || w.user.waMode === 'shared');

        const matched = sharedWatched.filter((w) => {
          const number = w.jid.replace(/@(s\.whatsapp\.net|lid)$/, '');
          const isOwnerJid = w.jid === MY_JID;
          return (
            normalizedMentions.includes(w.jid) ||
            (isOwnerJid && myLid && normalizedMentions.includes(myLid)) ||
            text.includes(`@${number}`)
          );
        });

        if (matched.length === 0) {
          const unknownLids = normalizedMentions.filter(
            (j) => j.endsWith('@lid') && !(myLid && j === myLid)
          );
          if (unknownLids.length > 0) {
            const groupUsers = await prisma.userGroup.findMany({
              where: { groupId: remoteJid, enabled: true },
              select: { userId: true },
            });
            for (const { userId } of groupUsers) {
              for (const lid of unknownLids) {
                const alreadyWatched = await prisma.watchedJid.findFirst({
                  where: { userId, jid: lid },
                });
                if (alreadyWatched) continue;
                await prisma.discoveredJid.upsert({
                  where: { userId_jid: { userId, jid: lid } },
                  update: { seenCount: { increment: 1 }, lastSeen: new Date() },
                  create: { userId, jid: lid, seenInGroup: remoteJid },
                });
              }
            }
            console.log(`[listener] discovered unknown LID(s): ${unknownLids.join(', ')} — visible in Settings`);
          }
          continue;
        }

        const senderJid = msg.key.participant || msg.participant || remoteJid;
        const senderName = msg.pushName || null;
        const ts = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000)
          : new Date();

        // Behaviour rule: drop mentions past the per-(group, sender) rate
        // limit instead of persisting every single one — protects the feed
        // (and the AI summary budget) from a noisy sender or forwarded chain.
        if (!shouldRecordMention(remoteJid, senderJid)) {
          console.log(`[listener] rate-limited mention from ${senderJid} in ${group.name}`);
          continue;
        }

        // Download image once (shared across all matched watchers for this message)
        const mentionImageUrlPromise = msg.message?.imageMessage
          ? downloadWaImage(msg)
          : Promise.resolve(null);
        const mentionImageUrl = await mentionImageUrlPromise;

        for (const w of matched) {
          const userId = w.userId;

          // One Mention per (message, user) — each watcher gets their own row.
          const savedMention = await prisma.mention.upsert({
            where: { messageId_userId: { messageId: msg.key.id, userId } },
            update: {},
            create: {
              messageId: msg.key.id,
              groupId: remoteJid,
              userId,
              senderJid,
              senderName,
              text: encryptText(text), // chat content is encrypted at rest — see src/crypto.js
              mentionedJid: w.jid,
              timestamp: ts,
              ...(mentionImageUrl ? { imageUrls: [mentionImageUrl] } : {}),
            },
          });
          console.log(`[listener] mention saved for user ${userId} in ${group.name}`);
          maybeAutoSummarize(userId, remoteJid).catch((e) =>
            console.error('[listener] auto-summarize error', e.message)
          );
          // Tag the mention with a watsonx-classified category, if configured.
          // Fire-and-forget: classification is a nice-to-have, never blocks
          // ingestion on IBM's API being slow or unavailable.
          classifyMessage(text).then((category) => {
            if (!category) return;
            return prisma.mention.update({ where: { id: savedMention.id }, data: { category } });
          }).catch((e) => console.error('[listener] watsonx classify error', e.message));
        }
      } catch (err) {
        console.error('[listener] error handling message', err);
      }
    }
  });
}

// Auto-summarize: called after each mention is saved.
// Triggers summarizeGroup only if user has autoSummarize=true for this group
// and at least 30 minutes have passed since the last auto-summarize.
const AUTO_SUMMARIZE_COOLDOWN_MS = 30 * 60 * 1000; // 30 menit

async function maybeAutoSummarize(userId, groupId) {
  const ug = await prisma.userGroup.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { autoSummarize: true, lastAutoSummarizedAt: true },
  });
  if (!ug?.autoSummarize) return;

  const now = Date.now();
  const last = ug.lastAutoSummarizedAt ? ug.lastAutoSummarizedAt.getTime() : 0;
  if (now - last < AUTO_SUMMARIZE_COOLDOWN_MS) {
    console.log(`[listener] auto-summarize cooldown active for user ${userId} group ${groupId}`);
    return;
  }

  // Mark timestamp first to prevent concurrent runs
  await prisma.userGroup.update({
    where: { userId_groupId: { userId, groupId } },
    data: { lastAutoSummarizedAt: new Date() },
  });

  console.log(`[listener] auto-summarize triggered for user ${userId} group ${groupId}`);
  const summary = await summarizeGroup(groupId, userId);
  if (summary) {
    console.log(`[listener] auto-summarize done for group ${groupId}`);
  } else {
    console.log(`[listener] auto-summarize: no unprocessed mentions for group ${groupId}`);
  }
}

start().catch((err) => {
  console.error('[listener] fatal', err);
  process.exit(1);
});
