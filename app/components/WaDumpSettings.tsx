'use client';

import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { MessageCircle, Check, Copy, RefreshCw, Trash2 } from 'lucide-react';

interface WaDumpStatus {
  enabled: boolean;
  linked: boolean;
  dumpJid: string | null;
  mentioNumber: string | null;
}

function formatPhone(jid: string | null): string | null {
  if (!jid) return null;
  const m = jid.match(/^(\d+)@/);
  return m ? `+${m[1]}` : jid;
}

export function WaDumpSettings({ waDumpEnabled: initial, myJid: _myJid, dumpTaskEmoji: initialEmoji }: { waDumpEnabled: boolean; myJid: string | null; dumpTaskEmoji?: string | null }) {
  const [status, setStatus] = useState<WaDumpStatus | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [mentioNumber, setMentioNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emoji, setEmoji] = useState(initialEmoji ?? '✅');
  const [emojiSaving, setEmojiSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/integrations/wa-dump');
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const generateCode = async () => {
    setLoading(true);
    const res = await fetch('/api/integrations/wa-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_code' }),
    });
    if (res.ok) {
      const data = await res.json();
      setCode(data.code);
      setMentioNumber(data.mentioNumber);
    }
    setLoading(false);
  };

  const toggle = async () => {
    setLoading(true);
    const res = await fetch('/api/integrations/wa-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' }),
    });
    if (res.ok) {
      const data = await res.json();
      setStatus((prev) => prev ? { ...prev, enabled: data.enabled } : prev);
    }
    setLoading(false);
  };

  const disconnect = async () => {
    setLoading(true);
    const res = await fetch('/api/integrations/wa-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    });
    if (res.ok) {
      setStatus((prev) => prev ? { ...prev, linked: false, dumpJid: null, enabled: false } : prev);
      setCode(null);
      setConfirmOpen(false);
    }
    setLoading(false);
  };

  const saveEmoji = async () => {
    setEmojiSaving(true);
    await fetch('/api/integrations/wa-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_emoji', emoji }),
    });
    setEmojiSaving(false);
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const numberDisplay = formatPhone(status?.dumpJid ?? null);
  const mentioDisplay = mentioNumber ?? status?.mentioNumber;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium">WhatsApp Dump Notes</p>
            <p className="text-xs text-muted-foreground">Kirim pesan ke nomor Mentio → otomatis jadi note di Brain</p>
          </div>
        </div>
        {status?.linked && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3" /> Terhubung
          </span>
        )}
      </div>

      {status?.linked ? (
        <div className="space-y-3">
          {/* Info */}
          <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 space-y-1.5 text-sm">
            {numberDisplay && (
              <div className="flex justify-between text-muted-foreground">
                <span>Nomor terhubung</span>
                <code className="font-mono text-xs text-foreground">{numberDisplay}</code>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Pesan dari nomor di atas → masuk ke Brain Inbox otomatis.
              Prefix <code className="font-mono">!todo</code> → langsung jadi task.
            </p>
          </div>

          {/* Notif toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Aktifkan notifikasi</p>
              <p className="text-xs text-muted-foreground">Terima notif saat pesan dump masuk</p>
            </div>
            <Switch checked={status.enabled} onCheckedChange={toggle} disabled={loading} />
          </div>

          {/* Emoji reaction */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Emoji reaksi ke task</p>
              <p className="text-xs text-muted-foreground">React ke pesan dump dengan emoji ini untuk buat task</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                className="w-12 h-9 text-center text-lg bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" variant="outline" className="h-9" onClick={saveEmoji} disabled={emojiSaving}>
                {emojiSaving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={loading}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Putuskan
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
            <p className="font-medium text-foreground/80">Cara menghubungkan:</p>
            <ol className="space-y-1 ml-3 list-decimal">
              <li>Klik tombol di bawah untuk mendapatkan kode</li>
              <li>
                Kirim kode ke{' '}
                {mentioDisplay
                  ? <><code className="font-mono text-foreground/70">+{mentioDisplay}</code> via WhatsApp</>
                  : 'nomor Mentio via WhatsApp'}
              </li>
              <li>Nomor kamu akan terhubung otomatis</li>
            </ol>
          </div>

          {code ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-center text-sm font-mono font-semibold tracking-widest bg-muted/40 border border-border rounded-lg px-3 py-2">
                  {code}
                </code>
                <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={copyCode}>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Disalin' : 'Salin'}
                </Button>
              </div>
              {mentioDisplay && (
                <p className="text-[11px] text-muted-foreground/50 text-center">
                  Kirim kode ini ke <code className="font-mono">+{mentioDisplay}</code> via WA
                </p>
              )}
              <button
                onClick={generateCode}
                disabled={loading}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Generate ulang
              </button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={generateCode} disabled={loading} className="gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              {loading ? 'Loading…' : 'Generate Kode'}
            </Button>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Putuskan WhatsApp Dump?</DialogTitle>
            <DialogDescription>
              Nomor kamu akan dilepas. Note yang sudah tersimpan tidak akan dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" size="sm" onClick={disconnect} disabled={loading}>
              Putuskan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
