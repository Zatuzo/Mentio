'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Inbox, Brain, PenLine, Sparkles,
  CalendarDays, BarChart2, Settings, User, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY   = 'mentio_bottom_bar_v1';
const LONG_PRESS_MS = 1500;
const SWIPE_STEP_PX = 48; // px per item step
const CENTER_IDX    = 2;

const ALL_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'inbox',     label: 'Inbox',     icon: Inbox,           href: '/inbox'     },
  { id: 'brain',     label: 'Brain',     icon: Brain,           href: '/brain'     },
  { id: 'canvas',    label: 'Canvas',    icon: PenLine,         href: '/canvas'    },
  { id: 'ai',        label: 'AI Agent',  icon: Sparkles,        href: '/ai'        },
  { id: 'calendar',  label: 'Calendar',  icon: CalendarDays,    href: '/calendar'  },
  { id: 'analytics', label: 'Analytics', icon: BarChart2,       href: '/analytics' },
  { id: 'settings',  label: 'Settings',  icon: Settings,        href: '/settings'  },
  { id: 'admin',     label: 'Admin',     icon: User,            href: '/admin'     },
];

const DEFAULT_IDS = ['dashboard', 'inbox', 'brain', 'canvas', 'ai'];

interface Props {
  isOwner?: boolean;
  unreadCount?: number;
  newDumpCount?: number;
}

function loadSaved(): string[] {
  if (typeof window === 'undefined') return DEFAULT_IDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length === 5) return p;
    }
  } catch {}
  return DEFAULT_IDS;
}

