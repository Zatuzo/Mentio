// Run: node src/seed-test.js [groupJid]
// Seeds fake mention data so you can test the summarize flow without real WhatsApp messages.

require('dotenv').config();
const { prisma } = require('./db');

const groupJid = process.argv[2] || process.env.WA_GROUPS?.split(',')[0]?.trim();

if (!groupJid) {
  console.error('Usage: node src/seed-test.js <groupJid>');
  console.error('Example: node src/seed-test.js 120363426378288680@g.us');
  process.exit(1);
}

const fakementions = [
  { sender: 'Budi', text: '@kamu tolong review PR #42 ya, deadline besok pagi' },
  { sender: 'Siti', text: 'hei @kamu bisa join meeting Zoom jam 3 sore ini?' },
  { sender: 'Andi', text: '@kamu ada bug di fitur login production, user gabisa masuk sejak tadi' },
  { sender: 'Rina', text: '@kamu proposal client sudah dikirim, tolong approve budget-nya' },
  { sender: 'Doni', text: '@kamu kapan deploy ke staging? client nunggu demo besok' },
];

async function seed() {
  // Ensure group row exists
  await prisma.group.upsert({
    where: { id: groupJid },
    update: {},
    create: { id: groupJid, name: 'Test Group', enabled: true },
  });

  const now = Date.now();
  for (let i = 0; i < fakementions.length; i++) {
    const { sender, text } = fakementions[i];
    const ts = new Date(now - (fakementions.length - i) * 10 * 60 * 1000); // spaced 10 min apart
    await prisma.mention.create({
      data: {
        messageId: `test-${Date.now()}-${i}`,
        groupId: groupJid,
        senderJid: `628${String(i).padStart(10, '0')}@s.whatsapp.net`,
        senderName: sender,
        text,
        timestamp: ts,
        processed: false,
      },
    });
    console.log(`[seed] added mention from ${sender}`);
  }

  const count = await prisma.mention.count({ where: { groupId: groupJid, processed: false } });
  console.log(`\nDone. Group ${groupJid} now has ${count} unprocessed mention(s).`);
  console.log('Go to the dashboard and click "Summarize now" to test.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
