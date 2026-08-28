'use client';

import { useState } from 'react';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Project = { id: string; name: string };

export function ProjectSwitcher({
  projects,
  currentProjectId,
}: {
  projects: Project[];
  currentProjectId: string;
}) {
  const [open, setOpen] = useState(false);
  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="w-full flex items-center justify-between rounded-md px-3 py-2.5 bg-card/50 border border-border hover:bg-muted/80 transition-colors text-left"
      >
        <div className="flex flex-col items-start min-w-0">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Workspace</span>
          <span className="truncate font-semibold text-sm">{currentProject?.name ?? 'Select project'}</span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56">
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => {
              document.cookie = `mentio_project_id=${project.id}; path=/; max-age=31536000`;
              window.location.href = '/';
            }}
          >
            <span className="flex-1 truncate">{project.name}</span>
            {currentProjectId === project.id && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent('open-create-project-modal'));
          }}
          className="text-primary font-medium"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
