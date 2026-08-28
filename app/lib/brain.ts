import { prisma } from './db';

export async function ensureInbox(userId: string) {
  const existing = await prisma.space.findFirst({ where: { userId, isInbox: true } });
  if (existing) return existing;
  return prisma.space.create({
    data: { userId, name: 'Inbox', icon: '📥', isInbox: true, order: 0 },
  });
}
