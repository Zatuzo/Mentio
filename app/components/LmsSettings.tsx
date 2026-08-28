'use client';

import { useState } from 'react';
import { BookOpen, RefreshCw, Trash2, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  connection: {
    icalUrl: string;
    lastSyncAt: string | null;
    lastSyncCount: number | null;
  } | null;
}

export function LmsSettings({ connection: initial }: Props) {
  const [connection, setConnection] = useState(initial);
  const [icalUrl, setIcalUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConnect = async () => {
    if (!icalUrl.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/lms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ icalUrl: icalUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan');

      const updated = await fetch('/api/integrations/lms').then((r) => r.json());
      setConnection(updated);
      setIcalUrl('');
      toast.success(`✅ LMS terhubung! ${data.created} task baru diimport.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal terhubung');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/lms/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync gagal');
      const updated = await fetch('/api/integrations/lms').then((r) => r.json());
      setConnection(updated);
      if (data.created > 0) {
        toast.success(`${data.created} task baru diimport dari LMS`);
      } else {
        toast.success('Sync selesai — tidak ada task baru');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync gagal');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    await fetch('/api/integrations/lms', { method: 'DELETE' });
    setConnection(null);
    setConfirmOpen(false);
    toast.success('LMS diputuskan');
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-medium">LMS / Moodle</p>
            <p className="text-xs text-muted-foreground">Sync deadline tugas otomatis ke task Mentio</p>
          </div>
        </div>
        {connection && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3" /> Terhubung
          </span>
        )}
      </div>

      {connection ? (
        <div className="space-y-3">
          {/* Status */}
          <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sync terakhir</span>
              <span className="text-foreground">{fmtDate(connection.lastSyncAt)}</span>
            </div>
            {connection.lastSyncCount != null && (
              <div className="flex justify-between text-muted-foreground">
                <span>Task diimport terakhir</span>
                <span className="text-foreground">{connection.lastSyncCount} task</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Sync otomatis berjalan setiap 6 jam. Hanya deadline yang belum lewat 7 hari yang diimport.
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Sekarang'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Putuskan
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/20 border border-border px-4 py-3 space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Cara mendapatkan URL iCal:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Buka LMS kampus kamu</li>
              <li>Pergi ke <strong className="text-foreground">Calendar → Export calendar</strong></li>
              <li>Pilih <strong className="text-foreground">All events</strong> + <strong className="text-foreground">Recent and next 60 days</strong></li>
              <li>Klik <strong className="text-foreground">"Get calendar URL"</strong> lalu copy URL-nya</li>
            </ol>
            <a
              href="https://lms.telkomuniversity.ac.id/calendar/export.php"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
            >
              Buka halaman export <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="url"
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              placeholder="https://lms.../calendar/export_execute.php?..."
              className="flex-1 h-9 text-sm rounded-md border border-border bg-background px-3 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            />
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={!icalUrl.trim() || loading}
              className="shrink-0 h-9"
            >
              {loading ? 'Menghubungkan…' : 'Hubungkan'}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Putuskan koneksi LMS?</DialogTitle>
            <DialogDescription>
              Task yang sudah diimport tidak akan dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              Putuskan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
