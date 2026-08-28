'use client';

import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Send, Check, X, RefreshCw, Copy, ExternalLink, FlaskConical, Trash2 } from 'lucide-react';

interface TelegramStatus {
  connected: boolean;
  enabled: boolean;
  chatId: string | null;
  botConfigured: boolean;
  botUsername: string | null;
}

export function TelegramSettings() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null); // seconds remaining
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'ok' | 'error'>>({});

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/integrations/telegram');
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Countdown timer for code expiry
  useEffect(() => {
    if (!codeExpiry) return;
    const id = setInterval(() => {
      setCodeExpiry((prev) => {
        if (!prev || prev <= 1) { setCode(null); return null; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [codeExpiry]);

  const generateCode = async () => {
    setActionLoading(true);
    const res = await fetch('/api/integrations/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_code' }),
    });
    if (res.ok) {
      const { code: newCode } = await res.json();
      setCode(newCode);
      setCodeExpiry(15 * 60); // 15 minutes
    }
    setActionLoading(false);
  };

  const disconnect = async () => {
    setActionLoading(true);
    await fetch('/api/integrations/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    });
    setCode(null);
    setCodeExpiry(null);
    await fetchStatus();
    setActionLoading(false);
  };

  const toggle = async () => {
    setActionLoading(true);
    const res = await fetch('/api/integrations/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' }),
    });
    if (res.ok) {
      const { enabled } = await res.json();
      setStatus((prev) => prev ? { ...prev, enabled } : prev);
    }
    setActionLoading(false);
  };

  const setupWebhook = async () => {
    setActionLoading(true);
    setWebhookResult(null);
    const res = await fetch('/api/integrations/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setup_webhook' }),
    });
    const data = await res.json();
    setWebhookResult(data.ok ? '✅ Webhook berhasil diset!' : `❌ ${data.description ?? 'Gagal'}`);
    setActionLoading(false);
  };

  const sendTest = async (type: string) => {
    setTestLoading(type);
    try {
      const res = await fetch('/api/integrations/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', type }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [type]: data.ok ? 'ok' : 'error' }));
    } catch {
      setTestResults((prev) => ({ ...prev, [type]: 'error' }));
    } finally {
      setTestLoading(null);
      setTimeout(() => setTestResults((prev) => { const n = { ...prev }; delete n[type]; return n; }), 3000);
    }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(`/connect ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 shrink-0">
            <Send className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <p className="font-medium text-sm">Telegram</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reminder task & notifikasi digest
            </p>
          </div>
        </div>

        {status?.connected && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3" /> Terhubung
          </span>
        )}
      </div>

      {!status?.botConfigured && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400/90 leading-relaxed">
          <strong>TELEGRAM_BOT_TOKEN</strong> belum dikonfigurasi. Tambahkan ke file .env terlebih dahulu.
        </div>
      )}

      {status?.botConfigured && !status.connected && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
            <p className="font-medium text-foreground/80">Cara menghubungkan:</p>
            <p>1. Klik tombol di bawah untuk mendapatkan kode</p>
            <p>
              2. Buka{' '}
              {status.botUsername ? (
                <a
                  href={`https://t.me/${status.botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
                >
                  @{status.botUsername} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                'bot Telegram kamu'
              )}{' '}
              dan kirim perintah yang muncul
            </p>
          </div>

          {!code ? (
            <button
              onClick={generateCode}
              disabled={actionLoading || !status.botConfigured}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Generate Kode
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 font-mono text-sm border border-border">
                  <code className="flex-1">/connect {code}</code>
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
                    {Math.floor((codeExpiry ?? 0) / 60)}:{String((codeExpiry ?? 0) % 60).padStart(2, '0')}
                  </span>
                </div>
                <button
                  onClick={copyCode}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/60">
                Salin dan kirim perintah di atas ke bot Telegram. Kode kadaluarsa dalam 15 menit.
              </p>
              <button onClick={generateCode} disabled={actionLoading} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Generate ulang
              </button>
            </div>
          )}
        </div>
      )}

      {status?.connected && (
        <div className="space-y-3">
          {/* Notification toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Aktifkan notifikasi</p>
              <p className="text-[11px] text-muted-foreground/60">Reminder task, digest harian, weekly review</p>
            </div>
            <Switch checked={status.enabled} onCheckedChange={toggle} disabled={actionLoading} />
          </div>

          {/* Test notifications */}
          <div className="border-t border-border/50 pt-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FlaskConical className="w-3.5 h-3.5" />
              Test pesan
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { type: 'task_created', label: '/task — Buat task' },
                { type: 'note_saved',   label: '/note — Simpan catatan' },
                { type: 'todo',         label: '/todo — List task' },
                { type: 'briefing',     label: '/briefing — Briefing pagi' },
                { type: 'task_reminder',label: 'Reminder deadline' },
                { type: 'digest',       label: 'Notif digest siap' },
              ].map(({ type, label }) => {
                const result = testResults[type];
                const isLoading = testLoading === type;
                return (
                  <button
                    key={type}
                    onClick={() => sendTest(type)}
                    disabled={!!testLoading || actionLoading}
                    className={`flex items-center justify-between gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] transition-colors disabled:opacity-50 ${
                      result === 'ok'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : result === 'error'
                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : 'border-border bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isLoading ? (
                      <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                    ) : result === 'ok' ? (
                      <Check className="w-3 h-3 shrink-0" />
                    ) : result === 'error' ? (
                      <X className="w-3 h-3 shrink-0" />
                    ) : (
                      <Send className="w-3 h-3 shrink-0 opacity-40" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground/40">Klik untuk kirim contoh pesan ke Telegram kamu</p>
          </div>

          {/* Chat ID + Disconnect */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-muted-foreground/50">
              Chat ID: <code className="font-mono">{status.chatId}</code>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={disconnect}
              disabled={actionLoading}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Putuskan
            </Button>
          </div>
        </div>
      )}

      {/* Webhook setup (admin/dev section) */}
      {status?.botConfigured && (
        <div className="border-t border-border/50 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground/50">
              {webhookResult ?? 'Set webhook supaya bot bisa menerima pesan'}
            </p>
            <button
              onClick={setupWebhook}
              disabled={actionLoading}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Set Webhook
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
