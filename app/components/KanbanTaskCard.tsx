'use client';

import type React from 'react';
import { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Trash2, Sparkles, Bot, Loader2, GitPullRequest } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useT } from '@/lib/i18n';

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  requester: string | null;
  createdAt: Date | string;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  group: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; image: string | null } | null;
  mention?: {
    id: string;
    text: string;
    senderName: string | null;
    senderJid: string;
    timestamp: Date | string;
  } | null;
  imageUrls?: string[];
  // Agent fields
  agentEnabled?: boolean;
  agentStatus?: string | null;
  agentResult?: string | null;
  agentPrUrl?: string | null;
  agentBranch?: string | null;
  agentError?: string | null;
  agentStartedAt?: Date | string | null;
  agentFinishedAt?: Date | string | null;
  agentLog?: string | null;
};

export const PRIORITY_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  urgent: { label: 'Urgent', dot: 'bg-red-500',              text: 'text-destructive' },
  high:   { label: 'High',   dot: 'bg-orange-400',           text: 'text-orange-400' },
  medium: { label: 'Medium', dot: 'bg-yellow-400',           text: 'text-yellow-400' },
  low:    { label: 'Low',    dot: 'bg-blue-400',             text: 'text-blue-400' },
  none:   { label: 'None',   dot: 'bg-muted-foreground/30',  text: 'text-muted-foreground/50' },
};

interface Props {
  task: BoardTask;
  index: number;
  onDelete: (id: string) => void;
  onGeneratePrompt: (task: BoardTask) => void;
  onOpen: (task: BoardTask) => void;
}

export function KanbanTaskCard({ task, index, onDelete, onGeneratePrompt, onOpen }: Props) {
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
  const t = useT();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              &ldquo;{task.title}&rdquo; will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('btn_cancel')}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(task.id);
                setDeleteOpen(false);
              }}
            >
              {t('btn_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={provided.draggableProps.style as React.CSSProperties}
            onClick={() => {
              if (snapshot.isDragging) return;
              onOpen(task);
            }}
            className={`group bg-card border border-border rounded-md p-2.5 mb-2 shadow-sm cursor-grab active:cursor-grabbing ${
              snapshot.isDragging
                ? 'shadow-xl border-primary/50 rotate-1 scale-[1.02] opacity-95'
                : 'transition-[box-shadow,border-color,opacity] duration-150 hover:border-border/80 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {task.group ? (
                  <Badge variant="outline" className="text-xs h-4 px-1.5 bg-muted/50 border-border font-normal shrink-0">
                    {task.group.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs h-4 px-1.5 bg-muted/30 border-border/50 font-normal shrink-0 text-muted-foreground">
                    Manual
                  </Badge>
                )}
                {task.requester && (
                  <span className="text-xs text-muted-foreground truncate max-w-[90px]" title={task.requester}>
                    {task.requester}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-primary"
                  title="Generate coding prompt"
                  onClick={(e) => { e.stopPropagation(); onGeneratePrompt(task); }}
                >
                  <Sparkles className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <h4 className="text-sm font-medium text-foreground leading-snug">{task.title}</h4>

            {/* Agent status badge */}
            {task.agentStatus === 'running' && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-primary font-medium">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {t('task_agent_running')}
              </div>
            )}
            {task.agentStatus === 'done' && task.agentPrUrl && (
              <a
                href={task.agentPrUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 mt-1.5 text-[10px] text-primary hover:underline font-medium"
              >
                <GitPullRequest className="h-2.5 w-2.5" />
                {t('task_agent_pr_ready')}
              </a>
            )}
            {task.agentStatus === 'failed' && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-destructive font-medium">
                <Bot className="h-2.5 w-2.5" />
                {t('task_agent_failed')}
              </div>
            )}

            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1 leading-relaxed">
                {task.description}
              </p>
            )}

            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>{new Date(task.createdAt).toLocaleDateString()}</span>
              <div className="flex items-center gap-1.5">
                {task.dueDate && (
                  <span className={`px-1.5 py-0.5 rounded-md ${
                    new Date(task.dueDate) < new Date() && task.status !== 'done'
                      ? 'text-destructive bg-destructive/10'
                      : 'text-primary/80 bg-primary/10'
                  }`}>
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
                {task.assignedTo && (
                  <div
                    className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0 overflow-hidden border border-border"
                    title={task.assignedTo.name}
                  >
                    {task.assignedTo.image ? (
                      <img src={task.assignedTo.image} alt={task.assignedTo.name} className="w-full h-full object-cover" />
                    ) : (
                      task.assignedTo.name.charAt(0).toUpperCase()
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Draggable>
    </>
  );
}
