// TypeScript mirror of src/watsonx.js — see that file for the full
// explanation of the IBM watsonx.ai integration. Duplicated for the same
// reason as app/lib/crypto.ts: the listener runs as a plain Node script and
// can't import a .ts module directly.

export const CATEGORIES = ['request', 'question', 'urgent', 'info', 'other'] as const;
export type MentionCategory = (typeof CATEGORIES)[number];

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const WATSONX_API_VERSION = '2024-05-01';
const REQUEST_TIMEOUT_MS = 8_000; // classification is best-effort — don't let a slow IBM response hang around

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getIamToken(): Promise<string | null> {
  const apiKey = process.env.WATSONX_API_KEY;
  if (!apiKey) return null;

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

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export async function classifyMessage(text: string | null | undefined): Promise<MentionCategory | null> {
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

    const data = (await res.json()) as { results?: { generated_text?: string }[] };
    const raw = (data.results?.[0]?.generated_text || '').trim().toLowerCase();
    return (CATEGORIES.find((c) => raw.includes(c)) as MentionCategory | undefined) ?? 'other';
  } catch (err) {
    console.error('[watsonx] classify error:', err instanceof Error ? err.message : err);
    return null;
  }
}
