'use client';

import { useMemo, useState } from 'react';

type Mention = {
  id: string;
  text: string;
  senderName: string | null;
  groupName: string | null;
  timestamp: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  groupName: string | null;
  createdAt: string;
};

type Status = { slug: string; label: string; color: string };

type Draft = {
  key: string;
  title: string;
  description: string | null;
  priority: string;
  confidence: 'high' | 'low';
  isDuplicate: boolean;
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#f43f5e',
  high: '#f97316',
  medium: '#eab308',
  low: '#38bdf8',
  none: '#6b7280',
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  return `${Math.round(hr / 24)} hari lalu`;
}

export function HubBoard({
  projectId,
  projectName,
  statuses,
  mentions,
  tasks: initialTasks,
}: {
  projectId: string | null;
  projectName: string;
  statuses: Status[];
  mentions: Mention[];
  tasks: Task[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeMention, setActiveMention] = useState<Mention | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const columns = useMemo(
    () => statuses.map((s) => ({ ...s, tasks: tasks.filter((t) => t.status === s.slug) })),
    [statuses, tasks]
  );

  async function generateFromMention(mention: Mention) {
    if (!projectId) return;
    setActiveMention(mention);
    setDrafts([]);
    setGenerating(true);
    try {
      const res = await fetch('/api/tasks/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: mention.text, projectId }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let i = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type === 'task') {
              i += 1;
              setDrafts((prev) => [
                ...prev,
                {
                  key: `${Date.now()}-${i}`,
                  title: obj.data.title,
                  description: obj.data.description ?? null,
                  priority: obj.data.priority ?? 'none',
                  confidence: obj.data.confidence ?? 'high',
                  isDuplicate: !!obj.data.isDuplicate,
                },
              ]);
            }
          } catch {
            // ignore partial/malformed line
          }
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  async function addDraftToBoard(draft: Draft) {
    if (!projectId) return;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        projectId,
        mentionId: activeMention?.id ?? null,
      }),
    });
    if (!res.ok) return;
    const task = await res.json();
    setTasks((prev) => [
      {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        groupName: task.group?.name ?? null,
        createdAt: task.createdAt,
      },
      ...prev,
    ]);
    setDrafts((prev) => prev.filter((d) => d.key !== draft.key));
  }

  async function moveTask(taskId: string, status: string) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-6 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#7dd3a8]">{projectName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">Mention Hub</h1>
          <p className="mt-1 text-sm text-[#8b93a7]">
            Pesan WhatsApp yang menyebut kamu, siap diubah jadi task dengan satu klik.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[#8b93a7]">Mention baru</p>
            <p className="text-lg font-semibold">{mentions.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[#8b93a7]">Task aktif</p>
            <p className="text-lg font-semibold">{tasks.filter((t) => t.status !== 'done').length}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
        {/* Mention feed */}
        <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="px-1 text-sm font-semibold text-[#c7cdda]">Baru disebut</h2>
          <div className="flex flex-col gap-2">
            {mentions.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-[#6b7280]">Belum ada mention masuk.</p>
            )}
            {mentions.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-white/5 bg-[#11151f] p-3 transition hover:border-white/15"
              >
                <div className="flex items-center justify-between text-xs text-[#8b93a7]">
                  <span className="font-medium text-[#c7cdda]">{m.senderName ?? 'Seseorang'}</span>
                  <span>{timeAgo(m.timestamp)}</span>
                </div>
                {m.groupName && (
                  <span className="mt-1 inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8b93a7]">
                    {m.groupName}
                  </span>
                )}
                <p className="mt-2 line-clamp-3 text-sm text-[#dfe3ea]">{m.text}</p>
                <button
                  onClick={() => generateFromMention(m)}
                  disabled={!projectId}
                  className="mt-3 w-full rounded-lg bg-[#7dd3a8] py-1.5 text-xs font-semibold text-[#0b0e14] transition hover:bg-[#94ddb8] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Ubah jadi task dengan AI
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Board */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {columns.map((col) => (
            <div
              key={col.slug}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragTaskId && moveTask(dragTaskId, col.slug)}
              className="flex min-h-[200px] flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
                <h3 className="text-sm font-semibold text-[#c7cdda]">{col.label}</h3>
                <span className="ml-auto text-xs text-[#6b7280]">{col.tasks.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {col.tasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragTaskId(t.id)}
                    className="cursor-grab rounded-xl border border-white/5 bg-[#11151f] p-3 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#e6e9ef]">{t.title}</p>
                      <span
                        className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.none }}
                        title={t.priority}
                      />
                    </div>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-[#8b93a7]">{t.description}</p>
                    )}
                    {t.groupName && (
                      <span className="mt-2 inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8b93a7]">
                        {t.groupName}
                      </span>
                    )}
                  </div>
                ))}
                {col.tasks.length === 0 && (
                  <p className="rounded-lg border border-dashed border-white/10 py-6 text-center text-xs text-[#565d6d]">
                    Kosong
                  </p>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* AI draft drawer */}
      {activeMention && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setActiveMention(null)}>
          <div
            className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-white/10 bg-[#0e1119] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#7dd3a8]">Draft task dari AI</p>
                <p className="mt-1 text-sm text-[#8b93a7] line-clamp-3">{activeMention.text}</p>
              </div>
              <button
                onClick={() => setActiveMention(null)}
                className="rounded-lg px-2 py-1 text-sm text-[#8b93a7] hover:bg-white/5"
              >
                Tutup
              </button>
            </div>

            {generating && drafts.length === 0 && (
              <p className="text-sm text-[#8b93a7]">Menganalisis pesan…</p>
            )}

            <div className="flex flex-col gap-3">
              {drafts.map((d) => (
                <div key={d.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{
                        color: PRIORITY_COLOR[d.priority] ?? PRIORITY_COLOR.none,
                        backgroundColor: `${PRIORITY_COLOR[d.priority] ?? PRIORITY_COLOR.none}22`,
                      }}
                    >
                      {d.priority}
                    </span>
                    {d.isDuplicate && (
                      <span className="text-[10px] text-[#f43f5e]">mirip task lain</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-[#e6e9ef]">{d.title}</p>
                  {d.description && <p className="mt-1 text-xs text-[#8b93a7]">{d.description}</p>}
                  <button
                    onClick={() => addDraftToBoard(d)}
                    className="mt-3 w-full rounded-lg bg-[#7dd3a8] py-1.5 text-xs font-semibold text-[#0b0e14] hover:bg-[#94ddb8]"
                  >
                    Tambahkan ke board
                  </button>
                </div>
              ))}
            </div>

            {!generating && drafts.length === 0 && (
              <p className="text-sm text-[#565d6d]">Tidak ada task yang terdeteksi dari pesan ini.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
