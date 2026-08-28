# Testing Workflow

> Status: Referensi untuk Claude (dan developer) tentang bagaimana testing di-approach di project ini.

---

## Prinsip Utama

1. **Claude bisa run tanpa intervensi** — semua test harus bisa dijalankan dengan `npm test` tanpa setup manual.
2. **Test hanya apa yang bisa di-test deterministik** — jangan mock yang tidak perlu di-mock.
3. **Gate sebelum deploy** — CI tidak boleh deploy ke production kalau ada test yang gagal.
4. **Dua lapisan saja** — unit tests untuk logic murni, integration tests untuk API routes. Tidak lebih.

---

## Lapisan Testing

### Lapisan 1 — Unit Tests (Pure Logic)

**Target:** file di `app/lib/` yang tidak punya side effect.

| File | Yang di-test | Status |
|---|---|---|
| `app/lib/messages.ts` | `renderTemplate` — substitusi placeholder | ✅ Ada |
| `app/lib/prompt-builder.ts` | `buildTaskPrompt` — output markdown, edge case null | ✅ Ada |
| `app/lib/claim.ts` | Logika validasi klaim group | ⬜ Belum |
| `app/lib/github.ts` | Parsing response GitHub API | ⬜ Belum |

Tidak butuh DB, tidak butuh WA, tidak butuh auth. Claude tulis → run → fix sampai pass.

### Lapisan 2 — API Route Tests (Integration)

**Target:** semua endpoint di `app/api/` yang punya business logic signifikan.

| Route | Yang di-test | Status |
|---|---|---|
| `POST /api/tasks` | Validasi input, auth guard, groupId validation, priority | ✅ Ada |
| `PATCH /api/tasks/[id]` | Status transition, WA queue, forbidden case, fallback group | ✅ Ada |
| `DELETE /api/tasks/[id]` | Owner vs project member authorization | ✅ Ada |
| `GET /api/health` | Response shape, status code 200/503 | ⬜ Belum |
| `POST /api/summarize` | Auth guard, delegasi ke `runOnce` | ⬜ Belum |

Auth dan Prisma di-mock. Tidak butuh database nyata atau session nyata.

### Yang TIDAK Di-test Otomatis

| Komponen | Kenapa |
|---|---|
| `src/listener.js` | Butuh koneksi WA nyata |
| `src/session-manager.js` | Butuh QR code flow interaktif |
| WA slash commands | Butuh pesan WA masuk |
| `src/reminder-worker.js` | Tergantung waktu real |
| Flow summarize end-to-end | Butuh Claude API (biaya, non-deterministic) |

---

## Setup

### Install

```bash
npm i -D vitest @vitest/coverage-v8 vitest-mock-extended next-test-api-route-handler
```

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

### `tests/setup.ts`

```ts
// Mock Prisma global agar tidak ada koneksi DB saat test
vi.mock('@/app/lib/db', () => ({
  prisma: createPrismaMock(),
}));

// Mock session agar test tidak butuh cookie nyata
vi.mock('@/app/lib/session', () => ({
  getSession: vi.fn(),
}));
```

### Scripts di `package.json`

```json
"test":          "vitest run",
"test:watch":    "vitest",
"test:coverage": "vitest run --coverage"
```

---

## Struktur File Test

```
tests/
  setup.ts                     ← global mock Prisma + session
  lib/
    messages.test.ts           ← renderTemplate
    prompt-builder.test.ts     ← buildTaskPrompt
    claim.test.ts              ← claim logic
  api/
    tasks.test.ts              ← POST /api/tasks
    tasks-id.test.ts           ← PATCH + DELETE /api/tasks/[id]
    health.test.ts             ← GET /api/health
    summarize.test.ts          ← POST /api/summarize
```

---

## Pola Test API Route

Setiap API route test mengikuti pola ini:

```ts
import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/tasks/route';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';

// Shortcut inject session palsu
const mockSession = (user = { id: 'user-1', name: 'Test' }) =>
  vi.mocked(getSession).mockResolvedValue({ user } as any);

describe('POST /api/tasks', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: JSON.stringify({}) });
        expect(res.status).toBe(401);
      },
    });
  });

  it('returns 400 when title is missing', async () => {
    mockSession();
    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ projectId: 'proj-1' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Title required');
      },
    });
  });

  it('creates task and returns it', async () => {
    mockSession();
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({ id: 'm1' } as any);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: 'task-1',
      title: 'Fix bug',
      status: 'todo',
      createdAt: new Date('2026-01-01'),
      dueDate: null,
      group: null,
    } as any);

    await testApiHandler({
      appHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({ title: 'Fix bug', projectId: 'proj-1' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.title).toBe('Fix bug');
        expect(body.status).toBe('todo');
      },
    });
  });
});
```

---

## Pola Test Pure Logic

```ts
import { renderTemplate } from '@/app/lib/messages';

describe('renderTemplate', () => {
  it('replaces placeholders', () => {
    const out = renderTemplate('Halo {name}!', { name: 'Reza' });
    expect(out).toBe('Halo Reza!');
  });

  it('handles null values as empty string', () => {
    const out = renderTemplate('{a}{b}', { a: 'X', b: null });
    expect(out).toBe('X');
  });

  it('leaves unknown placeholders blank', () => {
    const out = renderTemplate('{unknown}', {});
    expect(out).toBe('');
  });
});
```

---

## CI/CD: Gate Sebelum Deploy

File: `.github/workflows/deploy.yml` (update dari `deploy-vps.yml` yang sudah ada)

```yaml
name: Test & Deploy

on:
  push:
    branches: [main]
  workflow_dispatch: {}

concurrency:
  group: deploy-vps
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test          # ← deploy hanya jalan kalau test passed
    runs-on: ubuntu-latest
    steps:
      - name: SSH and run deploy script
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script_stop: true
          script: |
            set -e
            cd ${{ secrets.VPS_APP_DIR }}
            bash scripts/deploy.sh
```

Dengan konfigurasi ini: jika ada satu test gagal di `main`, deploy ke VPS tidak akan berjalan.

---

## Workflow Claude End-to-End

Ini flow yang Claude ikuti saat mengerjakan fitur baru:

```
1. Implementasi kode (app/lib/ atau app/api/)
2. Tulis/update test yang relevan
3. Jalankan: npm test
4. Jika ada failure:
   a. Baca error output
   b. Fix kode atau fix test (tergantung mana yang salah)
   c. Kembali ke langkah 3
5. Semua test pass → git commit + git push
6. GitHub Actions jalankan test di CI
7. Jika CI pass → deploy otomatis ke VPS
```

Claude tidak perlu intervensi dari user di langkah manapun. Satu-satunya trigger dari user adalah instruksi awal: *"Implementasikan fitur X."*

---

## Batasan yang Harus Dipahami

**Test tidak membuktikan fitur bekerja di WA.** Test ini membuktikan:
- Logic di `app/lib/` menghasilkan output yang benar
- API routes mengembalikan status code dan shape yang benar
- Auth guard berfungsi
- Validasi input berfungsi

Untuk membuktikan pesan WA masuk dan mention tersimpan, tetap butuh testing manual atau QA setelah deploy.

---

## Coverage Target

| Layer | Target |
|---|---|
| `app/lib/` | 90%+ (logic murni, harus tinggi) |
| `app/api/` routes kritis | 80%+ (happy path + error case) |
| `src/` workers | Tidak di-target (tidak bisa otomatis) |

Jalankan laporan: `npm run test:coverage`
