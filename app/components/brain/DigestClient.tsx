'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, RefreshCw, Calendar, Check, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Digest {
  id: string;
  type: string;
  period: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

type Tab = 'daily' | 'weekly';

function formatDailyPeriod(period: string) {
  return new Date(period).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatWeeklyPeriod(period: string) {
  // period = "2026-W24"
  const [year, wPart] = period.split('-W');
  const week = parseInt(wPart, 10);
  // Find Monday of that ISO week
  const jan1 = new Date(parseInt(year), 0, 1);
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + (week - 1) * 7 - jan1.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sunday)} ${year}`;
}

function formatPeriod(period: string, type: string) {
  if (type === 'weekly') return formatWeeklyPeriod(period);
  return formatDailyPeriod(period);
}

function currentWeekPeriodClient(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function DigestContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="text-sm font-semibold text-foreground mt-5 first:mt-0 border-b border-border/50 pb-1">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-base font-bold text-foreground mt-6 first:mt-0">
              {line.slice(3)}
            </h2>
          );
        }
        // Bold-only line
        if (/^\*\*[^*]+\*\*:?$/.test(line.trim())) {
          return (
            <p key={i} className="font-semibold text-foreground/90 mt-3">
              {line.replace(/\*\*/g, '')}
            </p>
          );
        }
        const boldInline = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (line.match(/^(\d+)\. /)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          return (
            <div key={i} className="flex gap-2.5">
              <span className="text-muted-foreground shrink-0 w-4 text-right">{num}.</span>
              <span dangerouslySetInnerHTML={{ __html: boldInline.replace(/^\d+\. /, '') }} />
            </div>
          );
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: boldInline.slice(2) }} />
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: boldInline }} />;
      })}
    </div>
  );
}

export default function DigestClient() {
  const router = useRouter();
  const [allDigests, setAllDigests] = useState<Digest[]>([]);
  const [tab, setTab] = useState<Tab>('daily');
  const [selected, setSelected] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch('/api/brain/digests')
      .then((r) => r.json())
      .then((data) => {
        const list: Digest[] = data.digests ?? [];
        setAllDigests(list);
        // Auto-select first in current tab
        const first = list.find((d) => d.type === 'daily') ?? list[0] ?? null;
        setSelected(first);
      })
      .finally(() => setLoading(false));
  }, []);

  const digests = allDigests.filter((d) => d.type === tab);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/brain/digests/${id}/read`, { method: 'POST' });
    setAllDigests((prev) =>
      prev.map((d) => (d.id === id ? { ...d, readAt: new Date().toISOString() } : d)),
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, readAt: new Date().toISOString() } : prev));
  }, []);

  const selectDigest = useCallback(
    async (digest: Digest) => {
      setSelected(digest);
      if (!digest.readAt) markRead(digest.id);
    },
    [markRead],
  );

  const switchTab = (t: Tab) => {
    setTab(t);
    const first = allDigests.find((d) => d.type === t);
    if (first) setSelected(first);
    else setSelected(null);
  };

  const generate = useCallback(
    async (type: Tab) => {
      setGenerating(true);
      const res = await fetch(`/api/brain/digests?type=${type}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.digest) {
          setAllDigests((prev) => {
            const exists = prev.find((d) => d.id === data.digest.id);
            return exists ? prev : [data.digest, ...prev];
          });
          setSelected(data.digest);
          setTab(type);
        }
      }
      setGenerating(false);
    },
    [],
  );

  const todayPeriod = new Date().toISOString().slice(0, 10);
  const thisWeekPeriod = currentWeekPeriodClient();
  const hasTodayDigest = allDigests.some((d) => d.type === 'daily' && d.period === todayPeriod);
  const hasWeeklyDigest = allDigests.some((d) => d.type === 'weekly' && d.period === thisWeekPeriod);

  const canGenerate = tab === 'daily' ? !hasTodayDigest : !hasWeeklyDigest;
  const generateLabel =
    generating
      ? 'Membuat…'
      : tab === 'daily'
        ? hasTodayDigest
          ? 'Sudah ada hari ini'
          : 'Buat digest hari ini'
        : hasWeeklyDigest
          ? 'Sudah ada minggu ini'
          : 'Buat weekly review';

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => router.push('/brain')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Digest
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => switchTab('daily')}
            className={cn(
              'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
              tab === 'daily'
                ? 'text-foreground border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Calendar className="h-3 w-3" />
            Daily
          </button>
          <button
            onClick={() => switchTab('weekly')}
            className={cn(
              'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
              tab === 'weekly'
                ? 'text-foreground border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BarChart2 className="h-3 w-3" />
            Weekly
          </button>
        </div>

        {/* Generate button */}
        <div className="p-3">
          <Button
            className="w-full h-8 text-xs gap-1.5"
            onClick={() => generate(tab)}
            disabled={generating || !canGenerate}
          >
            {generating ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : tab === 'daily' ? (
              <Sparkles className="h-3 w-3" />
            ) : (
              <BarChart2 className="h-3 w-3" />
            )}
            {generateLabel}
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-xs text-muted-foreground text-center">Memuat…</div>
          )}
          {!loading && digests.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground text-center leading-relaxed">
              Belum ada {tab === 'daily' ? 'digest harian' : 'weekly review'}.<br />
              Klik tombol di atas untuk membuat.
            </div>
          )}
          {digests.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDigest(d)}
              className={cn(
                'w-full text-left px-4 py-3 text-sm border-b border-border/40 hover:bg-muted/50 transition-colors',
                selected?.id === d.id && 'bg-muted',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate">
                  {formatPeriod(d.period, d.type)}
                </span>
                {!d.readAt && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground/60 line-clamp-2">
                {d.content.replace(/[#*`]/g, '').trim().slice(0, 80)}…
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Content panel */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Pilih digest di sebelah kiri
          </div>
        ) : (
          <div className="max-w-2xl mx-auto p-8">
            <div className="flex items-start justify-between mb-6 gap-4">
              <div>
                <h1 className="text-xl font-semibold leading-tight">
                  {formatPeriod(selected.period, selected.type)}
                </h1>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  Dibuat{' '}
                  {new Date(selected.createdAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {selected.readAt && (
                    <span className="inline-flex items-center gap-0.5 text-emerald-500">
                      <Check className="h-3 w-3" /> Sudah dibaca
                    </span>
                  )}
                </p>
              </div>
              <span className={cn(
                'text-xs font-medium shrink-0',
                selected.type === 'weekly' ? 'text-violet-400' : 'text-sky-400',
              )}>
                {selected.type === 'weekly' ? 'Weekly' : 'Daily'}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <DigestContent content={selected.content} />
            </div>

            {!selected.readAt && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 text-xs text-muted-foreground"
                onClick={() => markRead(selected.id)}
              >
                <Check className="h-3 w-3 mr-1" />
                Tandai sudah dibaca
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
