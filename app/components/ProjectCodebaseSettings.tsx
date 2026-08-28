'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RepoPicker } from './RepoPicker';
import { GitBranch, Check, Loader2, FileText, Plus, X, Star } from 'lucide-react';

type Config = {
  id: string;
  prd: string | null;
  techStack: string | null;
  conventions: string | null;
  hasToken: boolean;
  myDefaultRepoId: string | null;
};

type Repo = { id: string; fullName: string; branch: string };

interface Props {
  config: Config;
  isAdmin: boolean;
  githubConnected: boolean;
}

export function ProjectCodebaseSettings({ config, isAdmin, githubConnected }: Props) {
  const [prd, setPrd] = useState(config.prd ?? '');
  const [techStack, setTechStack] = useState(config.techStack ?? '');
  const [conventions, setConventions] = useState(config.conventions ?? '');
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(config.hasToken);
  const [saving, setSaving] = useState(false);

  // Repos pool (admin manages) + my default (any member picks)
  const [repos, setRepos] = useState<Repo[]>([]);
  const [myDefaultId, setMyDefaultId] = useState<string | null>(config.myDefaultRepoId);
  const [reposLoading, setReposLoading] = useState(true);

  // Add-repo widget state
  const [newRepo, setNewRepo] = useState('');
  const [newBranch, setNewBranch] = useState('main');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRepos() {
    setReposLoading(true);
    try {
      const res = await fetch(`/api/projects/${config.id}/repos`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load repos');
      setRepos(data.repos);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReposLoading(false);
    }
  }

  async function saveContext() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${config.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prd,
          techStack,
          conventions,
          githubToken: token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setHasToken(data.hasToken);
      setToken('');
      toast.success('Team context saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearToken() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${config.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ githubToken: null }),
      });
      if (!res.ok) throw new Error('Failed to remove token');
      setHasToken(false);
      setToken('');
      toast.success('GitHub token removed');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addRepo() {
    if (!newRepo.trim()) {
      toast.error('Pick or paste a repo first');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${config.id}/repos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: newRepo.trim(), branch: newBranch.trim() || 'main' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add repo');
      setRepos((prev) => {
        if (prev.some((r) => r.id === data.repo.id)) return prev;
        return [...prev, data.repo];
      });
      setNewRepo('');
      setNewBranch('main');
      toast.success(`Added ${data.repo.fullName}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function removeRepo(repo: Repo) {
    if (!confirm(`Remove ${repo.fullName} from project repos?`)) return;
    try {
      const res = await fetch(`/api/projects/${config.id}/repos/${repo.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove repo');
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
      if (myDefaultId === repo.id) setMyDefaultId(null);
      toast.success('Repo removed');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function setMyDefault(repoId: string | null) {
    const prev = myDefaultId;
    setMyDefaultId(repoId); // optimistic
    try {
      const res = await fetch(`/api/projects/${config.id}/me`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defaultRepoId: repoId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to set default');
      }
      toast.success(repoId ? 'Default repo updated' : 'Default cleared');
    } catch (e: any) {
      setMyDefaultId(prev);
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Team context (admin only) ────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4 text-primary" />
            Team context
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {isAdmin ? 'Editable · admin' : 'Read-only'}
          </span>
        </div>
        {!isAdmin && (
          <p className="text-xs text-primary/80">
            Only project admins can edit team context. Below is read-only.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="prd">PRD / Project description</Label>
          <Textarea
            id="prd"
            rows={5}
            placeholder="What is this project? Goals, key features, target users, constraints…"
            value={prd}
            onChange={(e) => setPrd(e.target.value)}
            disabled={!isAdmin}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="techstack">Tech stack</Label>
          <Input
            id="techstack"
            placeholder="e.g. Next.js 14, Prisma, PostgreSQL, Tailwind"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            disabled={!isAdmin}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="conventions">Conventions & guardrails</Label>
          <Textarea
            id="conventions"
            rows={3}
            placeholder="Coding conventions, things to avoid, naming rules, testing expectations…"
            value={conventions}
            onChange={(e) => setConventions(e.target.value)}
            disabled={!isAdmin}
          />
        </div>

        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor="token">
              Shared GitHub token{' '}
              <span className="text-muted-foreground font-normal">
                {githubConnected
                  ? '(optional — used as fallback when admin GitHub OAuth can\'t reach a repo)'
                  : '(fine-grained PAT with read access to all project repos)'}
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="token"
                type="password"
                placeholder={hasToken ? '•••••••• saved — leave blank to keep' : 'github_pat_…'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              {hasToken && (
                <Button type="button" variant="ghost" size="sm" onClick={clearToken}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        )}

        {isAdmin && (
          <Button onClick={saveContext} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save team context
          </Button>
        )}
      </section>

      {/* ─── Project repositories (admin manages) ─────────────────────────── */}
      <section className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="w-4 h-4 text-indigo-400" />
            Project repositories
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {isAdmin ? 'Editable · admin' : 'Read-only'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          The pool of repos this project owns. Members pick one as their default below.
        </p>

        {reposLoading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2 py-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : repos.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No repos added yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border">
            {repos.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-2.5">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate">{r.fullName}</div>
                  <div className="text-xs text-muted-foreground">branch: {r.branch}</div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRepo(r)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {isAdmin && (
          <div className="grid grid-cols-[1fr_120px_auto] gap-2 pt-2 border-t border-border">
            <div>
              {githubConnected ? (
                <RepoPicker
                  value={newRepo}
                  onChange={(repo, defaultBranch) => {
                    setNewRepo(repo);
                    if (defaultBranch) setNewBranch(defaultBranch);
                  }}
                />
              ) : (
                <Input
                  placeholder="owner/repo or github.com URL"
                  value={newRepo}
                  onChange={(e) => setNewRepo(e.target.value)}
                />
              )}
            </div>
            <Input
              placeholder="main"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
            />
            <Button onClick={addRepo} disabled={adding || !newRepo.trim()} size="sm">
              {adding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add
            </Button>
          </div>
        )}
      </section>

      {/* ─── Your default repo (any member) ───────────────────────────────── */}
      <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Star className="w-4 h-4 text-primary" />
            Your default repo
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Personal</span>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Picked automatically when you generate a prompt. You can still pick a different repo
          per-prompt later.
        </p>

        {repos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add a repo to the project first (above) — admin manages this list.
          </p>
        ) : (
          <ul className="space-y-1.5">
            <li>
              <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                <input
                  type="radio"
                  name="defaultRepo"
                  checked={myDefaultId === null}
                  onChange={() => setMyDefault(null)}
                  className="accent-amber-500"
                />
                <span className="text-sm text-muted-foreground italic">
                  No default — fall back to project's first repo
                </span>
              </label>
            </li>
            {repos.map((r) => (
              <li key={r.id}>
                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                  <input
                    type="radio"
                    name="defaultRepo"
                    checked={myDefaultId === r.id}
                    onChange={() => setMyDefault(r.id)}
                    className="accent-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">{r.fullName}</div>
                    <div className="text-xs text-muted-foreground">branch: {r.branch}</div>
                  </div>
                  {myDefaultId === r.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
