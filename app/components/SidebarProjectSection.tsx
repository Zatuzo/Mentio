'use client';

import { useState, useEffect } from 'react';
import { ProjectSwitcher } from './ProjectSwitcher';
import { CreateProjectModal } from './CreateProjectModal';

type Project = { id: string; name: string; role: string };

interface Props {
  projects: Project[];
  currentProjectId: string;
}

export function SidebarProjectSection({ projects, currentProjectId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const handler = () => setModalOpen(true);
    window.addEventListener('open-create-project-modal', handler);
    return () => window.removeEventListener('open-create-project-modal', handler);
  }, []);

  return (
    <>
      <ProjectSwitcher projects={projects} currentProjectId={currentProjectId} />
      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
