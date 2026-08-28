// One-time migration: move WATCH_JIDS and WA_GROUPS from .env into the database
require('dotenv').config();
const { prisma } = require('./db');

async function migrate() {
  const MY_JID = process.env.MY_JID || '';
  const rawWatchJids = (process.env.WATCH_JIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const rawWaGroups = (process.env.WA_GROUPS || '').split(',').map((s) => s.trim()).filter(Boolean);

  // Migrate MY_JID
  if (MY_JID) {
    await prisma.watchedJid.upsert({
      where: { jid: MY_JID },
      update: {},
      create: { jid: MY_JID, label: 'Me', active: true },
    });
    console.log(`[migrate] watched: ${MY_JID} (Me)`);
  }

  // Migrate WATCH_JIDS
  for (const jid of rawWatchJids) {
    await prisma.watchedJid.upsert({
      where: { jid },
      update: {},
      create: { jid, label: null, active: true },
    });
    console.log(`[migrate] watched: ${jid}`);
  }

  // Migrate WA_GROUPS — ensure they exist as enabled in DB
  for (const groupJid of rawWaGroups) {
    await prisma.group.upsert({
      where: { id: groupJid },
      update: { enabled: true },
      create: { id: groupJid, name: groupJid, enabled: true },
    });
    console.log(`[migrate] group enabled: ${groupJid}`);
  }

  console.log('\nMigration done. You can now remove WATCH_JIDS and WA_GROUPS from .env');
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
