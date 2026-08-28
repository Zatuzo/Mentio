import { vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

// ── Env defaults for test environment ────────────────────────────────────────
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'test-api-key';

// ── Prisma mock ───────────────────────────────────────────────────────────────
export const prismaMock = mockDeep<PrismaClient>();

vi.mock('@/app/lib/db', () => ({
  prisma: prismaMock,
}));

// Reset all mock state between tests
beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
});

// ── Session mock ──────────────────────────────────────────────────────────────
vi.mock('@/app/lib/session', () => ({
  getSession: vi.fn(),
  requireSession: vi.fn(),
}));

// ── next/headers mock (needed by session.ts and some routes) ──────────────────
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));
