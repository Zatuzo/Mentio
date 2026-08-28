export const en = {
  // ── Navigation ──
  nav_dashboard: 'Dashboard',
  nav_inbox: 'Inbox',
  nav_brain: 'Brain',
  nav_canvas: 'Canvas',
  nav_ai_agent: 'AI Agent',
  nav_calendar: 'Calendar',
  nav_analytics: 'Analytics',
  nav_settings: 'Settings',
  nav_admin: 'Admin',
  nav_groups_in_project: 'Groups in Project',
  nav_no_groups: 'No groups in this project yet',

  // ── Settings nav ──
  settings_title: 'Settings',
  settings_whatsapp: 'WhatsApp',
  settings_project: 'Project',
  settings_team: 'Team',
  settings_integrations: 'Integrations',
  settings_brain: 'Brain',
  settings_ai_manage: 'AI Manage',
  settings_developer: 'Developer',
  settings_appearance: 'Appearance',

  // ── Appearance page ──
  appearance_title: 'Appearance',
  appearance_desc: 'Customize the look and feel of the app.',
  appearance_theme: 'Theme',
  appearance_theme_desc: 'Choose a theme that matches your style.',
  appearance_language: 'Language',
  appearance_language_desc: 'Select your preferred language.',

  // ── Themes ──
  theme_dark: 'Dark',
  theme_light: 'Light',
  theme_brutalism: 'Brutalism',
  theme_nord: 'Nord',
  theme_mocha: 'Mocha',
  theme_sunset: 'Sunset',

  // ── Languages ──
  lang_en: 'English',
  lang_id: 'Bahasa Indonesia',

  // ── Common ──
  btn_save: 'Save',
  btn_cancel: 'Cancel',
  btn_connect: 'Connect',
  btn_disconnect: 'Disconnect',
  btn_sign_out: 'Sign out',
  btn_add: 'Add',
  btn_remove: 'Remove',
  btn_delete: 'Delete',
  btn_edit: 'Edit',
  btn_create: 'Create',
  btn_update: 'Update',
  btn_close: 'Close',
  btn_confirm: 'Confirm',
  btn_back: 'Back',
  btn_next: 'Next',
  btn_generate: 'Generate',
  btn_summarize: 'Summarize',

  // ── Status ──
  wa_connected: 'WhatsApp connected',
  wa_disconnected: 'WhatsApp disconnected',

  // ── Sidebar ──
  sidebar_plan_free: 'free',
  sidebar_plan_pro: 'pro',

  // ── Task agent status ──
  task_agent_running: 'Agent working…',
  task_agent_pr_ready: 'PR ready',
  task_agent_failed: 'Agent failed',

  // ── Kanban filters ──
  filter_only_mine: 'Only mine',
} as const;

export type TranslationKey = keyof typeof en;
