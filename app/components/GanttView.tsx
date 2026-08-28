'use client';

import { useCallback } from 'react';
import {
  GanttProvider,
  GanttHeader,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureRow,
  GanttToday,
  type GanttFeature,
  type GanttStatus,
} from '@/src/components/kibo-ui/gantt';

import { addDays } from 'date-fns';
import type { BoardTask } from './KanbanTaskCard';

const STATUS_MAP: Record<string, GanttStatus> = {
  todo:        { id: 'todo',        name: 'To Do',       color: '#6b7280' },
  in_progress: { id: 'in_progress', name: 'In Progress', color: '#3b82f6' },
  done:        { id: 'done',        name: 'Done',        color: '#10b981' },
};

function taskToFeature(task: BoardTask): GanttFeature | null {
  if (!task.dueDate) return null;
  const endAt = new Date(task.dueDate);
  const startAt = task.startDate ? new Date(task.startDate) : addDays(endAt, -1);
  return {
    id:      task.id,
    name:    task.title,
    startAt,
    endAt,
    status:  STATUS_MAP[task.status] ?? STATUS_MAP.todo,
  };
}

interface Props {
  tasks: BoardTask[];
  onMove: (id: string, startAt: Date, endAt: Date | null) => void;
  onTaskClick: (task: BoardTask) => void;
}

export function GanttView({ tasks, onMove, onTaskClick }: Props) {
  const features = tasks
    .map(taskToFeature)
    .filter((f): f is GanttFeature => f !== null);

  const grouped = tasks.reduce<Record<string, { label: string; features: GanttFeature[] }>>(
    (acc, task) => {
      const key = task.status;
      const label = STATUS_MAP[key]?.name ?? key;
      if (!acc[key]) acc[key] = { label, features: [] };
      const feat = taskToFeature(task);
      if (feat) acc[key].features.push(feat);
      return acc;
    },
    {}
  );

  const statusOrder = ['todo', 'in_progress', 'done'];

  const handleMove = useCallback(
    (id: string, startAt: Date, endAt: Date | null) => {
      onMove(id, startAt, endAt);
    },
    [onMove]
  );

  if (features.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Tidak ada task dengan tanggal yang bisa ditampilkan di Gantt.
        <br />
        Tambahkan due date pada task untuk melihatnya di sini.
      </div>
    );
  }

  return (
    <GanttProvider range="monthly" zoom={100} className="h-full border border-border rounded-lg">
      <GanttSidebar>
        {statusOrder.map((key) => {
          const group = grouped[key];
          if (!group || group.features.length === 0) return null;
          return (
            <GanttSidebarGroup key={key} name={group.label}>
              {group.features.map((feat) => {
                const task = tasks.find((t) => t.id === feat.id);
                return (
                  <GanttSidebarItem
                    key={feat.id}
                    feature={feat}
                    className="cursor-pointer"
                    onSelectItem={() => task && onTaskClick(task)}
                  />
                );
              })}
            </GanttSidebarGroup>
          );
        })}
      </GanttSidebar>
      <div className="relative flex flex-col">
        <GanttHeader />
        <GanttTimeline>
          <GanttToday />
          <GanttFeatureList>
            {statusOrder.map((key) => {
              const group = grouped[key];
              if (!group || group.features.length === 0) return null;
              return (
                <GanttFeatureListGroup key={key}>
                  {/* One GanttFeatureRow per task so rows align with the sidebar */}
                  {group.features.map((feat) => {
                    const task = tasks.find((t) => t.id === feat.id);
                    return (
                      <GanttFeatureRow key={feat.id} features={[feat]} onMove={handleMove}>
                        {() => (
                          <p
                            className="flex-1 truncate text-xs cursor-pointer"
                            onClick={() => task && onTaskClick(task)}
                          >
                            {feat.name}
                          </p>
                        )}
                      </GanttFeatureRow>
                    );
                  })}
                </GanttFeatureListGroup>
              );
            })}
          </GanttFeatureList>
        </GanttTimeline>
      </div>
    </GanttProvider>
  );
}
