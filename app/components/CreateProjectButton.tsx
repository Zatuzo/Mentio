'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreateProjectModal } from './CreateProjectModal';
import { FolderPlus } from 'lucide-react';

interface Props {
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

/** Self-contained "Create Project" button — opens its own modal, no external wiring. */
export function CreateProjectButton({ label = 'Create Project', variant = 'default' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <FolderPlus className="w-4 h-4" />
        {label}
      </Button>
      <CreateProjectModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
