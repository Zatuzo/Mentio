'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { CheckCircle2, TrendingUp, Clock, MessageSquare, Loader2, AlertCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MemberStat {
  userId: string;
  name: string;
  image: string | null;
  todo: number;
  in_progress: number;
  done: number;
  completedInRange: number;
  completionRate: number;
  avgCycleTime: number | null;
}

interface AnalyticsData {
  overview: {
    completedInRange: number;
    completionRate: number;
    avgCycleTime: number | null;
    mentionCount: number;
  };
  dailyVolume: { date: string; created: number; completed: number }[];
  byGroup: { id: string; name: string; todo: number; in_progress: number; done: number }[];
  byPriority: { priority: string; todo: number; in_progress: number; done: number }[];
  openTasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    createdAt: string;
    group: { id: string; name: string } | null;
    ageDays: number;
  }[];
  byMember: MemberStat[];
  mentionsByCategory: { category: string; count: number }[];
  groups: { id: string; name: string }[];
  range: number;
  scope: string;
}

// Monochromatic palette, consistent with app's black/white/gray identity
const FG_PRIMARY = 'oklch(0.97 0 0)';   // near-white: done / completed
const FG_MID     = 'oklch(0.45 0 0)';   // mid gray: in_progress / created
const FG_DIM     = 'oklch(0.22 0 0)';   // dark gray: todo

const volumeChartConfig = {
  created:   { label: 'Dibuat',  color: FG_MID     },
  completed: { label: 'Selesai', color: FG_PRIMARY },
} satisfies ChartConfig;

const statusChartConfig = {
  todo:        { label: 'To Do',       color: FG_DIM     },
  in_progress: { label: 'In Progress', color: FG_MID     },
  done:        { label: 'Done',        color: FG_PRIMARY },
} satisfies ChartConfig;

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low', none: 'None',
};

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', done: 'Done',
};

