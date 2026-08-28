'use strict';
// Canvas realtime sync server — tldraw @tldraw/sync-core
// Runs on port WS_PORT (default 1999) alongside Next.js.
// Nginx proxies /canvas-ws → this server (WebSocket upgrade).

const http = require('http');
const { WebSocketServer } = require('ws');
const { TLSocketRoom } = require('@tldraw/sync-core');
const { createTLSchema, defaultShapeSchemas } = require('@tldraw/tlschema');
const { T } = require('@tldraw/validate');
const { PrismaClient } = require('@prisma/client');

// Schema that includes our custom task-card shape with correct prop validators.
// Server must validate records — props: {} means "no props allowed", causing InvalidRecord errors.
const schema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    'task-card': {
      props: {
        taskId: T.string,
        title: T.string,
        priority: T.string,
        status: T.string,
        assignee: T.nullable(T.string),
        groupName: T.nullable(T.string),
        w: T.number,
        h: T.number,
      },
    },
  },
});

const prisma = new PrismaClient();
const PORT = parseInt(process.env.WS_PORT ?? '1999', 10);

// Active rooms: roomId → TLSocketRoom
const rooms = new Map();
// Debounce save timers: roomId → NodeJS.Timeout
const saveTimers = new Map();

/** Parse "scratch-userId" or "note-abc123" into { entityType, entityId } */
function parseRoomId(roomId) {
  const idx = roomId.indexOf('-');
  if (idx === -1) return { entityType: roomId, entityId: roomId };
  return { entityType: roomId.slice(0, idx), entityId: roomId.slice(idx + 1) };
}

async function saveSnapshot(entityType, entityId, snapshot) {
  try {
    // Strip presence records — they're ephemeral (cursor positions) and cause ghost cursors on reload
    const clean = {
      ...snapshot,
      documents: snapshot.documents.filter(
        (d) => d.state?.typeName !== 'instance_presence',
      ),
    };
    await prisma.canvas.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: { entityType, entityId, snapshot: clean },
      update: { snapshot: clean },
    });
  } catch (err) {
    console.error('[ws] save error:', err.message);
  }
}

async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);

  const { entityType, entityId } = parseRoomId(roomId);

  // Load persisted snapshot
  let snapshot;
  try {
    const canvas = await prisma.canvas.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
    if (canvas?.snapshot) snapshot = canvas.snapshot;
  } catch (err) {
    console.error('[ws] load error:', err.message);
  }

  const room = new TLSocketRoom({
    schema,
    snapshot: snapshot ?? undefined,
    onDataChange() {
      const timer = saveTimers.get(roomId);
      if (timer) clearTimeout(timer);
      saveTimers.set(
        roomId,
        setTimeout(() => saveSnapshot(entityType, entityId, room.getCurrentSnapshot()), 2000),
      );
    },
  });

  rooms.set(roomId, room);
  console.log(`[ws] created room: ${roomId} (snapshot: ${snapshot ? 'loaded' : 'fresh'})`);
  return room;
}

// ── HTTP server (health check) ────────────────────────────────────────────────
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('canvas-ws ok\n');
});

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/canvas-ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const roomId = (url.searchParams.get('roomId') ?? 'scratch-anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log(`[ws] +session ${sessionId} roomId=${roomId}`);

  // Buffer messages that arrive before the room is ready (getOrCreateRoom is async)
  const pendingMessages = [];
  const onEarlyMessage = (data) => pendingMessages.push(data);
  ws.on('message', onEarlyMessage);

  getOrCreateRoom(roomId).then((room) => {
    ws.off('message', onEarlyMessage);

    // WebSocketMinimal: send, close, live readyState getter (addEventListener is optional)
    room.handleSocketConnect({
      sessionId,
      socket: {
        send: (msg) => { if (ws.readyState === 1 /* OPEN */) ws.send(msg); },
        close: () => ws.close(),
        get readyState() { return ws.readyState; },
      },
    });

    // Replay any messages received before the room was ready
    for (const data of pendingMessages) room.handleSocketMessage(sessionId, data);

    ws.on('message', (data) => room.handleSocketMessage(sessionId, data));
    ws.on('close', () => {
      room.handleSocketClose(sessionId);
      console.log(`[ws] -session ${sessionId}`);
    });
    ws.on('error', () => room.handleSocketError(sessionId));
  }).catch((err) => {
    console.error('[ws] room init error:', err.message);
    ws.close();
  });
});

server.listen(PORT, () => {
  console.log(`[ws] Canvas sync server listening on :${PORT}`);
});

async function flushAllRooms() {
  const saves = [];
  for (const [roomId, room] of rooms) {
    const timer = saveTimers.get(roomId);
    if (timer) clearTimeout(timer);
    saveTimers.delete(roomId);
    const { entityType, entityId } = parseRoomId(roomId);
    saves.push(saveSnapshot(entityType, entityId, room.getCurrentSnapshot()));
  }
  await Promise.allSettled(saves);
}

process.on('SIGTERM', async () => {
  console.log('[ws] shutting down — flushing', rooms.size, 'room(s)...');
  await flushAllRooms();
  await prisma.$disconnect();
  console.log('[ws] done');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[ws] SIGINT — flushing', rooms.size, 'room(s)...');
  await flushAllRooms();
  await prisma.$disconnect();
  process.exit(0);
});
