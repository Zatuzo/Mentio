/**
 * Session Manager — HTTP service on port 9001
 * Manages per-user Baileys WA sessions (waMode='own').
 *
 * Endpoints:
 *   GET  /session/:userId        — status + QR (if pending)
 *   POST /session/:userId/start  — start / restart session
 *   POST /session/:userId/stop   — disconnect & clear
 */
require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { prisma } = require('./db');

const PORT = process.env.SESSION_MANAGER_PORT || 9001;
const USERS_AUTH_DIR = path.join(__dirname, '..', 'auth_info', 'users');
if (!fs.existsSync(USERS_AUTH_DIR)) fs.mkdirSync(USERS_AUTH_DIR, { recursive: true });

// userId -> { sock, status: 'connecting'|'qr'|'open'|'closed', qr: string|null }
const sessions = new Map();

// ── helpers ──────────────────────────────────────────────────────────────────

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
  if (existing) return prisma.group.update({ where: { id: groupJid }, data: { name } });
  return prisma.group.create({ data: { id: groupJid, name } });
}

// ── core session ──────────────────────────────────────────────────────────────

async function startSession(userId) {
  // Stop existing session if any
  await stopSession(userId, false);

  const authDir = path.join(USERS_AUTH_DIR, userId);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const entry = { sock: null, status: 'connecting', qr: null, myJid: null, myLid: null };
  sessions.set(userId, entry);

  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default;
  const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  entry.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entry.status = 'qr';
      // Convert to base64 PNG data URL for easy browser display
      entry.qr = await QRCode.toDataURL(qr).catch(() => null);
      await prisma.waSession.upsert({
        where: { userId },
        update: { qrCode: entry.qr, connected: false },
        create: { userId, authDir, qrCode: entry.qr, connected: false },
      });
      console.log(`[session-mgr] QR ready for user ${userId}`);
    }

    if (connection === 'open') {
      entry.status = 'open';
      entry.qr = null;
      entry.myJid = sock.user?.id?.replace(/:\d+@/, '@') || null;
      entry.myLid = sock.user?.lid?.replace(/:\d+@/, '@') || null;
      console.log(`[session-mgr] connected user ${userId} as ${entry.myJid}`);

      await prisma.waSession.upsert({
        where: { userId },
        update: { connected: true, qrCode: null, myJid: entry.myJid, myLid: entry.myLid },
        create: { userId, authDir, connected: true, myJid: entry.myJid, myLid: entry.myLid },
      });

      // Periodic heartbeat — keeps connected=true fresh, prevents stale false
      // from transient close events during Baileys reconnect cycles.
      const heartbeatInterval = setInterval(async () => {
        if (!sessions.has(userId)) { clearInterval(heartbeatInterval); return; }
        await prisma.waSession.updateMany({
          where: { userId },
          data: { connected: true },
        }).catch(() => {});
      }, 2 * 60 * 1000);

      // Poll message queue for this user
      const queueInterval = setInterval(async () => {
        if (!sessions.has(userId)) { clearInterval(queueInterval); return; }
        const pending = await prisma.messageQueue.findMany({
          where: { userId, status: 'pending', attempts: { lt: 3 } },
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

            await sock.sendMessage(item.groupId, { text: item.message });
            await prisma.messageQueue.update({
              where: { id: item.id },
              data: { status: 'sent', sentAt: new Date() },
            });
            console.log(`[session-mgr] sent queued message for user ${userId}`);
          } catch (err) {
            await prisma.messageQueue.update({
              where: { id: item.id },
              data: { attempts: { increment: 1 }, status: item.attempts >= 2 ? 'failed' : 'pending' },
            });
          }
        }
      }, 5000);

      // Auto-add JID to WatchedJid if not already
      if (entry.myJid) {
        await prisma.watchedJid.upsert({
          where: { userId_jid: { userId, jid: entry.myJid } },
          update: {},
          create: { userId, jid: entry.myJid, label: 'Me', active: true },
        }).catch(() => {});
      }

      // Update user waMode to 'own'
      await prisma.user.update({ where: { id: userId }, data: { waMode: 'own' } }).catch(() => {});
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      entry.status = 'closed';
      console.log(`[session-mgr] user ${userId} disconnected (code=${code})`);

      await prisma.waSession.updateMany({
        where: { userId },
        data: { connected: false },
      }).catch(() => {});

      if (loggedOut) {
        // Clear auth so next connect shows QR
        fs.rmSync(authDir, { recursive: true, force: true });
        sessions.delete(userId);
      } else {
        // 440 = session conflict. Use long backoff so ghost session expires on WA server.
        const isConflict = code === 440;
        const delay = isConflict ? 30000 : 3000;
        setTimeout(() => startSession(userId), delay);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || !remoteJid.endsWith('@g.us')) continue;
        if (msg.key.fromMe) continue;

        const text = extractText(msg);
        const mentioned = extractMentions(msg);
        const normalizedMentions = mentioned.map((j) => j.replace(/:\d+@/, '@'));

        const group = await ensureGroupRow(sock, remoteJid);

        // Load this user's watched JIDs
        const watched = await prisma.watchedJid.findMany({
          where: { userId, active: true },
        });

        const matched = watched.filter((w) => {
          const number = w.jid.replace(/@(s\.whatsapp\.net|lid)$/, '');
          const isMyJid = w.jid === entry.myJid;
          return (
            normalizedMentions.includes(w.jid) ||
            (isMyJid && entry.myLid && normalizedMentions.includes(entry.myLid)) ||
            text.includes(`@${number}`)
          );
        });

        if (matched.length === 0) continue;

        // Ensure UserGroup
        await prisma.userGroup.upsert({
          where: { userId_groupId: { userId, groupId: remoteJid } },
          update: {},
          create: { userId, groupId: remoteJid, enabled: true },
        });

        const senderJid = msg.key.participant || msg.participant || remoteJid;
        const ts = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date();

        for (const w of matched) {
          await prisma.mention.upsert({
            where: { messageId_userId: { messageId: msg.key.id, userId } },
            update: {},
            create: {
              messageId: msg.key.id,
              groupId: remoteJid,
              userId,
              senderJid,
              senderName: msg.pushName || null,
              text,
              mentionedJid: w.jid,
              timestamp: ts,
            },
          });
        }
        console.log(`[session-mgr] mention saved for user ${userId} in ${group.name}`);
      } catch (err) {
        console.error('[session-mgr] error handling message', err);
      }
    }
  });
}

