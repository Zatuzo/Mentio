import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_USER_EMAIL = 'demo@mentio.local';
const DEMO_JID = '628123456789@s.whatsapp.net';

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      id: 'demo-user',
      name: 'Demo User',
      email: DEMO_USER_EMAIL,
      emailVerified: true,
      hasOnboarded: true,
    },
  });

  const group = await prisma.group.upsert({
    where: { id: 'demo-group' },
    update: {},
    create: { id: 'demo-group', name: 'Tim Peluncuran Produk' },
  });

  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: user.id, groupId: group.id } },
    update: {},
    create: { userId: user.id, groupId: group.id, enabled: true },
  });

  const project = await prisma.project.upsert({
    where: { id: 'demo-project' },
    update: {},
    create: { id: 'demo-project', name: 'Peluncuran Produk' },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    update: {},
    create: { projectId: project.id, userId: user.id, role: 'admin' },
  });

  await prisma.projectGroup.upsert({
    where: { projectId_groupId: { projectId: project.id, groupId: group.id } },
    update: {},
    create: { projectId: project.id, groupId: group.id },
  });

  const statuses = [
    { slug: 'todo', label: 'To Do', order: 0, color: '#f59e0b' },
    { slug: 'in_progress', label: 'In Progress', order: 1, color: '#38bdf8' },
    { slug: 'done', label: 'Done', order: 2, color: '#34d399', isDone: true },
  ];
  for (const s of statuses) {
    await prisma.projectStatus.upsert({
      where: { projectId_slug: { projectId: project.id, slug: s.slug } },
      update: {},
      create: { projectId: project.id, ...s },
    });
  }

  await prisma.watchedJid.upsert({
    where: { userId_jid: { userId: user.id, jid: DEMO_JID } },
    update: {},
    create: { userId: user.id, jid: DEMO_JID, label: 'Saya', active: true },
  });

  const mentionSeeds = [
    {
      id: 'demo-mention-1',
      senderName: 'Rina',
      senderJid: '628111111111@s.whatsapp.net',
      text: '@Demo tolong siapin landing page buat launch besok pagi ya, deadline jam 9',
      minutesAgo: 12,
    },
    {
      id: 'demo-mention-2',
      senderName: 'Bayu',
      senderJid: '628222222222@s.whatsapp.net',
      text: '@Demo ada bug di form checkout, tombol submit ga jalan di mobile',
      minutesAgo: 47,
    },
    {
      id: 'demo-mention-3',
      senderName: 'Sari',
      senderJid: '628333333333@s.whatsapp.net',
      text: '@Demo bisa update deck investor sebelum meeting hari Kamis? tambahin slide traction',
      minutesAgo: 130,
    },
  ];

  for (const m of mentionSeeds) {
    await prisma.mention.upsert({
      where: { messageId_userId: { messageId: m.id, userId: user.id } },
      update: {},
      create: {
        id: m.id,
        messageId: m.id,
        groupId: group.id,
        userId: user.id,
        senderJid: m.senderJid,
        senderName: m.senderName,
        text: m.text,
        mentionedJid: DEMO_JID,
        timestamp: new Date(Date.now() - m.minutesAgo * 60 * 1000),
        processed: false,
      },
    });
  }

  console.log('Seeded demo user, project, group, and mentions.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
