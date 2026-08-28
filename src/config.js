require('dotenv').config();

const MY_JID = process.env.MY_JID || '';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const SUMMARY_CRON = process.env.SUMMARY_CRON || '0 */4 * * *';
const TASK_EMOJI = process.env.TASK_EMOJI || '📌';

function assertConfig() {
  if (!MY_JID) throw new Error('MY_JID is required (e.g. 62xxx@s.whatsapp.net)');
}

module.exports = {
  MY_JID,
  DEEPSEEK_API_KEY,
  DEEPSEEK_MODEL,
  SUMMARY_CRON,
  TASK_EMOJI,
  assertConfig,
};
