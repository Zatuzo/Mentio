const BASE_URL = process.env.MENTIO_BASE_URL ?? 'http://localhost:3000';
const API_KEY = process.env.MENTIO_API_KEY ?? '';

async function apiFetch(path: string, opts?: RequestInit) {
  const url = `${BASE_URL}/api/mcp${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...opts?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MCP API ${res.status}: ${body}`);
  }

  return res.json();
}

export const api = {
  get: (path: string) => apiFetch(path),
  post: (path: string, body: unknown) =>
    apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
