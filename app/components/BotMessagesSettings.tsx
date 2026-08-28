'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { MessageSquare, Loader2, RotateCcw, VolumeX } from 'lucide-react';
import {
  DEFAULT_CLAIM_MESSAGE,
  DEFAULT_TASK_DONE_MESSAGE,
  CLAIM_PLACEHOLDERS,
  TASK_DONE_PLACEHOLDERS,
  renderTemplate,
} from '@/app/lib/messages';

interface Props {
  projectId: string;
  isAdmin: boolean;
  initialClaim: string | null;
  initialTaskDone: string | null;
  initialSilentMode: boolean;
}

// Sample data for live preview.
const PREVIEW_VARS = {
  groupName: 'Tim Backend',
  userName: 'Alice',
  taskTitle: 'Fix login bug',
  requester: 'Bob',
  requesterSuffix: ' (diminta oleh Bob)',
};

export function BotMessagesSettings({
  projectId,
  isAdmin,
  initialClaim,
  initialTaskDone,
  initialSilentMode,
}: Props) {
  const [claim, setClaim] = useState(initialClaim ?? '');
  const [taskDone, setTaskDone] = useState(initialTaskDone ?? '');
  const [silentMode, setSilentMode] = useState(initialSilentMode);
  const [saving, setSaving] = useState(false);

  const claimRef = useRef<HTMLTextAreaElement>(null);
  const taskDoneRef = useRef<HTMLTextAreaElement>(null);

  function insertAtCursor(
    ref: React.RefObject<HTMLTextAreaElement>,
    current: string,
    setter: (s: string) => void,
    placeholder: string
  ) {
    const el = ref.current;
    const token = `{${placeholder}}`;
    if (!el) {
      setter(current + token);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    setter(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          claimMessage: claim,
          taskDoneMessage: taskDone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success('Bot messages saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSilentMode(checked: boolean) {
    setSilentMode(checked);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ silentMode: checked }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      toast.success(checked ? 'Silent mode aktif — bot tidak akan kirim pesan apapun' : 'Silent mode nonaktif');
    } catch (e: any) {
      setSilentMode(!checked);
      toast.error(e.message);
    }
  }

  function resetClaim() {
    setClaim('');
    toast.info('Reset to default — save to apply');
  }
  function resetTaskDone() {
    setTaskDone('');
    toast.info('Reset to default — save to apply');
  }

  const claimEffective = claim.trim() || DEFAULT_CLAIM_MESSAGE;
  const taskDoneEffective = taskDone.trim() || DEFAULT_TASK_DONE_MESSAGE;

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          Bot messages
        </div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {isAdmin ? 'Editable · admin' : 'Read-only'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Customize what the bot replies in WhatsApp groups. Use{' '}
        <code className="text-primary">{'{placeholder}'}</code> — empty fields use the default.
      </p>

      {/* ── Silent mode ── */}
      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <div className="flex items-start gap-2">
          <VolumeX className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <div className="text-sm font-medium">Silent mode</div>
            <div className="text-xs text-muted-foreground">
              Bot tidak akan mengirim pesan apapun ke grup — claim confirmation, notifikasi task,
              reminder, maupun balasan slash command semua dibisukan.
            </div>
          </div>
        </div>
        <Switch checked={silentMode} onCheckedChange={toggleSilentMode} disabled={!isAdmin} />
      </div>

      {/* ── Group claim ── */}
      <div className={`space-y-2 ${silentMode ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="claim-msg">When a group is claimed</Label>
          {isAdmin && claim && (
            <button
              type="button"
              onClick={resetClaim}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-2.5 w-2.5" /> Reset to default
            </button>
          )}
        </div>
        <Textarea
          ref={claimRef}
          id="claim-msg"
          rows={3}
          placeholder={DEFAULT_CLAIM_MESSAGE}
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          disabled={!isAdmin}
          className="font-mono text-xs"
        />
        {isAdmin && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground self-center">Insert:</span>
            {CLAIM_PLACEHOLDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => insertAtCursor(claimRef, claim, setClaim, p)}
                className="text-xs font-mono px-1.5 py-0.5 rounded-md border border-border bg-muted/50 hover:bg-muted/50 hover:border-primary/50"
              >
                {'{'}
                {p}
                {'}'}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2.5 text-xs">
          <div className="text-xs uppercase tracking-wider text-emerald-400/70 mb-1">
            Preview
          </div>
          <div className="whitespace-pre-wrap text-foreground">
            {renderTemplate(claimEffective, PREVIEW_VARS)}
          </div>
        </div>
      </div>

      {/* ── Task done ── */}
      <div className={`space-y-2 pt-2 border-t border-border ${silentMode ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="taskdone-msg">When a task is marked done</Label>
          {isAdmin && taskDone && (
            <button
              type="button"
              onClick={resetTaskDone}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-2.5 w-2.5" /> Reset to default
            </button>
          )}
        </div>
        <Textarea
          ref={taskDoneRef}
          id="taskdone-msg"
          rows={4}
          placeholder={DEFAULT_TASK_DONE_MESSAGE}
          value={taskDone}
          onChange={(e) => setTaskDone(e.target.value)}
          disabled={!isAdmin}
          className="font-mono text-xs"
        />
        {isAdmin && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground self-center">Insert:</span>
            {TASK_DONE_PLACEHOLDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => insertAtCursor(taskDoneRef, taskDone, setTaskDone, p)}
                className="text-xs font-mono px-1.5 py-0.5 rounded-md border border-border bg-muted/50 hover:bg-muted/50 hover:border-primary/50"
              >
                {'{'}
                {p}
                {'}'}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-2.5 text-xs">
          <div className="text-xs uppercase tracking-wider text-emerald-400/70 mb-1">
            Preview
          </div>
          <div className="whitespace-pre-wrap text-foreground">
            {renderTemplate(taskDoneEffective, PREVIEW_VARS)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tips: <code>{'{requesterSuffix}'}</code> sudah include &quot;(diminta oleh ...)&quot; jadi
          spasi otomatis. Untuk format WhatsApp: <code>*bold*</code>, <code>_italic_</code>,{' '}
          <code>~strike~</code>, <code>```mono```</code>.
        </p>
      </div>

      {isAdmin && (
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Save bot messages
        </Button>
      )}
    </div>
  );
}
