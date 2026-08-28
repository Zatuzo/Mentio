// CJS mirror of app/lib/messages.ts for the listener. Keep in sync.
const DEFAULT_CLAIM_MESSAGE =
  '✅ Grup "{groupName}" berhasil diklaim. Mentio sekarang memantau mention di grup ini.';

const DEFAULT_TASK_DONE_MESSAGE =
  '✅ *Task selesai*\n\n*{taskTitle}*{requesterSuffix}\n\n_Dikirim via Mentio_';

function renderTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

module.exports = {
  DEFAULT_CLAIM_MESSAGE,
  DEFAULT_TASK_DONE_MESSAGE,
  renderTemplate,
};
