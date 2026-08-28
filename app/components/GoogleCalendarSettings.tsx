'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { CalendarDays, RefreshCw, UploadCloud, Check, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  connected: boolean;
  syncEnabled: boolean;
  calendarId: string | null;
  connectedAt: string | null;
}

export function GoogleCalendarSettings({ connected, syncEnabled, calendarId, connectedAt }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(syncEnabled);
  const [isSyncing, setIsSyncing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const gcalParam = searchParams.get('gcal');
  if (gcalParam === 'connected') toast.success('Google Calendar terhubung!');
  if (gcalParam === 'error') toast.error('Gagal menghubungkan Google Calendar. Coba lagi.');

  const handleConnect = () => { window.location.href = '/api/calendar/google/auth'; };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/google', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Google Calendar diputuskan');
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error('Gagal memutuskan koneksi');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/calendar/google/sync', { method: 'POST' });
      const data = await res.json() as { synced?: number; failed?: number; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sync gagal');
      if (data.synced === 0) {
        toast.success(data.message ?? 'Semua task sudah tersync');
      } else {
        const msg = data.failed
          ? `${data.synced} tersync, ${data.failed} gagal`
          : `${data.synced} task disync ke Google Calendar`;
        toast.success(msg);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync gagal');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleSync = async () => {
    const next = !syncing;
    setSyncing(next);
    try {
      const res = await fetch('/api/calendar/google', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ syncEnabled: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? 'Auto-sync diaktifkan' : 'Auto-sync dinonaktifkan');
    } catch {
      setSyncing(!next);
      toast.error('Gagal mengubah pengaturan sync');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Google Calendar</p>
            <p className="text-xs text-muted-foreground">Sync tasks dengan due date ke Google Calendar</p>
          </div>
        </div>
        {connected && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3" /> Terhubung
          </span>
        )}
      </div>

      {connected ? (
        <div className="space-y-3">
          {/* Info rows */}
          <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Calendar</span>
              <span className="text-foreground font-mono text-xs">{calendarId ?? 'primary'}</span>
            </div>
            {connectedAt && (
              <div className="flex justify-between text-muted-foreground">
                <span>Terhubung sejak</span>
                <span className="text-foreground">
                  {new Date(connectedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Auto-sync toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Auto-sync</p>
              <p className="text-xs text-muted-foreground">Task baru / diupdate otomatis sync ke Google Calendar</p>
            </div>
            <Switch checked={syncing} onCheckedChange={handleToggleSync} />
          </div>

          {/* Sync existing */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Sync existing tasks</p>
              <p className="text-xs text-muted-foreground">Push semua task yang belum tersync ke Google Calendar</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={handleSyncAll}
              disabled={isSyncing || !syncing}
            >
              {isSyncing
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <UploadCloud className="w-3.5 h-3.5" />}
              {isSyncing ? 'Syncing…' : 'Sync now'}
            </Button>
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
        <Button size="sm" onClick={handleConnect} disabled={loading}>
          Hubungkan
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Putuskan Google Calendar?</DialogTitle>
            <DialogDescription>
              Task yang sudah tersync tidak akan dihapus dari Google Calendar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
              Putuskan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
