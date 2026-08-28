'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/app/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Link2, Unlink } from 'lucide-react';

interface Props {
  connected: boolean;
  oauthEnabled: boolean;
}

export function ConnectGithub({ connected, oauthEnabled }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Surface GitHub OAuth errors (redirected back via errorCallbackURL) as a toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (!err) return;

    const messages: Record<string, string> = {
      account_already_linked_to_different_user:
        'Akun GitHub ini sudah terhubung ke user lain. Putuskan dulu dari akun itu, atau pakai akun GitHub yang berbeda.',
      email_doesn_t_match:
        'Email akun GitHub tidak cocok dengan akun aplikasi.',
    };
    toast.error(messages[err] || `Gagal menghubungkan GitHub: ${err}`);
    // Drop the ?error= param so it doesn't re-fire on refresh.
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  async function connect() {
    setLoading(true);
    try {
      const res = await authClient.linkSocial({
        provider: 'github',
        callbackURL: '/settings',
        errorCallbackURL: '/settings',
      });
      if (res?.error) throw new Error(res.error.message || 'Authorization failed');
      // Depending on the better-auth version this either redirects automatically
      // or returns the authorize URL for us to navigate to.
      if (res?.data?.url) window.location.href = res.data.url;
    } catch (e: any) {
      toast.error(e?.message || 'Could not start GitHub authorization');
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    try {
      const res = await authClient.unlinkAccount({ providerId: 'github' });
      if (res.error) throw new Error(res.error.message || 'Failed to disconnect');
      toast.success('GitHub disconnected');
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  }

  if (!oauthEnabled) {
    return (
      <div className="rounded-lg border border-border bg-card/30 p-4 text-sm text-muted-foreground">
        GitHub OAuth is not configured on this server. Set{' '}
        <code className="text-foreground">GITHUB_CLIENT_ID</code> and{' '}
        <code className="text-foreground">GITHUB_CLIENT_SECRET</code> in the environment to enable
        one-click GitHub authorization. You can still use a manual access token below.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/30 p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
          }`}
        >
          {connected ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        </div>
        <div>
          <div className="text-sm font-medium">
            {connected ? 'GitHub account connected' : 'Connect your GitHub account'}
          </div>
          <div className="text-xs text-muted-foreground">
            {connected
              ? 'Generated prompts use your GitHub access to read repos.'
              : 'Authorize once — no need to paste a personal access token.'}
          </div>
        </div>
      </div>

      {connected ? (
        <Button variant="ghost" size="sm" onClick={disconnect} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
          Disconnect
        </Button>
      ) : (
        <Button size="sm" onClick={connect} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          Connect GitHub
        </Button>
      )}
    </div>
  );
}