export function MobileBottomBar({ isOwner = false, unreadCount = 0, newDumpCount = 0 }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_IDS);

  // Dock state: which slot is being edited + which roller item is showing
  const [dock, setDock] = useState<{
    slotIdx: number;
    rollerIdx: number; // index into availableItems
    baseRollerIdx: number; // at start of this swipe gesture
    startX: number;
  } | null>(null);

  // Long press state (for progress ring)
  const [holdSlot, setHoldSlot] = useState<{ idx: number; key: number } | null>(null);

  const longPressTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired   = useRef(false);
  const pressKeyRef      = useRef(0);
  const capturedPointerId = useRef<number | null>(null);
  const buttonRefs       = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { setSelectedIds(loadSaved()); }, []);

  const availableItems = isOwner ? ALL_ITEMS : ALL_ITEMS.filter(i => i.id !== 'admin');
  const items = selectedIds
    .map(id => ALL_ITEMS.find(n => n.id === id))
    .filter(Boolean) as typeof ALL_ITEMS;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const getBadge = (id: string)   => id === 'inbox' ? unreadCount : id === 'brain' ? newDumpCount : 0;

  // Item shown in each slot during dock vs normal
  function getSlotItem(slotIdx: number) {
    if (dock && slotIdx === dock.slotIdx) return availableItems[dock.rollerIdx];
    return items[slotIdx];
  }

  // Spring scale/y for elastic dock magnification
  function getDockTransform(slotIdx: number): { scale: number; y: number } {
    if (!dock) return { scale: 1, y: 0 };
    const dist = Math.abs(slotIdx - dock.slotIdx);
    if (dist === 0) return { scale: 1.45, y: -28 };
    if (dist === 1) return { scale: 1.12, y: -10 };
    return { scale: 0.92, y: 4 };
  }

  function commitDockSelection() {
    if (!dock) return;
    const chosen = availableItems[dock.rollerIdx];
    const next   = [...selectedIds];
    const existing = next.indexOf(chosen.id);
    if (existing !== -1 && existing !== dock.slotIdx) {
      next[existing] = next[dock.slotIdx];
    }
    next[dock.slotIdx] = chosen.id;
    setSelectedIds(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDock(null);
    setHoldSlot(null);
    router.push(chosen.href);
  }

  function cancelDock() {
    setDock(null);
    setHoldSlot(null);
  }

  // ── Long press ──────────────────────────────────────────────────────────
  function startLongPress(slotIdx: number, clientX: number, pointerId: number, el: HTMLButtonElement) {
    longPressFired.current = false;
    pressKeyRef.current++;
    setHoldSlot({ idx: slotIdx, key: pressKeyRef.current });
    capturedPointerId.current = pointerId;
    el.setPointerCapture(pointerId);

    const currentRollerIdx = availableItems.findIndex(i => i.id === selectedIds[slotIdx]);
    const safeRollerIdx = currentRollerIdx === -1 ? 0 : currentRollerIdx;

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      navigator.vibrate?.(60);
      setHoldSlot(null);
      setDock({
        slotIdx,
        rollerIdx: safeRollerIdx,
        baseRollerIdx: safeRollerIdx,
        startX: clientX,
      });
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setHoldSlot(null);
    longPressFired.current = false;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>, slotIdx: number) {
    if (dock && dock.slotIdx === slotIdx) {
      // Compute new roller index based on swipe distance
      const dx = dock.startX - e.clientX; // positive = swipe left = next item
      const delta = Math.round(dx / SWIPE_STEP_PX);
      const newIdx = Math.max(0, Math.min(
        availableItems.length - 1,
        dock.baseRollerIdx + delta,
      ));
      if (newIdx !== dock.rollerIdx) {
        navigator.vibrate?.(15);
        setDock(prev => prev ? { ...prev, rollerIdx: newIdx } : prev);
      }
    }
  }

  function handlePointerUp(href: string, slotIdx: number) {
    cancelLongPress();
    if (dock && dock.slotIdx === slotIdx) {
      commitDockSelection();
      return;
    }
    if (!longPressFired.current && !dock) {
      router.push(href);
    }
  }

  function handlePointerCancel() {
    cancelLongPress();
    if (dock) cancelDock();
  }

  // Dismiss dock on bg tap (not on bar itself)
  useEffect(() => {
    if (!dock) return;
    const handle = (e: PointerEvent) => {
      // dismiss only if click is outside the bar
      const bar = document.getElementById('mobile-bottom-bar');
      if (bar && !bar.contains(e.target as Node)) cancelDock();
    };
    window.addEventListener('pointerdown', handle, { capture: true });
    return () => window.removeEventListener('pointerdown', handle, { capture: true });
  }, [dock]);

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  return (
    <>
      <style>{`
        @keyframes hold-ring {
          from { stroke-dashoffset: var(--circ, 188); }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>

      <div id="mobile-bottom-bar" className="md:hidden fixed bottom-0 inset-x-0 z-50 select-none">
        {/* ── Roller label above rising item ─────────────────────── */}
        <AnimatePresence>
          {dock && (
            <motion.div
              key="dock-label"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="absolute bottom-full mb-2 inset-x-0 flex justify-center pointer-events-none"
            >
              {/* Position label above the dock slot */}
              <div
                className="flex items-center gap-2 bg-card/95 backdrop-blur-xl border border-border rounded-2xl px-4 py-2 shadow-xl"
                style={{
                  transform: `translateX(calc(${(dock.slotIdx - CENTER_IDX) * 20}%))`,
                }}
              >
                <motion.div
                  key={dock.rollerIdx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2"
                >
                  {dock.rollerIdx > 0 && (
                    <ChevronLeft className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {availableItems[dock.rollerIdx].label}
                  </span>
                  {dock.rollerIdx < availableItems.length - 1 && (
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Roller progress dots ─────────────────────────────── */}
        <AnimatePresence>
          {dock && (
            <motion.div
              key="roller-dots"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute bottom-full mb-12 inset-x-0 flex justify-center gap-1 pointer-events-none"
            >
              {availableItems.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    width: i === dock.rollerIdx ? 16 : 4,
                    backgroundColor: i === dock.rollerIdx ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="h-1 rounded-full"
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main bottom bar ───────────────────────────────────── */}
        <div
          className={cn(
            'bg-card/95 backdrop-blur-xl border-t border-border transition-all',
            dock && 'bg-card/80',
          )}
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-end justify-around px-2 pt-2 pb-1.5 max-w-lg mx-auto">
            {items.map((_, slotIdx) => {
              const slotItem   = getSlotItem(slotIdx);
              const Icon       = slotItem.icon;
              const active     = !dock && isActive(slotItem.href);
              const isCenter   = slotIdx === CENTER_IDX;
              const badge      = getBadge(slotItem.id);
              const dockTx     = getDockTransform(slotIdx);
              const isDockSlot = dock?.slotIdx === slotIdx;
              const isHolding  = holdSlot?.idx === slotIdx;

              return (
                <motion.button
                  key={slotIdx}
                  ref={el => { buttonRefs.current[slotIdx] = el; }}
                  onPointerDown={e => startLongPress(slotIdx, e.clientX, e.pointerId, e.currentTarget)}
                  onPointerMove={e => handlePointerMove(e, slotIdx)}
                  onPointerUp={() => handlePointerUp(slotItem.href, slotIdx)}
                  onPointerCancel={handlePointerCancel}
                  onContextMenu={e => e.preventDefault()}
                  animate={{
                    scale: dock ? dockTx.scale : 1,
                    y: dock ? dockTx.y : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.7 }}
                  className={cn(
                    'relative flex flex-col items-center outline-none touch-none',
                    isCenter && !dock ? '-translate-y-2' : '',
                    isDockSlot ? 'z-10' : '',
                  )}
                  style={{ touchAction: 'none' }}
                >
                  {isCenter && !dock ? (
                    /* ── Normal centre pill ── */
                    <div className="relative">
                      {isHolding && (
                        <svg
                          key={holdSlot!.key}
                          width="68" height="68" viewBox="0 0 68 68"
                          className="absolute -inset-2 -rotate-90 pointer-events-none"
                        >
                          <circle
                            cx="34" cy="34" r="30"
                            fill="none" stroke="currentColor"
                            strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 30}`}
                            strokeDashoffset={`${2 * Math.PI * 30}`}
                            className="text-primary"
                            style={{ animation: `hold-ring ${LONG_PRESS_MS}ms linear forwards` }}
                          />
                        </svg>
                      )}
                      <div className={cn(
                        'size-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-200',
                        active ? 'bg-primary text-primary-foreground' : 'bg-sidebar-accent text-foreground',
                        isHolding && 'ring-2 ring-primary/40',
                      )}>
                        <Icon className="size-6" />
                      </div>
                      {badge > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </div>
                  ) : isDockSlot ? (
                    /* ── Rising dock slot (edit mode) ── */
                    <div className="relative flex flex-col items-center gap-1">
                      <motion.div
                        key={slotItem.id}
                        initial={{ scale: 0.8, opacity: 0.6 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        className="size-14 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground shadow-2xl ring-4 ring-primary/30"
                      >
                        <Icon className="size-6" />
                      </motion.div>
                      {badge > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* ── Regular item ── */
                    <div className="relative flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl">
                      {isHolding && (
                        <svg
                          key={holdSlot!.key}
                          width="54" height="54" viewBox="0 0 54 54"
                          className="absolute -inset-1 -rotate-90 pointer-events-none"
                        >
                          <rect
                            x="3" y="3" width="48" height="48" rx="13"
                            fill="none" stroke="currentColor"
                            strokeWidth="2.5" strokeLinecap="round"
                            strokeDasharray="164" strokeDashoffset="164"
                            className="text-primary"
                            style={{ animation: `hold-ring ${LONG_PRESS_MS}ms linear forwards` }}
                          />
                        </svg>
                      )}
                      <div className="relative">
                        <motion.div
                          key={slotItem.id}
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        >
                          <Icon className={cn('size-5 transition-colors', active ? 'text-primary' : 'text-muted-foreground')} />
                        </motion.div>
                        {badge > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center px-0.5">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        'text-[10px] leading-tight transition-colors',
                        active ? 'font-semibold text-primary' : 'text-muted-foreground',
                        dock && !isDockSlot ? 'opacity-50' : '',
                      )}>
                        {slotItem.label}
                      </span>

                      {active && !dock && (
                        <motion.div
                          layoutId="mobile-active-dot"
                          className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary"
                        />
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Swipe hint when in dock mode */}
          <AnimatePresence>
            {dock && (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
                className="text-center text-[9px] text-muted-foreground pb-1"
              >
                Geser kiri / kanan · Lepas untuk pilih
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