function formatDate(iso: string, range: number): string {
  const d = new Date(iso);
  if (range <= 7) return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-md border transition-colors ${
        active
          ? 'bg-foreground text-background border-foreground'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
      }`}
    >
      {children}
    </button>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="bg-card/60 border-border/60">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold mt-2 tracking-tight tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{sub}</p>}
          </div>
          <div className="shrink-0 p-2.5 rounded-lg bg-muted/50">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonalView({ data, range }: { data: AnalyticsData; range: number }) {
  const { overview, dailyVolume, byGroup, byPriority, openTasks, mentionsByCategory } = data;

  const formattedVolume = dailyVolume.map((d) => ({ ...d, label: formatDate(d.date, range) }));
  const formattedGroups = byGroup.map((g) => ({
    ...g,
    label: g.name.length > 18 ? g.name.slice(0, 16) + '…' : g.name,
  }));
  const formattedPriority = byPriority
    .filter((p) => p.todo + p.in_progress + p.done > 0)
    .map((p) => ({ ...p, label: PRIORITY_LABELS[p.priority] }));

  return (
    <div className="space-y-4">
      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewCard
          icon={CheckCircle2}
          label={`Selesai ${range} hari`}
          value={overview.completedInRange}
          sub="tasks diselesaikan"
        />
        <OverviewCard
          icon={TrendingUp}
          label="Completion Rate"
          value={`${overview.completionRate}%`}
          sub="dari total tasks saya"
        />
        <OverviewCard
          icon={Clock}
          label="Avg. Cycle Time"
          value={overview.avgCycleTime !== null ? `${overview.avgCycleTime} hari` : '-'}
          sub="rata-rata buat ke selesai"
        />
        <OverviewCard
          icon={MessageSquare}
          label={`Mention ${range} hari`}
          value={overview.mentionCount}
          sub="pesan masuk ke grup"
        />
      </div>

      {/* Daily volume chart */}
      <Card className="bg-card/60 border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Volume Tasks Harian</CardTitle>
          <CardDescription className="text-xs">Tasks dibuat vs diselesaikan per hari</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={volumeChartConfig} className="h-[220px] w-full">
            <BarChart data={formattedVolume} barGap={3} barCategoryGap="35%">
              <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 6%)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }}
                interval={range === 30 ? 4 : 0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }}
                width={20}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'oklch(1 0 0 / 4%)' }} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="created"   fill="var(--color-created)"   radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="completed" fill="var(--color-completed)" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Group breakdown + Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="bg-card/60 border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tasks per Group</CardTitle>
            <CardDescription className="text-xs">Distribusi status per WA group</CardDescription>
          </CardHeader>
          <CardContent>
            {formattedGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada data group</p>
            ) : (
              <ChartContainer config={statusChartConfig} className="h-[220px] w-full">
                <BarChart data={formattedGroups} layout="vertical" barGap={2} barCategoryGap="30%">
                  <CartesianGrid horizontal={false} stroke="oklch(1 0 0 / 6%)" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }} allowDecimals={false} />
                  <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }} width={88} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'oklch(1 0 0 / 4%)' }} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="todo"        fill="var(--color-todo)"        stackId="a" maxBarSize={18} />
                  <Bar dataKey="in_progress" fill="var(--color-in_progress)" stackId="a" maxBarSize={18} />
                  <Bar dataKey="done"        fill="var(--color-done)"        stackId="a" radius={[0, 3, 3, 0]} maxBarSize={18} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribusi Prioritas</CardTitle>
            <CardDescription className="text-xs">Tasks per level prioritas</CardDescription>
          </CardHeader>
          <CardContent>
            {formattedPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
            ) : (
              <ChartContainer config={statusChartConfig} className="h-[220px] w-full">
                <BarChart data={formattedPriority} layout="vertical" barGap={2} barCategoryGap="30%">
                  <CartesianGrid horizontal={false} stroke="oklch(1 0 0 / 6%)" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }} allowDecimals={false} />
                  <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }} width={55} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'oklch(1 0 0 / 4%)' }} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="todo"        fill="var(--color-todo)"        stackId="a" maxBarSize={18} />
                  <Bar dataKey="in_progress" fill="var(--color-in_progress)" stackId="a" maxBarSize={18} />
                  <Bar dataKey="done"        fill="var(--color-done)"        stackId="a" radius={[0, 3, 3, 0]} maxBarSize={18} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mentions by watsonx category — omitted entirely if the integration isn't configured */}
      {mentionsByCategory.length > 0 && (
        <Card className="bg-card/60 border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Mention berdasarkan Kategori</CardTitle>
            <CardDescription className="text-xs">Klasifikasi otomatis dari IBM watsonx.ai</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {mentionsByCategory.map((c) => (
                <Badge key={c.category} variant="outline" className="text-xs font-normal capitalize">
                  {c.category}: {c.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Oldest open tasks */}
      <Card className="bg-card/60 border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tasks Terlama Belum Selesai</CardTitle>
          <CardDescription className="text-xs">Top 10 open tasks diurutkan dari paling lama dibuat</CardDescription>
        </CardHeader>
        <CardContent>
          {openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Semua tasks sudah selesai!</p>
          ) : (
            <div className="space-y-0 border border-border/60 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 bg-muted/20 border-b border-border/60">
                <span className="text-xs text-muted-foreground">Task</span>
                <span className="text-xs text-muted-foreground w-20 text-center">Status</span>
                <span className="text-xs text-muted-foreground w-16 text-right">Usia</span>
                <span className="text-xs text-muted-foreground w-16 text-right">Due</span>
              </div>
              {openTasks.map((t) => {
                const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                return (
                  <div key={t.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2.5 border-b last:border-0 border-border/40 hover:bg-muted/20 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{t.title}</p>
                      {t.group && <p className="text-xs text-muted-foreground truncate">{t.group.name}</p>}
                    </div>
                    <div className="flex items-center w-20 justify-center">
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                        {STATUS_LABEL[t.status]}
                      </Badge>
                    </div>
                    <span className={`text-xs w-16 text-right self-center ${t.ageDays >= 7 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                      {t.ageDays}h lalu
                    </span>
                    <span className={`text-xs w-16 text-right self-center ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamView({ data, range }: { data: AnalyticsData; range: number }) {
  const { byMember } = data;

  if (byMember.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Users className="h-5 w-5" />
        <span className="text-sm">Belum ada member di project ini</span>
      </div>
    );
  }

  const totalDone = byMember.reduce((s, m) => s + m.done, 0);
  const totalInProgress = byMember.reduce((s, m) => s + m.in_progress, 0);
  const totalTodo = byMember.reduce((s, m) => s + m.todo, 0);
  const totalInRange = byMember.reduce((s, m) => s + m.completedInRange, 0);
  const avgRate = byMember.length > 0
    ? Math.round(byMember.reduce((s, m) => s + m.completionRate, 0) / byMember.length)
    : 0;
  const topPerformer = byMember[0]; // sorted by completedInRange desc

  const chartData = byMember.map((m) => ({
    label: m.name.length > 16 ? m.name.slice(0, 14) + '…' : m.name,
    todo: m.todo,
    in_progress: m.in_progress,
    done: m.done,
  }));

  const chartHeight = Math.max(200, byMember.length * 52);

  return (
    <div className="space-y-4">
      {/* Team overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewCard
          icon={Users}
          label="Total Member"
          value={byMember.length}
          sub="pengguna aktif di project"
        />
        <OverviewCard
          icon={CheckCircle2}
          label={`Selesai Tim ${range} hari`}
          value={totalInRange}
          sub={`dari ${totalDone} total done`}
        />
        <OverviewCard
          icon={TrendingUp}
          label="Avg Completion Rate"
          value={`${avgRate}%`}
          sub="rata-rata seluruh member"
        />
        <OverviewCard
          icon={Clock}
          label="Top Performer"
          value={topPerformer.completedInRange}
          sub={`selesai oleh ${topPerformer.name.split(' ')[0]}`}
        />
      </div>

      {/* Member comparison chart */}
      <Card className="bg-card/60 border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Perbandingan Member</CardTitle>
          <CardDescription className="text-xs">Distribusi status tasks per anggota tim</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={statusChartConfig} style={{ height: chartHeight }} className="w-full">
            <BarChart data={chartData} layout="vertical" barGap={2} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke="oklch(1 0 0 / 6%)" />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }} allowDecimals={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'oklch(0.70 0 0)' }}
                width={110}
              />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'oklch(1 0 0 / 4%)' }} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="todo"        fill="var(--color-todo)"        stackId="a" maxBarSize={20} />
              <Bar dataKey="in_progress" fill="var(--color-in_progress)" stackId="a" maxBarSize={20} />
              <Bar dataKey="done"        fill="var(--color-done)"        stackId="a" radius={[0, 3, 3, 0]} maxBarSize={20} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Member stats table */}
      <Card className="bg-card/60 border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Statistik Per Member</CardTitle>
          <CardDescription className="text-xs">Diurutkan berdasarkan tasks selesai dalam periode ini</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border/60 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-3 py-2 bg-muted/20 border-b border-border/60">
              <span className="text-xs text-muted-foreground w-5">#</span>
              <span className="text-xs text-muted-foreground">Member</span>
              <span className="text-xs text-muted-foreground w-20 text-center">Status</span>
              <span className="text-xs text-muted-foreground w-16 text-right">Selesai</span>
              <span className="text-xs text-muted-foreground w-14 text-right">Rate</span>
              <span className="text-xs text-muted-foreground w-16 text-right">Cycle</span>
            </div>
            {byMember.map((m, idx) => (
              <div
                key={m.userId}
                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-3 py-2.5 border-b last:border-0 border-border/40 hover:bg-muted/20 transition-colors items-center"
              >
                <span className="text-xs text-muted-foreground w-5 tabular-nums">{idx + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {m.done}d · {m.in_progress}p · {m.todo}t
                  </p>
                </div>
                <div className="flex items-center gap-1 w-20 justify-center">
                  <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-muted/40">
                    {m.done + m.in_progress + m.todo > 0 && (
                      <>
                        <div
                          style={{ width: `${Math.round((m.done / (m.done + m.in_progress + m.todo)) * 100)}%` }}
                          className="h-full bg-foreground"
                        />
                        <div
                          style={{ width: `${Math.round((m.in_progress / (m.done + m.in_progress + m.todo)) * 100)}%` }}
                          className="h-full bg-muted-foreground"
                        />
                      </>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums w-16 text-right">
                  {m.completedInRange}
                  <span className="text-xs text-muted-foreground font-normal"> /{range}d</span>
                </span>
                <span className="text-xs tabular-nums w-14 text-right text-muted-foreground">
                  {m.completionRate}%
                </span>
                <span className="text-xs tabular-nums w-16 text-right text-muted-foreground">
                  {m.avgCycleTime !== null ? `${m.avgCycleTime}h` : '-'}
                </span>
              </div>
            ))}
            {/* Footer totals */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-3 py-2 bg-muted/10 border-t border-border/60 items-center">
              <span className="w-5" />
              <span className="text-xs text-muted-foreground font-medium">Total tim</span>
              <div className="w-20" />
              <span className="text-sm font-bold tabular-nums w-16 text-right">
                {totalInRange}
                <span className="text-xs text-muted-foreground font-normal"> /{range}d</span>
              </span>
              <span className="text-xs tabular-nums w-14 text-right text-muted-foreground">{avgRate}%</span>
              <span className="w-16" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            d = done · p = in progress · t = todo · cycle = avg hari buat→selesai
          </p>
        </CardContent>
      </Card>

      {/* Aggregate task counts (small info row) */}
      <div className="flex gap-6 px-1">
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">{totalDone}</p>
          <p className="text-xs text-muted-foreground">Done</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums text-muted-foreground">{totalInProgress}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums" style={{ color: FG_DIM }}>{totalTodo}</p>
          <p className="text-xs text-muted-foreground">To Do</p>
        </div>
      </div>
    </div>
  );
}

function downloadOpenTasksCsv(openTasks: AnalyticsData['openTasks']) {
  const header = ['Title', 'Status', 'Priority', 'Group', 'Age (days)', 'Due date'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = openTasks.map((t) => [
    t.title,
    t.status,
    t.priority,
    t.group?.name ?? '',
    String(t.ageDays),
    t.dueDate ?? '',
  ]);

  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `open-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsDashboard({ projectId }: { projectId: string }) {
  const [range, setRange] = useState<7 | 30>(7);
  const [scope, setScope] = useState<'personal' | 'team'>('personal');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // First load: show full spinner. Subsequent: keep old content, dim it.
    if (!data) setInitialLoading(true);
    else setFetching(true);
    setError(null);

    const params = new URLSearchParams({ projectId, range: String(range), scope });
    if (scope === 'personal' && selectedGroupId) params.set('groupId', selectedGroupId);

    fetch(`/api/analytics?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => {
        setInitialLoading(false);
        setFetching(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, range, scope, selectedGroupId]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error ?? 'No data'}</span>
      </div>
    );
  }

  return (
    <div className={`space-y-5 transition-opacity duration-150 ${fetching ? 'opacity-50' : 'opacity-100'}`}>
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Scope toggle */}
        <div className="flex items-center gap-1">
          <FilterPill active={scope === 'personal'} onClick={() => setScope('personal')}>
            Saya
          </FilterPill>
          <FilterPill active={scope === 'team'} onClick={() => setScope('team')}>
            Tim
          </FilterPill>
        </div>

        <div className="w-px h-4 bg-border/60 hidden sm:block" />

        {/* Period filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-0.5">Periode:</span>
          {([7, 30] as const).map((r) => (
            <FilterPill key={r} active={range === r} onClick={() => setRange(r)}>
              {r} hari
            </FilterPill>
          ))}
        </div>

        {fetching && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50 ml-auto" />
        )}
      </div>

      {/* Group filter (personal scope, multiple groups available) */}
      {scope === 'personal' && data.groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-0.5">Group:</span>
          <FilterPill active={selectedGroupId === null} onClick={() => setSelectedGroupId(null)}>
            Semua
          </FilterPill>
          {data.groups.map((g) => (
            <FilterPill
              key={g.id}
              active={selectedGroupId === g.id}
              onClick={() => setSelectedGroupId(g.id)}
            >
              {g.name.length > 22 ? g.name.slice(0, 20) + '…' : g.name}
            </FilterPill>
          ))}
        </div>
      )}

      {/* Tab content */}
      {scope === 'personal' ? (
        <PersonalView data={data} range={range} />
      ) : (
        <TeamView data={data} range={range} />
      )}
    </div>
  );
}
