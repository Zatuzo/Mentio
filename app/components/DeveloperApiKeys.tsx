'use client';

import { useState } from 'react';
import { Copy, Check, Trash2, Plus, Key, Eye, EyeOff, Terminal } from 'lucide-react';
import { toast } from 'sonner';

// ── IDE config generators ──────────────────────────────────────────────────────

type IdeId = 'claude-code' | 'cursor' | 'windsurf' | 'vscode' | 'github-copilot' | 'continue';

const IDES: { id: IdeId; label: string }[] = [
  { id: 'claude-code',    label: 'Claude Code'    },
  { id: 'cursor',         label: 'Cursor'         },
  { id: 'windsurf',       label: 'Windsurf'       },
  { id: 'vscode',         label: 'VS Code / IDX'  },
  { id: 'github-copilot', label: 'GitHub Copilot' },
  { id: 'continue',       label: 'Continue'       },
];

function getIdeConfig(ide: IdeId, apiKey: string, baseUrl: string) {
  const env = { MENTIO_API_KEY: apiKey, MENTIO_BASE_URL: baseUrl };
  const mcpEntry = { command: 'mentio-mcp', args: [] as string[], env };

  switch (ide) {
    case 'claude-code':
      return {
        configPath: null as string | null,
        setupCmd: 'npm install -g mentio-mcp',
        terminalCmd: `claude mcp add --scope user mentio -e MENTIO_API_KEY=${apiKey} -e MENTIO_BASE_URL=${baseUrl} -- mentio-mcp`,
        json: JSON.stringify({ mcpServers: { mentio: mcpEntry } }, null, 2),
        extraNote: null as string | null,
      };
    case 'cursor':
      return {
        configPath: '~/.cursor/mcp.json',
        setupCmd: 'npm install -g mentio-mcp',
        terminalCmd: null as string | null,
        json: JSON.stringify({ mcpServers: { mentio: mcpEntry } }, null, 2),
        extraNote: null as string | null,
      };
    case 'windsurf':
      return {
        configPath: '~/.codeium/windsurf/mcp_config.json',
        setupCmd: 'npm install -g mentio-mcp',
        terminalCmd: null as string | null,
        json: JSON.stringify({ mcpServers: { mentio: mcpEntry } }, null, 2),
        extraNote: null as string | null,
      };
    case 'vscode':
      return {
        configPath: '.vscode/mcp.json (di dalam project folder)',
        setupCmd: 'npm install -g mentio-mcp',
        terminalCmd: null as string | null,
        json: JSON.stringify({ servers: { mentio: { type: 'stdio', ...mcpEntry } } }, null, 2),
        extraNote: 'Berlaku juga untuk Google Project IDX (Anti Gravity) — format config-nya sama karena berbasis VS Code.',
      };
    case 'github-copilot':
      return {
        configPath: '.vscode/mcp.json (di dalam project folder)',
        setupCmd: 'npm install -g mentio-mcp',
        terminalCmd: null as string | null,
        json: JSON.stringify({ servers: { mentio: { type: 'stdio', ...mcpEntry } } }, null, 2),
        extraNote: 'Setelah config ditambahkan, buka Copilot Chat → klik ikon ✦ Agent di pojok kanan input → tool mentio_* akan muncul. Butuh VS Code versi 1.99+.',
      };
    case 'continue':
      return {
        configPath: '~/.continue/config.json (tambahkan ke array mcpServers)',
        setupCmd: 'npm install -g mentio-mcp',
        terminalCmd: null as string | null,
        json: JSON.stringify({ name: 'mentio', command: 'mentio-mcp', args: [], env }, null, 2),
        extraNote: null as string | null,
      };
  }
}

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type Props = {
  initialKeys: ApiKey[];
  baseUrl: string;
};

