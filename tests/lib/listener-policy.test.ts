import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function freshPolicyModule() {
  vi.resetModules();
  // src/listener-policy.js is a plain CJS module (used by the listener,
  // which runs as a plain Node script, not through the Next.js build).
  return await import('../../src/listener-policy.js');
}

describe('shouldRecordMention', () => {
  beforeEach(() => {
    process.env.MENTION_RATE_LIMIT_MAX = '3';
    process.env.MENTION_RATE_LIMIT_WINDOW_MS = '1000';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.useRealTimers();
  });

  it('allows up to the configured max per (group, sender) then blocks', async () => {
    const { shouldRecordMention } = await freshPolicyModule();
    const group = '123@g.us';
    const sender = '628111@s.whatsapp.net';

    expect(shouldRecordMention(group, sender)).toBe(true);
    expect(shouldRecordMention(group, sender)).toBe(true);
    expect(shouldRecordMention(group, sender)).toBe(true);
    expect(shouldRecordMention(group, sender)).toBe(false); // 4th within the window
  });

  it('tracks each sender independently within the same group', async () => {
    const { shouldRecordMention } = await freshPolicyModule();
    const group = '123@g.us';

    for (let i = 0; i < 3; i++) shouldRecordMention(group, 'senderA');
    expect(shouldRecordMention(group, 'senderA')).toBe(false);
    expect(shouldRecordMention(group, 'senderB')).toBe(true); // unaffected
  });

  it('allows again once the window has elapsed', async () => {
    vi.useFakeTimers();
    const { shouldRecordMention } = await freshPolicyModule();
    const group = '123@g.us';
    const sender = '628111@s.whatsapp.net';

    for (let i = 0; i < 3; i++) shouldRecordMention(group, sender);
    expect(shouldRecordMention(group, sender)).toBe(false);

    vi.advanceTimersByTime(1100);
    expect(shouldRecordMention(group, sender)).toBe(true);
  });
});
