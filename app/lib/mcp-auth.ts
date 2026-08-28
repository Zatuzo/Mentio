import { createHash } from 'crypto';
import { prisma } from './db';
import type { ApiKey } from '@prisma/client';

export type AuthedApiKey = ApiKey & { userId: string };

export async function validateMcpKey(req: Request): Promise<AuthedApiKey | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix },
  });

  const key = candidates.find((k) => k.keyHash === keyHash) ?? null;
  if (!key) return null;

  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Update lastUsedAt non-blocking
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return key as AuthedApiKey;
}

export function requireScope(key: AuthedApiKey, scope: 'read' | 'write'): boolean {
  if (scope === 'read') return true; // all keys have read
  return key.scopes.includes('write');
}
