'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function EmptyState({ icon, title, description, action, className, size = 'md' }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'md' ? 'py-16 gap-4' : 'py-6 gap-2',
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3, type: 'spring', stiffness: 200 }}
        className={cn(
          'rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center ring-1 ring-border/50',
          size === 'md' ? 'w-12 h-12' : 'w-8 h-8'
        )}
      >
        {icon}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.25 }}
        className="space-y-1.5"
      >
        <p className={cn('font-semibold text-foreground', size === 'md' ? 'text-sm' : 'text-xs')}>
          {title}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">{description}</p>
        )}
      </motion.div>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.2 }}
          className="mt-1"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
