'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface Props {
  spaceId: string;
  variant?: 'default' | 'outline' | 'ghost';
  label?: string;
}

export function NewNoteButton({ spaceId, variant = 'default', label }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, title: 'Untitled', content: '' }),
      });
      const note = await res.json();
      router.push(`/brain/notes/${note.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant={variant} onClick={create} disabled={loading}>
      <Plus className="w-4 h-4 mr-1" />
      {label ?? 'New note'}
    </Button>
  );
}
