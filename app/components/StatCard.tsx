'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  value: number;
  label: string;
  highlight?: boolean;
  index: number;
}

function useCountUp(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

export function StatCard({ value, label, highlight, index }: Props) {
  const count = useCountUp(value, 500);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.07 }}
      className="px-5 py-4"
    >
      <p className={`text-2xl font-semibold tabular-nums tracking-tight ${highlight && value > 0 ? 'text-primary' : ''}`}>
        {count}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}
