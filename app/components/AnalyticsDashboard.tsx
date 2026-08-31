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
