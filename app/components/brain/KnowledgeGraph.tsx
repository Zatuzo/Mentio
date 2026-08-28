'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Loader2, X, ArrowUpRight, Search, Maximize2, ChevronLeft, Network, BookOpen,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false }) as any;

type NodeType = 'note' | 'tag';

interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  val: number;
  color: string;
  spaceId?: string;
  spaceName?: string;
  date?: string;
  tags?: string[];
  preview?: string;
  noteCount?: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'link' | 'tag';
}

interface SpaceInfo {
  id: string;
  name: string;
  icon: string | null;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  spaces: SpaceInfo[];
}

function nodeId(n: string | GraphNode): string {
  return typeof n === 'string' ? n : n.id;
}

export function KnowledgeGraph() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  const [data, setData] = useState<GraphData>({ nodes: [], links: [], spaces: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const [search, setSearch] = useState('');
  const [spaceFilter, setSpaceFilter] = useState('all');

  useEffect(() => {
    fetch('/api/brain/graph')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pre-compute neighbor map for hover highlighting
  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of data.links) {
      const s = nodeId(link.source);
      const t = nodeId(link.target);
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    }
    return map;
  }, [data.links]);

  // Active node IDs for space filter + search (null = show all)
  const activeIds = useMemo((): Set<string> | null => {
    let result: Set<string> | null = null;

    if (spaceFilter !== 'all') {
      result = new Set<string>();
      for (const n of data.nodes) {
        if (n.type === 'note' && n.spaceId === spaceFilter) result.add(n.id);
      }
      // Include tag nodes connected to any active note
      for (const link of data.links) {
        const s = nodeId(link.source);
        const t = nodeId(link.target);
        if (result.has(s) && t.startsWith('tag:')) result.add(t);
        if (result.has(t) && s.startsWith('tag:')) result.add(s);
      }
    }

    if (search.length >= 2) {
      const q = search.toLowerCase();
      const searchSet = new Set<string>();
      for (const n of data.nodes) {
        if (n.name.toLowerCase().includes(q) || n.tags?.some((t) => t.toLowerCase().includes(q))) {
          searchSet.add(n.id);
          for (const nb of neighborMap.get(n.id) ?? []) searchSet.add(nb);
        }
      }
      if (result) {
        for (const id of result) { if (!searchSet.has(id)) result.delete(id); }
      } else {
        result = searchSet;
      }
    }

    return result;
  }, [data, spaceFilter, search, neighborMap]);

  const getAlpha = useCallback(
    (id: string): number => {
      if (hovered) {
        if (id === hovered.id || neighborMap.get(hovered.id)?.has(id)) return 1;
        return 0.1;
      }
      if (activeIds) return activeIds.has(id) ? 1 : 0.08;
      return 1;
    },
    [hovered, neighborMap, activeIds],
  );

  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode & { x: number; y: number };
      if (n.x == null || n.y == null) return;

      const alpha = getAlpha(n.id);
      ctx.globalAlpha = alpha;

      if (n.type === 'tag') {
        const size = 4;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y - size);
        ctx.lineTo(n.x + size, n.y);
        ctx.lineTo(n.x, n.y + size);
        ctx.lineTo(n.x - size, n.y);
        ctx.closePath();
        ctx.fillStyle = '#94a3b8';
        ctx.fill();

        if (globalScale >= 1.1) {
          const fontSize = Math.max(7, 8 / globalScale);
          ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = 'rgba(148,163,184,0.9)';
          ctx.fillText('#' + n.name, n.x, n.y + size + 2);
        }
      } else {
        const r = Math.max(4, Math.sqrt(Math.max(1, n.val)) * 4);
        const isSelected = selected?.id === n.id;
        const isHovered = hovered?.id === n.id;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = n.color;
        ctx.fill();

        if (isSelected || isHovered) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 1.5 / globalScale;
          ctx.stroke();
        }

        if (globalScale >= 0.7 && alpha > 0.4) {
          const label = n.name.length > 24 ? n.name.slice(0, 24) + '…' : n.name;
          const fontSize = Math.max(9, 11 / globalScale);
          ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillText(label, n.x, n.y + r + 3);
        }
      }

      ctx.globalAlpha = 1;
    },
    [getAlpha, selected, hovered],
  );

  // Defines clickable area for custom-drawn nodes
  const paintArea = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as GraphNode & { x: number; y: number };
      if (n.x == null || n.y == null) return;
      const r = n.type === 'tag' ? 7 : Math.max(4, Math.sqrt(Math.max(1, n.val)) * 4) + 5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  const getLinkColor = useCallback(
    (link: object) => {
      const l = link as GraphLink;
      const sa = getAlpha(nodeId(l.source));
      const ta = getAlpha(nodeId(l.target));
      const visible = Math.min(sa, ta) > 0.4;
      if (l.type === 'tag') return visible ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.03)';
      return visible ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.04)';
    },
    [getAlpha],
  );

  const getLinkWidth = useCallback(
    (link: object) => ((link as GraphLink).type === 'tag' ? 0.7 : 1.5),
    [],
  );

  const getParticles = useCallback(
    (link: object) => {
      const l = link as GraphLink;
      if (l.type !== 'link') return 0;
      return Math.min(getAlpha(nodeId(l.source)), getAlpha(nodeId(l.target))) > 0.4 ? 1 : 0;
    },
    [getAlpha],
  );

  const handleClick = useCallback((node: object) => {
    const n = node as GraphNode;
    if (n.type === 'note') setSelected((prev) => (prev?.id === n.id ? null : n));
  }, []);

  const handleHover = useCallback((node: object | null) => {
    setHovered(node ? (node as GraphNode) : null);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  }, []);

  const noteCount = data.nodes.filter((n) => n.type === 'note').length;
  const tagCount = data.nodes.filter((n) => n.type === 'tag').length;
  const wikiCount = data.links.filter((l) => l.type === 'link').length;

  const spaceOptions = useMemo(
    () => data.spaces.filter((s) => data.nodes.some((n) => n.type === 'note' && n.spaceId === s.id)),
    [data],
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Controls bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60 backdrop-blur-sm shrink-0 flex-wrap gap-y-1.5">
        <button
          onClick={() => router.push('/brain')}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Network className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium shrink-0">Knowledge Graph</span>

        {/* Search */}
        <div className="relative min-w-[140px] flex-1 max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari note atau tag…"
            className="w-full h-7 pl-8 pr-3 rounded-md bg-muted/50 border border-border/60 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-white/25 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Space filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setSpaceFilter('all')}
            className={`h-6 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
              spaceFilter === 'all'
                ? 'bg-white/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            All
          </button>
          {spaceOptions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSpaceFilter(s.id === spaceFilter ? 'all' : s.id)}
              className={`h-6 px-2.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                spaceFilter === s.id
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </div>

        {/* Zoom to fit */}
        <button
          onClick={() => fgRef.current?.zoomToFit(400, 48)}
          title="Zoom to fit (semua nodes)"
          className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Graph canvas ── */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Memuat graph…</span>
          </div>
        ) : noteCount === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <BookOpen className="w-10 h-10 opacity-20" />
            <p className="text-sm">Belum ada notes.</p>
            <p className="text-xs opacity-50 text-center max-w-[240px] leading-relaxed">
              Buat notes lalu hubungkan dengan [[wikilinks]] atau tambahkan tag untuk melihat koneksi.
            </p>
          </div>
        ) : (
          <div ref={containerRef} className="absolute inset-0">
            <ForceGraph2D
              ref={fgRef}
              graphData={data}
              width={dims.width}
              height={dims.height}
              backgroundColor="transparent"
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => 'replace'}
              nodePointerAreaPaint={paintArea}
              linkColor={getLinkColor}
              linkWidth={getLinkWidth}
              linkDirectionalParticles={getParticles}
              linkDirectionalParticleSpeed={0.003}
              linkDirectionalParticleColor={() => 'rgba(255,255,255,0.6)'}
              onNodeClick={handleClick}
              onNodeHover={handleHover}
              cooldownTicks={160}
              d3VelocityDecay={0.28}
              d3AlphaDecay={0.018}
            />
          </div>
        )}

        {/* ── Detail panel (floats over graph) ── */}
        {selected && (
          <div className="absolute top-4 right-4 w-64 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden z-10">
            <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2 border-b border-border/50">
              <p className="text-sm font-semibold leading-snug line-clamp-2">{selected.name}</p>
              <button
                onClick={() => setSelected(null)}
                className="mt-0.5 text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-2.5">
              {selected.spaceName && (
                <p className="text-xs text-muted-foreground">{selected.spaceName}</p>
              )}
              {selected.tags && selected.tags.length > 0 && (
                <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
                  {selected.tags.map((t) => '#' + t).join(' ')}
                </p>
              )}
              {selected.preview && (
                <p className="text-xs text-muted-foreground/65 line-clamp-5 leading-relaxed">
                  {selected.preview}
                </p>
              )}
              {selected.date && (
                <p className="text-[10px] text-muted-foreground/35 tabular-nums">
                  {new Date(selected.date).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
            </div>

            <div className="px-4 pb-3">
              <Link
                href={`/brain/notes/${selected.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Buka note
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Legend + stats ── */}
        {!loading && noteCount > 0 && (
          <div className="absolute bottom-4 left-4 pointer-events-none select-none space-y-1.5">
            {/* Space legend */}
            {spaceOptions.length > 0 && (
              <div className="flex flex-col gap-1">
                {spaceOptions.slice(0, 6).map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] text-muted-foreground/50">{s.name}</span>
                  </div>
                ))}
                {tagCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rotate-45 bg-slate-400/50 inline-block" />
                    <span className="text-[10px] text-muted-foreground/50">{tagCount} tag nodes</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/30">
              {noteCount} notes · {wikiCount} links
            </p>
          </div>
        )}

        {/* Tip */}
        {!loading && noteCount > 0 && (
          <p className="absolute bottom-4 right-4 text-[10px] text-muted-foreground/25 select-none hidden sm:block">
            Drag · Scroll zoom · Click untuk detail
          </p>
        )}
      </div>
    </div>
  );
}
