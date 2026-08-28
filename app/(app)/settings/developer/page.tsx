import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { redirect } from 'next/navigation';
import { DeveloperApiKeys } from '@/app/components/DeveloperApiKeys';

export const dynamic = 'force-dynamic';

export default async function DeveloperSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const rawKeys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const keys = rawKeys.map((k) => ({
    ...k,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

  return <DeveloperApiKeys initialKeys={keys} baseUrl={baseUrl} />;
}
