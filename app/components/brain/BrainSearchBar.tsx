'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function BrainSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && q.trim().length >= 2) {
      router.push(`/brain/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (!q) router.prefetch('/brain/search'); }}
        placeholder="Search notes, mentions, tasks… (Enter)"
        className="w-full pl-9 pr-4 h-9 rounded-lg border border-white/10 bg-white/[0.05] text-sm outline-none focus:border-white/20 focus:bg-white/[0.07] placeholder:text-muted-foreground/40 transition-all cursor-text"
      />
    </div>
  );
}
