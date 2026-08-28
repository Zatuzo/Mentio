'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Status = 'disconnected' | 'connecting' | 'qr' | 'open' | 'closed';

interface Props {
  initialMode: string;
  botPhone: string; // e.g. "62812xxx"
}

export function WaConnect({ initialMode, botPhone }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [status, setStatus] = useState<Status>('disconnected');
  const [qr, setQr] = useState<string | null>(null);
  const [jid, setJid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (mode !== 'own') return;
    const res = await fetch('/api/wa').catch(() => null);
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 503) toast.error(data.error);
      return;
    }
    setStatus(data.status);
    setQr(data.qr);
    setJid(data.jid);
  }, [mode]);

  useEffect(() => {
    fetchStatus();
    if (mode !== 'own') return;
    // Poll while connecting or showing QR
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [mode, fetchStatus]);

  async function switchMode(newMode: string) {
    setLoading(true);
    const res = await fetch('/api/wa/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode }),
    });
    if (res.ok) {
      setMode(newMode);
      if (newMode === 'own') fetchStatus();
    } else {
      toast.error('Failed to switch mode');
    }
    setLoading(false);
  }

  async function handleConnect() {
    setLoading(true);
    const res = await fetch('/api/wa', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setStatus('connecting');
      toast.info('Generating QR code…');
    } else {
      toast.error(data.error || 'Failed to start session');
    }
    setLoading(false);
  }

  async function handleDisconnect() {
    setLoading(true);
    const res = await fetch('/api/wa', { method: 'DELETE' });
    if (res.ok) {
      setStatus('disconnected');
      setQr(null);
      setJid(null);
      setMode('shared');
      toast.success('Disconnected');
    }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div className="flex gap-3">
        <button
          onClick={() => mode !== 'shared' && switchMode('shared')}
          disabled={loading}
          className={`flex-1 rounded-lg border p-4 text-left transition-colors ${
            mode === 'shared'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border hover:border-border text-muted-foreground'
          }`}
        >
          <div className="font-medium mb-1">Shared Bot</div>
          <div className="text-xs">
            Invite nomor Mentio ke grup kamu. Paling mudah, tidak perlu scan QR.
          </div>
        </button>

        <button
          onClick={() => mode !== 'own' && switchMode('own')}
          disabled={loading}
          className={`flex-1 rounded-lg border p-4 text-left transition-colors ${
            mode === 'own'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border hover:border-border text-muted-foreground'
          }`}
        >
          <div className="font-medium mb-1">Nomor Sendiri</div>
          <div className="text-xs">
            Scan QR dengan nomor WA kamu. Semua grup kamu langsung terpantau.
          </div>
        </button>
      </div>

      {/* Shared mode instructions */}
      {mode === 'shared' && (
        <div className="rounded-lg border border-border bg-card/40 p-5 space-y-3">
          <p className="text-sm font-medium">Cara setup:</p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>
              Invite nomor Mentio ke grup WA kamu:{' '}
              <button
                onClick={() => { navigator.clipboard.writeText(`+${botPhone}`); toast.success('Copied!'); }}
                className="font-mono text-foreground hover:underline underline-offset-2"
              >
                +{botPhone}
              </button>
            </li>
            <li>Tambahkan JID kamu di bagian <strong>Numbers to Watch</strong> di bawah</li>
            <li>Setiap kali ada yang tag nomor kamu, Mentio akan menangkapnya</li>
          </ol>
        </div>
      )}

      {/* Own mode: QR / connected */}
      {mode === 'own' && (
        <div className="rounded-lg border border-border bg-card/40 p-5">
          {status === 'open' && jid ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-emerald-400">Connected</div>
                <div className="text-xs text-muted-foreground mt-0.5">{jid}</div>
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
                Disconnect
              </Button>
            </div>
          ) : status === 'qr' && qr ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Scan QR ini dengan WhatsApp di ponsel kamu:
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Code" className="w-48 h-48 rounded-lg bg-white p-2" />
              <p className="text-xs text-muted-foreground">QR kedaluwarsa dalam ~60 detik. Refresh otomatis.</p>
            </div>
          ) : status === 'connecting' ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-foreground/40 border-t-foreground rounded-full animate-spin" />
              Menghubungkan…
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Belum terhubung.</p>
              <Button size="sm" onClick={handleConnect} disabled={loading}>
                Connect &amp; Scan QR
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