async function stopSession(userId, updateDb = true) {
  const entry = sessions.get(userId);
  if (entry?.sock) {
    try { await entry.sock.logout(); } catch (_) {}
    try { entry.sock.end(); } catch (_) {}
  }
  sessions.delete(userId);

  if (updateDb) {
    await prisma.waSession.updateMany({ where: { userId }, data: { connected: false } }).catch(() => {});
    await prisma.user.update({ where: { id: userId }, data: { waMode: 'shared' } }).catch(() => {});
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-user-id');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url || '/';
  const parts = url.split('/').filter(Boolean); // ['session', userId, 'start'?]

  if (parts[0] !== 'session' || !parts[1]) {
    return json(res, 404, { error: 'Not found' });
  }

  const userId = parts[1];
  const action = parts[2]; // 'start' | 'stop' | undefined

  if (req.method === 'GET' && !action) {
    const entry = sessions.get(userId);
    if (!entry) {
      // Check DB for persisted session
      const dbSession = await prisma.waSession.findUnique({ where: { userId } }).catch(() => null);
      if (dbSession?.connected) {
        // Was connected but process restarted — reconnect
        startSession(userId).catch(console.error);
        return json(res, 200, { status: 'connecting', qr: null, jid: null });
      }
      return json(res, 200, { status: 'disconnected', qr: null, jid: null });
    }
    return json(res, 200, { status: entry.status, qr: entry.qr, jid: entry.myJid });
  }

  if (req.method === 'POST' && action === 'start') {
    startSession(userId).catch((err) => console.error('[session-mgr] startSession error', err));
    return json(res, 200, { ok: true, message: 'Session starting…' });
  }

  if ((req.method === 'POST' || req.method === 'DELETE') && action === 'stop') {
    await stopSession(userId);
    return json(res, 200, { ok: true });
  }

  json(res, 404, { error: 'Unknown route' });
});

// Restore sessions on startup.
// Use waMode='own' + auth dir exists as the source of truth — not connected=true,
// which can be stale false after a crash or transient disconnect.
async function restoreSessions() {
  const ownUsers = await prisma.user.findMany({
    where: { waMode: 'own' },
    select: { id: true },
  }).catch(() => []);

  for (const u of ownUsers) {
    const authDir = path.join(USERS_AUTH_DIR, u.id);
    if (fs.existsSync(authDir)) {
      console.log(`[session-mgr] restoring session for user ${u.id}`);
      startSession(u.id).catch(console.error);
    } else {
      // Auth dir missing — revert to shared so they're not stuck
      await prisma.user.update({ where: { id: u.id }, data: { waMode: 'shared' } }).catch(() => {});
      console.log(`[session-mgr] no auth dir for user ${u.id}, reverted to shared`);
    }
  }
}

server.listen(PORT, async () => {
  console.log(`[session-mgr] listening on port ${PORT}`);
  await restoreSessions();
});
