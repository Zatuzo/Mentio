'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Search, FileText, MessageSquare, AlignLeft, CheckSquare, Loader2, Sparkles } from 'lucide-react';
import type { SearchResultItem } from '@/app/api/search/route';
import type { SemanticResult } from '@/app/lib/embeddings';

const TYPE_CONFIG = {
  note:    { label: 'Note',    icon: FileText,      color: 'bg-sky-500/10 text-sky-400/80',        textColor: 'text-sky-400/70'      },
  mention: { label: 'Mention', icon: MessageSquare, color: 'bg-emerald-500/10 text-emerald-400/80', textColor: 'text-emerald-400/70'  },
  summary: { label: 'Summary', icon: AlignLeft,     color: 'bg-violet-500/10 text-violet-400/80',  textColor: 'text-violet-400/70'   },
  task:    { label: 'Task',    icon: CheckSquare,   color: 'bg-amber-500/10 text-amber-400/80',     textColor: 'text-amber-400/70'    },
} as const;

const TYPE_FILTERS = ['all', 'note', 'mention', 'summary', 'task'] as const;

interface Props { initialQuery: string }

export function BrainSearchClient({ initialQuery }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<'keyword' | 'semantic'>('keyword');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); setSemanticResults([]); setSearched(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSemanticError(null);
      try {
        if (mode === 'semantic') {
          const res = await fetch(`/api/search/semantic?q=${encodeURIComponent(query)}&limit=10`);
          const data = await res.json();
          if (!res.ok) {
            setSemanticError(data.error ?? 'Search failed');
          } else {
            setSemanticResults(Array.isArray(data) ? data : []);
          }
        } else {
          const types = typeFilter === 'all' ? '' : `&types=${typeFilter}`;
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${types}`);
          const data: SearchResultItem[] = await res.json();
          setResults(data);
        }
        setSearched(true);
        router.replace(`/brain/search?q=${encodeURIComponent(query)}`, { scroll: false });
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, typeFilter, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialQuery.length >= 2) setQuery(initialQuery);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = typeFilter === 'all' ? results : results.filter((r) => r.type === typeFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/brain"
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, mentions, tasks, summaries…"
            className="pl-9 h-10 bg-card border-white/10 focus:border-white/20"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 animate-spin" />
          )}
        </div>
      </div>

      {/* Mode toggle + Type filters */}
      <div className="flex items-center justify-between gap-3">
        {/* Mode toggle */}
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setMode('keyword')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'keyword' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Search className="w-3 h-3" />
            Keyword
          </button>
          <button
            onClick={() => setMode('semantic')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'semantic' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Semantic
          </button>
        </div>

        {/* Type filters (keyword mode only) */}
        {mode === 'keyword' && (
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize border ${
                  typeFilter === t
                    ? 'bg-white/10 text-foreground border-white/15'
                    : 'bg-transparent text-muted-foreground border-transparent hover:border-white/10 hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {mode === 'semantic' && (
          <p className="text-xs text-muted-foreground/50">Notes only · vector similarity</p>
        )}
      </div>

      {/* Semantic results */}
      {mode === 'semantic' && (
        <>
          {semanticError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {semanticError === 'Semantic search not configured (missing OPENAI_API_KEY)'
                ? 'Semantic search requires an OpenAI API key. Add OPENAI_API_KEY to your environment.'
                : semanticError}
            </div>
          )}

          {searched && !loading && !semanticError && semanticResults.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Sparkles className="w-7 h-7 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No matching notes found</p>
              <p className="text-xs mt-1 opacity-60">Try different keywords or switch to Keyword mode</p>
            </div>
          )}

          {semanticResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground/50 pl-0.5">
                {semanticResults.length} result{semanticResults.length !== 1 ? 's' : ''} · semantic match
              </p>
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {semanticResults.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    className="flex gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-400/80">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <span className="text-[11px] text-sky-400/60 shrink-0 tabular-nums">
                          {item.similarity}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">{item.snippet}</p>
                      <p className="text-[11px] text-muted-foreground/40 mt-1 tabular-nums">
                        {item.meta} · {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!searched && !loading && query.length < 2 && (
            <div className="text-center py-16 text-muted-foreground">
              <Sparkles className="w-7 h-7 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Type at least 2 characters to search semantically</p>
            </div>
          )}
        </>
      )}

      {/* Keyword results */}
      {mode === 'keyword' && (
        <>
          {searched && filtered.length === 0 && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-7 h-7 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground/50 pl-0.5">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                {typeFilter !== 'all' ? ` in ${typeFilter}s` : ''}
              </p>
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {filtered.map((item) => {
                  const cfg = TYPE_CONFIG[item.type];
                  const Icon = cfg.icon;
                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.url}
                      className="flex gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <span className={`text-[11px] shrink-0 ${cfg.textColor}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">{item.snippet}</p>
                        <p className="text-[11px] text-muted-foreground/40 mt-1 tabular-nums">
                          {item.meta} · {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {!searched && query.length < 2 && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-7 h-7 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
