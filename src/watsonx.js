// IBM watsonx.ai integration — classifies a WA message into a coarse
// category so the inbox can be triaged at a glance, independently of the
// DeepSeek-powered summarizer/task-extraction pipeline.
//
// Entirely optional: without WATSONX_PROJECT_ID / WATSONX_API_KEY set,
// classifyMessage() resolves to null and the caller just skips tagging.
//
// Two calls happen against IBM Cloud:
//   1. Exchange WATSONX_API_KEY for a short-lived IAM bearer token.
//   2. POST the classification prompt to the watsonx.ai text/generation API.
// See: https://cloud.ibm.com/apidocs/watsonx-ai

const CATEGORIES = ['request', 'question', 'urgent', 'info', 'other'];

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const WATSONX_API_VERSION = '2024-05-01';
const REQUEST_TIMEOUT_MS = 8_000; // classification is best-effort — don't let a slow IBM response hang around

let cachedToken = null; // { value, expiresAt }

async function getIamToken() {
  const apiKey = process.env.WATSONX_API_KEY;
  if (!apiKey) return null;

  // Reuse the cached token until shortly before it actually expires.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const res = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`watsonx IAM token request failed: HTTP ${res.status}`);

  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

// Classify a single WA message into one of CATEGORIES.
// Returns null when the integration isn't configured, or when anything
// about the request fails — classification is best-effort, never fatal.
async function classifyMessage(text) {
  const projectId = process.env.WATSONX_PROJECT_ID;
  const baseUrl = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';
  const modelId = process.env.WATSONX_MODEL_ID || 'ibm/granite-13b-instruct-v2';

  if (!projectId || !text) return null;

  try {
    const token = await getIamToken();
    if (!token) return null;

    const prompt = `Classify the following WhatsApp message into exactly one category: ${CATEGORIES.join(', ')}.
Respond with ONLY the category word, nothing else.

Message: "${text}"`;

    const res = await fetch(`${baseUrl}/ml/v1/text/generation?version=${WATSONX_API_VERSION}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model_id: modelId,
        project_id: projectId,
        input: prompt,
        parameters: { decoding_method: 'greedy', max_new_tokens: 5, temperature: 0 },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[watsonx] classify request failed: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const raw = (data.results?.[0]?.generated_text || '').trim().toLowerCase();
    return CATEGORIES.find((c) => raw.includes(c)) || 'other';
  } catch (err) {
    console.error('[watsonx] classify error:', err.message);
    return null;
  }
}

module.exports = { classifyMessage, CATEGORIES };
