import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function freshWatsonxModule() {
  vi.resetModules();
  return import('@/app/lib/watsonx');
}

describe('classifyMessage', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it('returns null without throwing when not configured', async () => {
    delete process.env.WATSONX_PROJECT_ID;
    delete process.env.WATSONX_API_KEY;
    const { classifyMessage } = await freshWatsonxModule();
    await expect(classifyMessage('any message')).resolves.toBeNull();
  });

  it('exchanges an IAM token then classifies via text/generation', async () => {
    process.env.WATSONX_API_KEY = 'fake-key';
    process.env.WATSONX_PROJECT_ID = 'fake-project';

    const fetchMock = vi.fn(async (url: string, opts: any) => {
      if (url.includes('iam.cloud.ibm.com')) {
        return { ok: true, json: async () => ({ access_token: 'tok-123', expires_in: 3600 }) };
      }
      if (url.includes('/ml/v1/text/generation')) {
        expect(opts.headers.Authorization).toBe('Bearer tok-123');
        return { ok: true, json: async () => ({ results: [{ generated_text: ' urgent\n' }] }) };
      }
      throw new Error(`unexpected fetch to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { classifyMessage } = await freshWatsonxModule();
    await expect(classifyMessage('tolong benerin server sekarang, urgent!')).resolves.toBe('urgent');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null (not a throw) when the generation call fails', async () => {
    process.env.WATSONX_API_KEY = 'fake-key';
    process.env.WATSONX_PROJECT_ID = 'fake-project';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('iam.cloud.ibm.com')) {
          return { ok: true, json: async () => ({ access_token: 'tok-123', expires_in: 3600 }) };
        }
        return { ok: false, status: 500 };
      })
    );

    const { classifyMessage } = await freshWatsonxModule();
    await expect(classifyMessage('x')).resolves.toBeNull();
  });
});
