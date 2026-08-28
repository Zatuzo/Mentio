'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import { copyToClipboard } from '@/app/lib/clipboard';

interface Props {
  taskId: string | null;
  taskTitle?: string;
  onClose: () => void;
}

type Repo = { id: string; fullName: string; branch: string };

export function GeneratePromptModal({ taskId, taskTitle, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Multi-repo selection
  const [repos, setRepos] = useState<Repo[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);

  async function fetchPrompt(repoId: string | null) {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    setPrompt('');
    setCopied(false);

    try {
      const url = repoId
        ? `/api/tasks/${taskId}/prompt?repoId=${encodeURIComponent(repoId)}`
        : `/api/tasks/${taskId}/prompt`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate prompt');
      setPrompt(data.prompt);
      setRepos(data.repos || []);
      setActiveRepoId(data.activeRepoId);
      if (data.codebaseError) {
        setWarning(`Codebase not loaded: ${data.codebaseError}`);
      } else if (!data.hasGithubConfigured) {
        setWarning('No repos in this project — prompt has no codebase context. Add one in Settings.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (taskId) fetchPrompt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function copy() {
    try {
      await copyToClipboard(prompt);
      setCopied(true);
      toast.success('Prompt copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the text manually');
    }
  }

  return (
    <Dialog open={!!taskId} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generated prompt
          </DialogTitle>
          <DialogDescription>
            {taskTitle ? `For task "${taskTitle}". ` : ''}
            Copy this into your coding agent (Cursor, Claude Code, …).
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Building prompt — fetching codebase context…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {repos.length > 1 && (
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs text-muted-foreground shrink-0">Repo:</label>
                  <select
                    value={activeRepoId ?? ''}
                    onChange={(e) => fetchPrompt(e.target.value || null)}
                    className="flex-1 h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none"
                  >
                    {repos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fullName} @ {r.branch}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {warning && (
                <div className="flex items-start gap-2 rounded-md bg-primary/10 border border-primary/30 p-2.5 mb-3 text-xs text-primary">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {warning}
                </div>
              )}
              <textarea
                readOnly
                value={prompt}
                className="w-full h-[340px] rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground resize-none outline-none"
                onFocus={(e) => e.currentTarget.select()}
              />
            </>
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={copy} disabled={loading || !!error || !prompt}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy prompt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
