import { prisma } from './db';

// Auth is disabled for this build: every request acts as the single seeded
// demo user (see prisma/seed-demo.ts) instead of going through better-auth.
const DEMO_USER_EMAIL = 'demo@mentio.local';

let cachedUserId: string | null = null;

export async function getSession() {
  if (!cachedUserId) {
    const demoUser = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
    if (!demoUser) return null;
    cachedUserId = demoUser.id;
  }

  const user = await prisma.user.findUnique({ where: { id: cachedUserId } });
  if (!user) return null;

  return {
    session: { id: 'demo-session', userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) },
    user,
  } as any;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}
