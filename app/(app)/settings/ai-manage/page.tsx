import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import { Sparkles, Zap, BookOpen, Calendar, Mail, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

const FEATURES = [
  {
    id: 'auto-organize',
    icon: Zap,
    label: 'Auto-Organize',
    description: 'Auto-tag dan auto-title setiap note baru yang disimpan. Berjalan di background secara async.',
    status: 'active',
    badge: 'Active',
  },
  {
    id: 'context-surfacing',
    icon: Search,
    label: 'Semantic Search',
    description: 'Cari notes berdasarkan makna dengan DeepSeek LLM re-ranking (bukan vector similarity).',
    status: 'active',
    badge: 'Active',
  },
  {
    id: 'daily-digest',
    icon: Calendar,
    label: 'Daily Digest',
    description: 'Rangkuman harian otomatis setiap pagi. Termasuk mentions belum ditindaklanjuti dan tasks overdue.',
    status: 'coming-soon',
    badge: 'Coming soon',
  },
  {
    id: 'weekly-review',
    icon: BookOpen,
    label: 'Weekly Review',
    description: 'Laporan mingguan dengan pattern detection dan saran organisasi knowledge base.',
    status: 'coming-soon',
    badge: 'Coming soon',
  },
  {
    id: 'email-digest',
    icon: Mail,
    label: 'Email Digest',
    description: 'Kirim digest ke email agar kamu tidak perlu membuka app setiap pagi.',
    status: 'coming-soon',
    badge: 'Coming soon',
  },
];

const MODEL_INFO = [
  { model: 'DeepSeek V3 (default)', usage: 'Auto-tag, auto-title, AI chat umum', cost: '~Rp 6.100/bulan (moderate)' },
  { model: 'DeepSeek R1', usage: 'Weekly review, pattern detection (reasoning)', cost: '~Rp 28.500/bulan (moderate)' },
  { model: 'Claude Haiku 4.5', usage: 'Alternatif kualitas tertinggi untuk bahasa Indonesia', cost: '~Rp 56.100/bulan (moderate)' },
];

export default async function AiManagePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">AI Manage</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Lapisan kecerdasan di atas Second Brain. Mengorganisir, menganalisis, dan menyederhanakan pengetahuan kamu secara otomatis.
        </p>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 tracking-wide uppercase">Fitur</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.id} className="flex items-start gap-4 px-4 py-3.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                  f.status === 'active' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Icon className={`w-4 h-4 ${f.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{f.label}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      f.status === 'active'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {f.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model info */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 tracking-wide uppercase">Model yang digunakan</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {MODEL_INFO.map((m) => (
            <div key={m.model} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium">{m.model}</p>
                <span className="text-xs text-muted-foreground/60 tabular-nums shrink-0">{m.cost}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{m.usage}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Ganti model default dengan environment variable <code className="text-foreground/70 bg-muted px-1 rounded">DEEPSEEK_MODEL</code>.
        </p>
      </div>

      {/* Cost note */}
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3.5">
        <p className="text-sm font-medium mb-1">Estimasi biaya</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Untuk pengguna moderate (20 mentions + 5 notes + 3 chat sessions per hari),
          biaya AI Manage dengan DeepSeek V3 sekitar <span className="font-semibold text-foreground/80">Rp 6.100/bulan</span> —
          lebih murah dari secangkir kopi.
        </p>
      </div>
    </div>
  );
}
