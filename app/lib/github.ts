// Minimal GitHub REST client for pulling codebase context into generated prompts.
// Token is optional for public repos (but recommended — raises rate limits).

const API = 'https://api.github.com';

export type GithubConfig = {
  repo: string; // "owner/repo"
  branch?: string | null;
  token?: string | null;
};

export type CodebaseContext = {
  repo: string;
  branch: string;
  fileTree: string[]; // file paths, truncated
  fileCount: number; // total files before truncation
  readme: string | null;
  commits: { sha: string; message: string; author: string; date: string }[];
  error?: string;
};

/** Accepts "owner/repo", a full GitHub URL, or "github.com/owner/repo". */
export function parseRepo(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/\.git$/, '');
  const urlMatch = trimmed.match(/github\.com[/:]([^/]+)\/([^/?#]+)/i);
  if (urlMatch) return `${urlMatch[1]}/${urlMatch[2]}`;
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed;
  return null;
}

function headers(token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'wa-mention-agent',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch(path: string, token?: string | null) {
  const res = await fetch(`${API}${path}`, {
    headers: headers(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let msg = `GitHub API ${res.status}`;
    if (res.status === 404) msg = 'Repo/branch not found, or token lacks access';
    else if (res.status === 401) msg = 'Invalid GitHub token';
    else if (res.status === 403) msg = 'GitHub rate limit hit — add a token';
    throw new Error(`${msg}${body ? `: ${body.slice(0, 120)}` : ''}`);
  }
  return res.json();
}

export type RepoSummary = {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  pushedAt: string;
};

/** List repos the authenticated user can access (owner, collaborator, org member). */
export async function listUserRepos(token: string): Promise<RepoSummary[]> {
  const data = await ghFetch(
    '/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member',
    token
  );
  if (!Array.isArray(data)) return [];
  return data.map((r: any) => ({
    fullName: r.full_name,
    private: !!r.private,
    defaultBranch: r.default_branch || 'main',
    description: r.description || null,
    pushedAt: r.pushed_at || '',
  }));
}

/** Verify access and resolve the default branch. Used by the "Test connection" button. */
export async function checkRepo(cfg: GithubConfig) {
  const data = await ghFetch(`/repos/${cfg.repo}`, cfg.token);
  return {
    fullName: data.full_name as string,
    private: data.private as boolean,
    defaultBranch: data.default_branch as string,
    description: (data.description as string) || null,
  };
}

const MAX_TREE = 400;

/** Fetch the full codebase context for prompt generation. Never throws — errors go in `.error`. */
export async function getCodebaseContext(cfg: GithubConfig): Promise<CodebaseContext> {
  const branch = cfg.branch?.trim() || 'main';
  const ctx: CodebaseContext = {
    repo: cfg.repo,
    branch,
    fileTree: [],
    fileCount: 0,
    readme: null,
    commits: [],
  };

  try {
    const [tree, readme, commits] = await Promise.allSettled([
      ghFetch(`/repos/${cfg.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, cfg.token),
      ghFetch(`/repos/${cfg.repo}/readme?ref=${encodeURIComponent(branch)}`, cfg.token),
      ghFetch(`/repos/${cfg.repo}/commits?sha=${encodeURIComponent(branch)}&per_page=8`, cfg.token),
    ]);

    if (tree.status === 'fulfilled') {
      const files = (tree.value.tree || []).filter((n: any) => n.type === 'blob');
      ctx.fileCount = files.length;
      ctx.fileTree = files.slice(0, MAX_TREE).map((n: any) => n.path);
    } else {
      ctx.error = tree.reason?.message || 'Failed to read repo tree';
    }

    if (readme.status === 'fulfilled' && readme.value.content) {
      const decoded = Buffer.from(readme.value.content, 'base64').toString('utf8');
      ctx.readme = decoded.length > 4000 ? decoded.slice(0, 4000) + '\n…(truncated)' : decoded;
    }

    if (commits.status === 'fulfilled' && Array.isArray(commits.value)) {
      ctx.commits = commits.value.map((c: any) => ({
        sha: (c.sha || '').slice(0, 7),
        message: (c.commit?.message || '').split('\n')[0],
        author: c.commit?.author?.name || c.author?.login || 'unknown',
        date: c.commit?.author?.date || '',
      }));
    }
  } catch (e: any) {
    ctx.error = e?.message || 'GitHub request failed';
  }

  return ctx;
}

// ── Write operations (for agent execution) ────────────────────────────────────

async function ghWrite(path: string, body: unknown, token: string, method = 'PUT') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${method} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Read a single file's content. Returns null if not found. */
export async function getFileContent(
  cfg: GithubConfig,
  path: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const cleanPath = path.replace(/^\/+/, '');
    const ref = cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : '';
    const data = await ghFetch(`/repos/${cfg.repo}/contents/${cleanPath}${ref}`, cfg.token);
    if (!data.content) return null;
    return {
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      sha: data.sha,
    };
  } catch {
    return null;
  }
}

/** Get the SHA of a branch tip. */
async function getBranchSha(repo: string, branch: string, token: string): Promise<string> {
  const data = await ghFetch(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, token);
  return data.object.sha;
}

/** Create a new branch from an existing one. */
export async function createBranch(
  cfg: Required<Pick<GithubConfig, 'repo' | 'token'>>,
  newBranch: string,
  fromBranch = 'main'
): Promise<void> {
  const sha = await getBranchSha(cfg.repo, fromBranch, cfg.token);
  await ghWrite(
    `/repos/${cfg.repo}/git/refs`,
    { ref: `refs/heads/${newBranch}`, sha },
    cfg.token,
    'POST'
  );
}

/** Create or update a file on a branch. */
export async function commitFile(
  cfg: Required<Pick<GithubConfig, 'repo' | 'token'>>,
  filePath: string,
  content: string,
  message: string,
  branch: string,
  existingSha?: string
): Promise<void> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const encoded = Buffer.from(content, 'utf8').toString('base64');
  const body: Record<string, unknown> = { message, content: encoded, branch };
  if (existingSha) body.sha = existingSha;
  await ghWrite(`/repos/${cfg.repo}/contents/${cleanPath}`, body, cfg.token);
}

export type PullRequest = {
  number: number;
  url: string;
  title: string;
};

/** Create a pull request and return its URL. */
export async function createPullRequest(
  cfg: Required<Pick<GithubConfig, 'repo' | 'token'>>,
  title: string,
  body: string,
  head: string,
  base = 'main'
): Promise<PullRequest> {
  const data = await ghWrite(
    `/repos/${cfg.repo}/pulls`,
    { title, body, head, base, draft: true },
    cfg.token,
    'POST'
  );
  return { number: data.number, url: data.html_url, title: data.title };
}
