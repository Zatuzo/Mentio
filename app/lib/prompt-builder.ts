// Assembles a "vibe coding" prompt from a task + project context + codebase snapshot.
// The output is meant to be pasted straight into a coding agent (Cursor, Claude Code, etc.).

import type { CodebaseContext } from './github';

export type PromptTask = {
  title: string;
  description: string | null;
  requester: string | null;
  dueDate: Date | string | null;
  group: { name: string } | null;
};

export type PromptProject = {
  name: string;
  prd: string | null;
  techStack: string | null;
  conventions: string | null;
};

/** Render a flat list of file paths as an indented directory tree. */
function renderTree(paths: string[]): string {
  type Node = { children: Map<string, Node>; isFile: boolean };
  const root: Node = { children: new Map(), isFile: false };

  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    parts.forEach((part, i) => {
      if (!node.children.has(part)) {
        node.children.set(part, { children: new Map(), isFile: i === parts.length - 1 });
      }
      node = node.children.get(part)!;
    });
  }

  const lines: string[] = [];
  const walk = (node: Node, depth: number) => {
    const entries = [...node.children.entries()].sort((a, b) => {
      const aDir = a[1].children.size > 0;
      const bDir = b[1].children.size > 0;
      if (aDir !== bDir) return aDir ? -1 : 1; // dirs first
      return a[0].localeCompare(b[0]);
    });
    for (const [name, child] of entries) {
      const isDir = child.children.size > 0;
      lines.push(`${'  '.repeat(depth)}${isDir ? name + '/' : name}`);
      if (isDir) walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return lines.join('\n');
}

export function buildTaskPrompt(
  task: PromptTask,
  project: PromptProject,
  codebase: CodebaseContext | null
): string {
  const parts: string[] = [];

  parts.push(`# Task: ${task.title}`);
  parts.push('');
  parts.push(
    `You are an AI coding agent working on the **${project.name}** project. ` +
      `Complete the task described below, respecting the project context and codebase conventions.`
  );

  // ── Task detail ──
  parts.push('');
  parts.push('## Task details');
  if (task.description?.trim()) {
    parts.push(task.description.trim());
  } else {
    parts.push('_(No description — infer scope from the title and project context.)_');
  }
  const meta: string[] = [];
  if (task.requester) meta.push(`Requested by: ${task.requester}`);
  if (task.group?.name) meta.push(`Source: WhatsApp group "${task.group.name}"`);
  if (task.dueDate) meta.push(`Due: ${new Date(task.dueDate).toLocaleDateString()}`);
  if (meta.length) {
    parts.push('');
    parts.push(meta.map((m) => `- ${m}`).join('\n'));
  }

  // ── Project context / PRD ──
  if (project.prd?.trim()) {
    parts.push('');
    parts.push('## Project context (PRD)');
    parts.push(project.prd.trim());
  }
  if (project.techStack?.trim()) {
    parts.push('');
    parts.push(`## Tech stack`);
    parts.push(project.techStack.trim());
  }
  if (project.conventions?.trim()) {
    parts.push('');
    parts.push('## Conventions & guardrails');
    parts.push(project.conventions.trim());
  }

  // ── Codebase ──
  if (codebase && !codebase.error && codebase.fileTree.length > 0) {
    parts.push('');
    parts.push('## Codebase');
    parts.push(`Repository: \`${codebase.repo}\` (branch \`${codebase.branch}\`)`);
    const truncNote =
      codebase.fileCount > codebase.fileTree.length
        ? ` — showing ${codebase.fileTree.length} of ${codebase.fileCount} files`
        : '';
    parts.push('');
    parts.push(`### File structure${truncNote}`);
    parts.push('```');
    parts.push(renderTree(codebase.fileTree));
    parts.push('```');

    if (codebase.readme) {
      parts.push('');
      parts.push('### README');
      parts.push('```markdown');
      parts.push(codebase.readme);
      parts.push('```');
    }

    if (codebase.commits.length) {
      parts.push('');
      parts.push('### Recent commits');
      parts.push(
        codebase.commits.map((c) => `- \`${c.sha}\` ${c.message} — ${c.author}`).join('\n')
      );
    }
  } else if (codebase?.error) {
    parts.push('');
    parts.push(`## Codebase`);
    parts.push(`_(Could not load codebase: ${codebase.error})_`);
  }

  // ── Instructions ──
  parts.push('');
  parts.push('## Instructions');
  parts.push(
    [
      '1. Restate the task in one sentence and list the files you expect to touch.',
      '2. Ask clarifying questions only if genuinely blocked; otherwise proceed.',
      '3. Implement the change, following the conventions above and existing patterns in the codebase.',
      '4. Keep the change minimal and focused on the task scope.',
      '5. Summarize what changed and how to verify it.',
    ].join('\n')
  );

  return parts.join('\n');
}
