'use client';

import { useState } from 'react';
import { Download, Copy, FileText, FileSpreadsheet, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BoardTask } from './KanbanTaskCard';

interface Props {
  tasks: BoardTask[];
  projectName?: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low', none: '-',
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeCsv(val: unknown): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function tasksToText(tasks: BoardTask[], projectName?: string): string {
  const lines: string[] = [];
  if (projectName) lines.push(`# ${projectName}`, '');

  const byStatus = tasks.reduce<Record<string, BoardTask[]>>((acc, t) => {
    const key = t.status;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  for (const [status, group] of Object.entries(byStatus)) {
    lines.push(`## ${status.replace('_', ' ').toUpperCase()}`);
    for (const t of group) {
      lines.push(`- [${t.title}]`);
      if (t.description) lines.push(`  ${t.description}`);
      const meta: string[] = [];
      if (t.assignedTo) meta.push(`Assignee: ${t.assignedTo.name}`);
      if (t.priority && t.priority !== 'none') meta.push(`Priority: ${PRIORITY_LABEL[t.priority]}`);
      if (t.dueDate) meta.push(`Due: ${fmtDate(t.dueDate)}`);
      if (t.group) meta.push(`Group: ${t.group.name}`);
      if (t.requester) meta.push(`Requester: ${t.requester}`);
      if (meta.length) lines.push(`  ${meta.join(' · ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function tasksToCsv(tasks: BoardTask[]): string {
  const header = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Assignee', 'Group', 'Requester', 'Start Date', 'Due Date', 'Created At'];
  const rows = tasks.map((t) => [
    t.id,
    t.title,
    t.description ?? '',
    t.status,
    PRIORITY_LABEL[t.priority] ?? t.priority,
    t.assignedTo?.name ?? '',
    t.group?.name ?? '',
    t.requester ?? '',
    fmtDate(t.startDate),
    fmtDate(t.dueDate),
    fmtDate(t.createdAt),
  ]);
  return [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printTasks(tasks: BoardTask[], projectName?: string) {
  const byStatus = tasks.reduce<Record<string, BoardTask[]>>((acc, t) => {
    const key = t.status;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const rows = Object.entries(byStatus).flatMap(([status, group]) =>
    group.map((t, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${group.length}" style="background:#f5f5f5;font-weight:600;text-transform:capitalize;vertical-align:top;padding:8px">${status.replace('_', ' ')}</td>` : ''}
        <td>${t.title}</td>
        <td>${t.description ?? ''}</td>
        <td>${PRIORITY_LABEL[t.priority] ?? '-'}</td>
        <td>${t.assignedTo?.name ?? '-'}</td>
        <td>${t.group?.name ?? '-'}</td>
        <td>${t.requester ?? '-'}</td>
        <td>${fmtDate(t.dueDate)}</td>
      </tr>`)
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${projectName ?? 'Tasks'}</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    p { color: #666; margin-top: 0; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #111; color: #fff; text-align: left; padding: 8px; font-size: 11px; }
    td { border-bottom: 1px solid #e5e5e5; padding: 7px 8px; vertical-align: top; }
    tr:hover td { background: #fafafa; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>${projectName ?? 'Task Export'}</h1>
  <p>${tasks.length} tasks · Exported ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  <table>
    <thead>
      <tr>
        <th>Status</th><th>Title</th><th>Description</th><th>Priority</th>
        <th>Assignee</th><th>Group</th><th>Requester</th><th>Due Date</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

export function ExportTasksButton({ tasks, projectName }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = tasksToText(tasks, projectName);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Disalin ke clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCsv = () => {
    const csv = tasksToCsv(tasks);
    const name = (projectName ?? 'tasks').toLowerCase().replace(/\s+/g, '-');
    downloadFile(csv, `${name}-export.csv`, 'text/csv;charset=utf-8;');
    toast.success('CSV diunduh');
  };

  const handlePrint = () => {
    printTasks(tasks, projectName);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        title="Export tasks"
      >
        <Download className="w-3 h-3" />
        Export
        <ChevronDown className="w-3 h-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleCopy} className="gap-2.5 text-sm cursor-pointer">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          Copy as text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCsv} className="gap-2.5 text-sm cursor-pointer">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint} className="gap-2.5 text-sm cursor-pointer">
          <FileText className="w-3.5 h-3.5" />
          Print / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
