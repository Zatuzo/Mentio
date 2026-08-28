import { prisma } from './db';

/**
 * Resolve the GitHub access token to use for a request.
 * Priority: the user's linked GitHub OAuth token → the project's PAT fallback.
 */
export async function resolveGithubToken(
  userId: string,
  projectToken?: string | null
): Promise<{ token: string | null; source: 'oauth' | 'pat' | 'none' }> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: 'github' },
    select: { accessToken: true },
  });

  if (account?.accessToken) return { token: account.accessToken, source: 'oauth' };
  if (projectToken) return { token: projectToken, source: 'pat' };
  return { token: null, source: 'none' };
}

/** Whether the user has a linked GitHub account. */
export async function hasGithubAccount(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: 'github' },
    select: { id: true },
  });
  return !!account;
}
