'use client';

import { useState, useEffect } from 'react';
import { Bell, Loader2, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

type Settings = {
  dailyEnabled: boolean;
  dailyTime: string;
  timezone: string;
  periodicEnabled: boolean;
  periodicHours: number;
  deadlineEnabled: boolean;
  deadlineDays: string;
  overdueEnabled: boolean;
};

const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'UTC'];

const DEADLINE_PRESETS = [
  { label: 'H-1', value: '1' },
  { label: 'H-3', value: '3' },
  { label: 'H-7', value: '7' },
];

export function TodoNotifSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/notif-settings/todo').then(r => r.json()).then(setS);
  }, []);

  const save = async (patch: Partial<Settings>) => {
    if (!s) return;
    const next = { ...s, ...patch };
    setS(next);
    setSaving(true);
    const res = await fetch('/api/notif-settings/todo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) toast.error('Gagal menyimpan');
  };

  const toggleDeadlineDay = (day: string) => {
    if (!s) return;
    const current = s.deadlineDays.split(',').map(d => d.trim()).filter(Boolean);
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => Number(a) - Number(b));
    save({ deadlineDays: next.join(',') });
  };

  if (!s) return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center h-32">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  );

  const selectedDays = s.deadlineDays.split(',').map(d => d.trim()).filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
            <Bell className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-sm">Notifikasi To Do</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pengingat task personal via Telegram
            </p>
          </div>
        </div>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        {!saving && <Check className="w-3.5 h-3.5 text-emerald-400/60" />}
      </div>

      <div className="space-y-4 divide-y divide-border">

        {/* Daily summary */}
        <div className="flex items-start justify-between gap-4 pt-0">
          <div className="space-y-1">
            <p className="text-sm font-medium">Ringkasan harian</p>
            <p className="text-xs text-muted-foreground">Kirim daftar semua todo aktif setiap hari</p>
            {s.dailyEnabled && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="time"
                  value={s.dailyTime}
                  onChange={e => save({ dailyTime: e.target.value })}
                  className="text-xs bg-white/[0.04] border border-border rounded-md px-2 py-1 outline-none focus:border-white/20 tabular-nums"
                />
                <select
                  value={s.timezone}
                  onChange={e => save({ timezone: e.target.value })}
                  className="text-xs bg-white/[0.04] border border-border rounded-md px-2 py-1 outline-none focus:border-white/20"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            )}
          </div>
          <Switch checked={s.dailyEnabled} onCheckedChange={v => save({ dailyEnabled: v })} />
        </div>

        {/* Periodic */}
        <div className="flex items-start justify-between gap-4 pt-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Pengingat periodik</p>
            <p className="text-xs text-muted-foreground">Ingatkan semua todo aktif setiap N jam</p>
            {s.periodicEnabled && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Setiap</span>
                <input
                  type="number"
                  min={1} max={24}
                  value={s.periodicHours}
                  onChange={e => save({ periodicHours: Math.max(1, Math.min(24, Number(e.target.value))) })}
                  className="w-16 text-xs text-center bg-white/[0.04] border border-border rounded-md px-2 py-1 outline-none focus:border-white/20 tabular-nums"
                />
                <span className="text-xs text-muted-foreground">jam</span>
              </div>
            )}
          </div>
          <Switch checked={s.periodicEnabled} onCheckedChange={v => save({ periodicEnabled: v })} />
        </div>

        {/* Deadline reminders */}
        <div className="flex items-start justify-between gap-4 pt-4">
          <div className="space-y-1 flex-1">
            <p className="text-sm font-medium">Pengingat deadline</p>
            <p className="text-xs text-muted-foreground">Notifikasi sebelum task jatuh tempo</p>
            {s.deadlineEnabled && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {DEADLINE_PRESETS.map(({ label, value }) => {
                  const active = selectedDays.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => toggleDeadlineDay(value)}
                      className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                        active
                          ? 'bg-foreground text-background border-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {/* Custom day input */}
                <input
                  type="number"
                  min={1} max={30}
                  placeholder="H-?"
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v && !isNaN(Number(v))) { toggleDeadlineDay(v); e.target.value = ''; }
                  }}
                  className="w-16 text-xs text-center bg-white/[0.04] border border-border rounded-md px-2 py-1 outline-none focus:border-white/20 placeholder:text-muted-foreground/40"
                />
              </div>
            )}
          </div>
          <Switch checked={s.deadlineEnabled} onCheckedChange={v => save({ deadlineEnabled: v })} />
        </div>

        {/* Overdue */}
        <div className="flex items-start justify-between gap-4 pt-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Notifikasi terlambat</p>
            <p className="text-xs text-muted-foreground">Kirim sekali sehari jika ada task yang melewati deadline</p>
          </div>
          <Switch checked={s.overdueEnabled} onCheckedChange={v => save({ overdueEnabled: v })} />
        </div>

      </div>
    </div>
  );
}
