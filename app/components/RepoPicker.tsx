'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Lock, Globe, Loader2, RefreshCw, ChevronDown } from 'lucide-react';

type Repo = {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  pushedAt: string;
};

interface Props {
  value: string;
  onChange: (repo: string, defaultBranch?: string) => void;
  disabled?: boolean;
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 30) return `${Math.floor(d / 30)}mo ago`;
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h ago`;
  return 'just now';
}

export function RepoPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  async function load(force = false) {
    if (loaded && !force) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/github/repos');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load repos');
      setRepos(data.repos || []);
      setLoaded(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    load();
  }

  const query = value.trim().toLowerCase();
  const filtered = query
    ? repos.filter((r) => r.fullName.toLowerCase().includes(query))
    : repos;

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Input
          placeholder="Search or pick a repository…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={openDropdown}
          disabled={disabled}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (open ? setOpen(false) : openDropdown())}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-xs text-muted-foreground">
            <span>
              {loading
                ? 'Loading…'
                : error
                  ? 'Error'
                  : `${filtered.length} of ${repos.length} repos`}
            </span>
            <button
              type="button"
              onClick={() => load(true)}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Fetching your repositories…
              </div>
            )}

            {error && (
              <div className="px-3 py-4 text-xs text-primary">{error}</div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                No repositories match. You can also type the name manually.
              </div>
            )}

            {!loading &&
              !error &&
              filtered.slice(0, 60).map((r) => (
                <button
                  key={r.fullName}
                  type="button"
                  onClick={() => {
                    onChange(r.fullName, r.defaultBranch);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/70 ${
                    r.fullName === value ? 'bg-muted/50' : ''
                  }`}
                >
                  {r.private ? (
                    <Lock className="w-3.5 h-3.5 shrink-0 text-primary" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">{r.fullName}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground truncate">{r.description}</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(r.pushedAt)}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