export function DeveloperApiKeys({ initialKeys, baseUrl }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showMcpConfig, setShowMcpConfig] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', scopes: 'read', expiresAt: '' });
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/developer/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          scopes: form.scopes,
          expiresAt: form.expiresAt || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setNewKey(data.rawKey);
      setKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          keyPrefix: data.keyPrefix,
          scopes: data.scopes,
          lastUsedAt: null,
          expiresAt: data.expiresAt,
          createdAt: data.createdAt,
        },
        ...prev,
      ]);
      setForm({ name: '', scopes: 'read', expiresAt: '' });
      setShowCreate(false);
    } catch {
      toast.error('Gagal membuat API key');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus API key "${name}"? Aksi ini tidak bisa di-undo.`)) return;
    try {
      const res = await fetch(`/api/developer/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success('API key dihapus');
    } catch {
      toast.error('Gagal menghapus API key');
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold">MCP — Mentio di AI Kamu</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Hubungkan Mentio ke Claude Code, Cursor, atau AI tool lainnya agar kamu bisa tanya soal mention, task, dan project langsung dari chat.
        </p>
      </div>

      {/* ── Step-by-step onboarding guide ──────────────────────────────────── */}
      {!newKey && (
        <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
          <p className="text-sm font-medium">Cara menghubungkan Mentio ke AI tool</p>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-primary flex items-center justify-center mt-0.5">1</span>
              <div>
                <p className="text-sm font-medium">Buat API Key</p>
                <p className="text-xs text-muted-foreground mt-0.5">Klik tombol <span className="text-foreground font-medium">Buat API Key Baru</span> di bawah. Salin key yang muncul — hanya ditampilkan sekali.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-primary flex items-center justify-center mt-0.5">2</span>
              <div>
                <p className="text-sm font-medium">Install MCP package</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Jalankan sekali di terminal:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-1.5 text-xs font-mono">npm install -g mentio-mcp</code>
                  <button
                    onClick={() => copy('npm install -g mentio-mcp', 'guide-install')}
                    className="shrink-0 rounded-md border border-border p-1.5 hover:bg-accent transition-colors"
                  >
                    {copied === 'guide-install' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-primary flex items-center justify-center mt-0.5">3</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Tambahkan config ke AI tool</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  Pilih AI tool kamu di bawah. Ganti <code className="font-mono text-[11px]">YOUR_API_KEY</code> dengan key yang kamu buat di langkah 1.
                </p>
                <IdeSetup
                  apiKey="YOUR_API_KEY"
                  baseUrl={baseUrl}
                  copied={copied}
                  onCopy={copy}
                  idPrefix="guide"
                />
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-primary flex items-center justify-center mt-0.5">4</span>
              <div>
                <p className="text-sm font-medium">Restart AI tool</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tutup dan buka kembali Claude Code atau Cursor. Tool <code className="font-mono text-[11px]">mentio_*</code> langsung tersedia.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-primary flex items-center justify-center mt-0.5">5</span>
              <div>
                <p className="text-sm font-medium">Test koneksi</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tanya: <span className="italic text-foreground">&ldquo;List semua project di Mentio saya&rdquo;</span> — Claude akan langsung mengambil data dari akunmu.</p>
              </div>
            </li>
          </ol>
        </div>
      )}

      {/* ── New key banner (after creation) ────────────────────────────────── */}
      {newKey && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-emerald-400">API key berhasil dibuat!</p>
              <p className="text-xs text-muted-foreground mt-0.5">Salin sekarang — tidak akan ditampilkan lagi setelah ditutup.</p>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              Tutup ✓
            </button>
          </div>

          {/* Step 1: raw key */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 mr-1.5 text-[10px] font-bold">1</span>
              Salin API Key
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-black/30 px-3 py-2 text-xs font-mono break-all text-emerald-300">
                {newKey}
              </code>
              <button
                onClick={() => copy(newKey, 'key')}
                className="shrink-0 rounded-md border border-border p-2 hover:bg-accent transition-colors"
                title="Salin key"
              >
                {copied === 'key' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Step 2: install + config */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 mr-1.5 text-[10px] font-bold">2</span>
              Install &amp; tambahkan config ke AI tool kamu
            </p>
            <IdeSetup
              apiKey={newKey}
              baseUrl={baseUrl}
              copied={copied}
              onCopy={copy}
              idPrefix="new"
              dark
            />
          </div>

          {/* Step 3: restart note */}
          <div className="rounded-lg bg-black/20 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-300/80">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 mr-1.5 text-[10px] font-bold">3</span>
            Restart Claude Code / Cursor, lalu tanya: <span className="italic">&ldquo;List project di Mentio&rdquo;</span> untuk memastikan koneksi aktif.
          </div>
        </div>
      )}

      {/* ── Key management section ──────────────────────────────────────────── */}
      <div>
        <h4 className="text-sm font-semibold mb-3">API Keys kamu</h4>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-lg border border-border p-4 space-y-4">
          <h4 className="text-sm font-medium">Buat API Key Baru</h4>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Nama</label>
            <input
              type="text"
              placeholder="cth: Claude Code local"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Scope</label>
            <select
              value={form.scopes}
              onChange={(e) => setForm((f) => ({ ...f, scopes: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="read">read — baca data saja</option>
              <option value="read,write">read,write — baca + update task/tag mention</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Kadaluarsa (opsional)</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Membuat...' : 'Buat Key'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          <Plus className="h-4 w-4" />
          Buat API Key Baru
        </button>
      )}

      <div className="space-y-3">
        {keys.length === 0 && !newKey && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Belum ada API key. Ikuti langkah di atas untuk mulai.
          </div>
        )}
        {keys.map((key) => (
          <div key={key.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{key.name}</p>
                <code className="text-xs text-muted-foreground font-mono">{key.keyPrefix}••••••••••••</code>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setShowMcpConfig(showMcpConfig === key.id ? null : key.id)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  {showMcpConfig === key.id ? (
                    <><EyeOff className="h-3.5 w-3.5" /> Tutup config</>
                  ) : (
                    <><Eye className="h-3.5 w-3.5" /> Lihat config</>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(key.id, key.name)}
                  className="rounded-md border border-border p-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Hapus key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-0.5">{key.scopes}</span>
              {key.expiresAt && (
                <span className="rounded-full border border-border px-2 py-0.5">
                  exp: {new Date(key.expiresAt).toLocaleDateString('id-ID')}
                </span>
              )}
              {key.lastUsedAt && (
                <span>
                  Terakhir dipakai: {new Date(key.lastUsedAt).toLocaleDateString('id-ID')}
                </span>
              )}
              <span>Dibuat: {new Date(key.createdAt).toLocaleDateString('id-ID')}</span>
            </div>

            {showMcpConfig === key.id && (
              <IdeSetup
                apiKey={`${key.keyPrefix}••••••••••••`}
                baseUrl={baseUrl}
                copied={copied}
                onCopy={copy}
                idPrefix={`key-${key.id}`}
                note={`Ganti ${key.keyPrefix}•••••••••••• dengan API key lengkap yang disalin saat pembuatan.`}
              />
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

// ── IdeSetup sub-component ─────────────────────────────────────────────────────

function IdeSetup({
  apiKey,
  baseUrl,
  copied,
  onCopy,
  idPrefix,
  dark = false,
  note,
}: {
  apiKey: string;
  baseUrl: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  idPrefix: string;
  dark?: boolean;
  note?: string;
}) {
  const [ide, setIde] = useState<IdeId>('claude-code');
  const [tab, setTab] = useState<'terminal' | 'json'>('terminal');

  const cfg = getIdeConfig(ide, apiKey, baseUrl);
  const hasTerminal = !!cfg.terminalCmd;

  const codeBg = dark ? 'bg-black/30 text-emerald-300/90' : 'bg-muted text-foreground';
  const noteBg = dark
    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300/80'
    : 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400/80';
  const tabActive = dark
    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
    : 'bg-primary/10 border-primary/30 text-foreground';
  const tabInactive = 'border-border text-muted-foreground hover:bg-accent';

  return (
    <div className="space-y-3">
      {/* IDE selector */}
      <div className="flex flex-wrap gap-1.5">
        {IDES.map((i) => (
          <button
            key={i.id}
            onClick={() => {
              setIde(i.id);
              setTab(i.id === 'claude-code' ? 'terminal' : 'json');
            }}
            className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${ide === i.id ? tabActive : tabInactive}`}
          >
            {i.label}
          </button>
        ))}
      </div>

      {/* Claude Code: setup command shortcut */}
      {ide === 'claude-code' && cfg.setupCmd && (
        <div className={`rounded-md border px-3 py-2.5 text-xs ${noteBg}`}>
          <p className="font-medium mb-1">Cara tercepat — jalankan dari folder repo:</p>
          <div className="flex items-center gap-2">
            <code className={`flex-1 rounded px-2.5 py-1.5 font-mono ${codeBg}`}>{cfg.setupCmd}</code>
            <button onClick={() => onCopy(cfg.setupCmd!, `${idPrefix}-setup`)} className="shrink-0 rounded-md border border-border p-1.5 hover:bg-accent transition-colors">
              {copied === `${idPrefix}-setup` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-1.5 opacity-80">Install package global, lalu jalankan terminal command di bawah. Flag <code className="font-mono text-[11px]">--scope user</code> membuatnya tersedia di semua project, bukan hanya folder ini.</p>
        </div>
      )}

      {/* Tab — terminal vs json */}
      {hasTerminal && (
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setTab('terminal')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md border transition-colors ${tab === 'terminal' ? tabActive : tabInactive}`}
          >
            <Terminal className="h-3 w-3" />
            Terminal manual
          </button>
          <button
            onClick={() => setTab('json')}
            className={`px-3 py-1 rounded-md border transition-colors ${tab === 'json' ? tabActive : tabInactive}`}
          >
            JSON
          </button>
        </div>
      )}

      {/* Content */}
      {tab === 'terminal' && cfg.terminalCmd ? (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Atau jalankan manual di terminal:</p>
          <div className="flex items-start gap-2">
            <code className={`flex-1 rounded px-3 py-2 text-xs font-mono break-all leading-relaxed ${codeBg}`}>
              {cfg.terminalCmd}
            </code>
            <button
              onClick={() => onCopy(cfg.terminalCmd!, `${idPrefix}-cmd`)}
              className="shrink-0 rounded-md border border-border p-2 hover:bg-accent transition-colors mt-0.5"
            >
              {copied === `${idPrefix}-cmd` ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {note && <p className="text-xs text-muted-foreground mt-1.5">{note}</p>}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            {cfg.configPath && (
              <p className="text-xs text-muted-foreground">
                Paste ke <code className="font-mono text-[11px]">{cfg.configPath}</code>
              </p>
            )}
            <button
              onClick={() => onCopy(cfg.json, `${idPrefix}-json`)}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent transition-colors shrink-0 ml-auto"
            >
              {copied === `${idPrefix}-json` ? (
                <><Check className="h-3 w-3 text-emerald-400" /> Tersalin!</>
              ) : (
                <><Copy className="h-3 w-3" /> Copy</>
              )}
            </button>
          </div>
          <pre className={`rounded-md px-3 py-2 text-xs font-mono overflow-auto ${codeBg}`}>
            {cfg.json}
          </pre>
          {note && <p className="text-xs text-muted-foreground mt-1.5">{note}</p>}
          {cfg.extraNote && (
            <div
              className={`mt-2 rounded-md border px-3 py-2 text-xs ${noteBg}`}
              dangerouslySetInnerHTML={{ __html: cfg.extraNote }}
            />
          )}
        </div>
      )}
    </div>
  );
}
