// Bot reply templates. Stored per-project (Project.claimMessage,
// Project.taskDoneMessage). When null/empty, these defaults are used.
// Templates use {placeholders} replaced by `renderTemplate` below.

export const DEFAULT_CLAIM_MESSAGE =
  '✅ Grup "{groupName}" berhasil diklaim. Mentio sekarang memantau mention di grup ini.';

export const DEFAULT_TASK_DONE_MESSAGE =
  '✅ *Task selesai*\n\n*{taskTitle}*{requesterSuffix}\n\n_Dikirim via Mentio_';

export const CLAIM_PLACEHOLDERS = ['groupName', 'userName'] as const;
export const TASK_DONE_PLACEHOLDERS = [
  'taskTitle',
  'requester',
  'requesterSuffix',
  'userName',
] as const;

export type TemplateVars = Record<string, string | null | undefined>;

/** Replace every `{key}` in `template` with `vars[key]` (null/undefined → ""). */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}
