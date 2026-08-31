import { describe, it, expect } from 'vitest';

// src/summarizer.js is a plain CJS module (runs as a Node script, not
// through the Next.js build) — these are its two pure gating functions,
// exported purely for this kind of direct unit test.
const { resolveAssignee, shouldCreateTask } = require('../../src/summarizer.js');

describe('resolveAssignee', () => {
  const memberIds = new Set(['user-a', 'user-b']);

  it('returns null when no assignee was suggested', () => {
    expect(resolveAssignee(null, memberIds, 'user-a', false)).toBeNull();
  });

  it('returns null when the suggested id is not a real project member', () => {
    expect(resolveAssignee('not-a-member', memberIds, 'user-a', true)).toBeNull();
  });

  it('assigns to the requesting user themselves regardless of the teammate flag', () => {
    expect(resolveAssignee('user-a', memberIds, 'user-a', false)).toBe('user-a');
  });

  it('assigns to a different member only when teammate assignment is allowed', () => {
    expect(resolveAssignee('user-b', memberIds, 'user-a', false)).toBeNull();
    expect(resolveAssignee('user-b', memberIds, 'user-a', true)).toBe('user-b');
  });
});

describe('shouldCreateTask', () => {
  it('always creates a task with no specific directedAt', () => {
    expect(shouldCreateTask({ directedAt: null }, false)).toBe(true);
    expect(shouldCreateTask({ directedAt: null }, true)).toBe(true);
  });

  it('skips a task directed at someone else unless teammate assignment is allowed', () => {
    expect(shouldCreateTask({ directedAt: 'Budi' }, false)).toBe(false);
    expect(shouldCreateTask({ directedAt: 'Budi' }, true)).toBe(true);
  });
});
