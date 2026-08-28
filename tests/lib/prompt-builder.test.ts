import { describe, it, expect } from 'vitest';
import { buildTaskPrompt, type PromptTask, type PromptProject } from '@/app/lib/prompt-builder';

const baseTask: PromptTask = {
  title: 'Fix login bug',
  description: 'Users cannot login after password reset.',
  requester: 'Budi',
  dueDate: new Date('2026-06-01'),
  group: { name: 'Dev Team' },
};

const baseProject: PromptProject = {
  name: 'Mentio',
  prd: 'A WhatsApp mention monitoring tool.',
  techStack: 'Next.js 14, Prisma, Baileys',
  conventions: 'No default exports. Use server actions for mutations.',
};

describe('buildTaskPrompt', () => {
  it('includes task title in output', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(out).toContain('Fix login bug');
  });

  it('includes project name in output', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(out).toContain('Mentio');
  });

  it('includes task description when provided', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(out).toContain('cannot login after password reset');
  });

  it('shows fallback message when description is null', () => {
    const task = { ...baseTask, description: null };
    const out = buildTaskPrompt(task, baseProject, null);
    expect(out).toContain('No description');
  });

  it('shows fallback message when description is empty string', () => {
    const task = { ...baseTask, description: '' };
    const out = buildTaskPrompt(task, baseProject, null);
    expect(out).toContain('No description');
  });

  it('includes requester in metadata', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(out).toContain('Budi');
  });

  it('includes group name in metadata', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(out).toContain('Dev Team');
  });

  it('includes PRD when provided', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(out).toContain('WhatsApp mention monitoring tool');
  });

  it('includes tech stack when provided', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(out).toContain('Next.js 14');
  });

  it('includes conventions when provided', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(out).toContain('No default exports');
  });

  it('omits PRD section when prd is null', () => {
    const project = { ...baseProject, prd: null };
    const out = buildTaskPrompt(baseTask, project, null);
    expect(out).not.toContain('Project context');
  });

  it('omits tech stack section when techStack is null', () => {
    const project = { ...baseProject, techStack: null };
    const out = buildTaskPrompt(baseTask, project, null);
    expect(out).not.toContain('Tech stack');
  });

  it('includes codebase section when codebase provided', () => {
    const codebase = {
      repo: 'owner/mentio',
      branch: 'main',
      fileTree: ['app/page.tsx', 'app/api/tasks/route.ts'],
      fileCount: 2,
      readme: '# Mentio',
      commits: [{ sha: 'abc1234', message: 'initial commit', author: 'Reza' }],
      error: null,
    };
    const out = buildTaskPrompt(baseTask, baseProject, codebase);
    expect(out).toContain('owner/mentio');
    // file tree is rendered as indented tree, not flat paths
    expect(out).toContain('route.ts');
    expect(out).toContain('initial commit');
  });

  it('shows error note when codebase has error', () => {
    const codebase = {
      repo: 'owner/mentio',
      branch: 'main',
      fileTree: [],
      fileCount: 0,
      readme: null,
      commits: [],
      error: 'Not found',
    };
    const out = buildTaskPrompt(baseTask, baseProject, codebase);
    expect(out).toContain('Could not load codebase');
  });

  it('returns a non-empty string', () => {
    const out = buildTaskPrompt(baseTask, baseProject, null);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
