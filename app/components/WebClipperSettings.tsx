'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, BookMarked, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Props { baseUrl: string }

export function WebClipperSettings({ baseUrl }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState<'token' | 'bookmarklet' | null>(null);

  useEffect(() => {
    fetch('/api/user/clip-token')
      .then((r) => r.json())
      .then((d) => setToken(d.token))
      .finally(() => setLoading(false));
  }, []);

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await fetch('/api/user/clip-token', { method: 'POST' });
      const data = await res.json();
      setToken(data.token);
      toast.success('Token regenerated — update your bookmarklet');
    } finally {
      setRegenerating(false);
    }
  }

  function bookmarkletCode(t: string) {
    // Minified bookmarklet
    return `javascript:(function(){var s=window.getSelection().toString();var p={title:document.title,url:location.href,selection:s,description:(document.querySelector('meta[name="description"]')||{}).content||''};fetch('${baseUrl}/api/clip',{method:'POST',headers:{'Authorization':'Bearer ${t}','Content-Type':'application/json'},body:JSON.stringify(p)}).then(function(r){return r.json()}).then(function(d){alert(d.ok?'Saved to Brain!':'Error: '+JSON.stringify(d))}).catch(function(e){alert('Error: '+e.message)})})();`;
  }

  async function copy(text: string, type: 'token' | 'bookmarklet') {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">Web Clipper</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Save web pages and selected text directly to your Brain from any browser.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-medium">How it works</p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Copy the bookmarklet link below</li>
          <li>Drag it to your browser&apos;s bookmarks bar</li>
          <li>On any page, click the bookmarklet to save to your Brain</li>
          <li>Optionally select text first — it&apos;ll be saved as a quote</li>
        </ol>
      </div>

      {/* Clip token */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Clip token</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Used by the bookmarklet to authenticate. Keep it private.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={regenerate}
            disabled={regenerating || loading}
            className="text-muted-foreground hover:text-foreground h-7 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <code className="text-xs font-mono flex-1 text-muted-foreground truncate">
            {loading ? 'Loading…' : token ? `${token.slice(0, 8)}${'•'.repeat(24)}${token.slice(-8)}` : '—'}
          </code>
          <button
            onClick={() => token && copy(token, 'token')}
            disabled={!token}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied === 'token' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Bookmarklet */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Bookmarklet</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag the button below to your bookmarks bar, or copy the code manually.
          </p>
        </div>

        {token ? (
          <div className="space-y-3">
            {/* Drag target */}
            <a
              href={bookmarkletCode(token)}
              onClick={(e) => e.preventDefault()}
              draggable
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:border-white/20 hover:bg-white/[0.04] transition-colors cursor-grab active:cursor-grabbing select-none"
            >
              <BookMarked className="w-4 h-4 text-muted-foreground" />
              Save to Brain
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal ml-1">drag me</Badge>
            </a>

            {/* Manual copy */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">Or copy the code manually</p>
                <button
                  onClick={() => copy(bookmarkletCode(token), 'bookmarklet')}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied === 'bookmarklet' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copied === 'bookmarklet' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <code className="text-[10px] font-mono text-muted-foreground/60 break-all line-clamp-3">
                {bookmarkletCode(token)}
              </code>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {loading ? 'Generating your bookmarklet…' : 'Token unavailable'}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/70">Tips</p>
        <p>• Select text before clicking to save a specific quote from the page</p>
        <p>• Clips land in your <span className="font-medium text-foreground/60">Inbox</span> space — organize them later</p>
        <p>• If you regenerate the token, update the bookmarklet by dragging the new one</p>
      </div>
    </div>
  );
}
