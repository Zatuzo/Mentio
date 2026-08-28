import type React from 'react';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}

export function FilterChip({ active, onClick, children, className, badge }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors shrink-0',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40',
        className
      )}
    >
      {children}
      {badge}
    </button>
  );
}
