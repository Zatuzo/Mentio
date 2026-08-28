import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  DEFAULT_CLAIM_MESSAGE,
  DEFAULT_TASK_DONE_MESSAGE,
} from '@/app/lib/messages';

describe('renderTemplate', () => {
  it('replaces a single placeholder', () => {
    expect(renderTemplate('Halo {name}!', { name: 'Reza' })).toBe('Halo Reza!');
  });

  it('replaces multiple placeholders in one pass', () => {
    const out = renderTemplate('{a} dan {b}', { a: 'X', b: 'Y' });
    expect(out).toBe('X dan Y');
  });

  it('renders null value as empty string', () => {
    expect(renderTemplate('{x}', { x: null })).toBe('');
  });

  it('renders undefined value as empty string', () => {
    expect(renderTemplate('{x}', { x: undefined })).toBe('');
  });

  it('leaves placeholder blank when key not in vars', () => {
    expect(renderTemplate('{missing}', {})).toBe('');
  });

  it('is idempotent on templates with no placeholders', () => {
    expect(renderTemplate('plain text', {})).toBe('plain text');
  });

  it('renders DEFAULT_CLAIM_MESSAGE correctly', () => {
    const out = renderTemplate(DEFAULT_CLAIM_MESSAGE, { groupName: 'Dev Team', userName: 'Reza' });
    expect(out).toContain('Dev Team');
    expect(out).toContain('berhasil diklaim');
  });

  it('renders DEFAULT_TASK_DONE_MESSAGE with requester', () => {
    const out = renderTemplate(DEFAULT_TASK_DONE_MESSAGE, {
      taskTitle: 'Fix login bug',
      requester: 'Budi',
      requesterSuffix: ' (diminta oleh Budi)',
      userName: 'Reza',
    });
    expect(out).toContain('Fix login bug');
    expect(out).toContain('diminta oleh Budi');
  });

  it('renders DEFAULT_TASK_DONE_MESSAGE without requester', () => {
    const out = renderTemplate(DEFAULT_TASK_DONE_MESSAGE, {
      taskTitle: 'Fix login bug',
      requester: '',
      requesterSuffix: '',
      userName: 'Reza',
    });
    expect(out).toContain('Fix login bug');
    expect(out).not.toContain('diminta oleh');
  });
});
