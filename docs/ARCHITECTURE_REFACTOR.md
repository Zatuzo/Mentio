# Architecture Refactor Plan

> Status: **Deferred** — dikerjakan setelah fase debug production + inovasi fitur selesai, sebelum launch publik.
>
> Dokumen ini adalah hutang teknis yang sudah diidentifikasi. Jangan dikerjakan sambil lalu — lakukan sebagai sprint tersendiri.

---

## Konteks

Arsitektur saat ini cukup untuk fase development dan early testing. Ada beberapa masalah yang tidak akan mengganggu sekarang tapi **akan menjadi bottleneck saat launch** atau menimbulkan risiko data.

Prioritas sebelum launch:
1. ~~Debug production~~ (fase sekarang)
2. ~~Inovasi fitur~~ (fase sekarang)
3. **Architecture refactor** ← dokumen ini
4. Launch

---

## Item 1 — Pisahkan DB Local vs Production 🔴

**Risiko:** Tinggi | **Effort:** Kecil

### Masalah sekarang
`DATABASE_URL` di `.env` local dan `.env` VPS menunjuk ke instance Neon yang sama. Satu query yang salah dari local development bisa corrupt data production.

### Fix
Buat Neon **branch** terpisah untuk development:

```
Neon project
├── main branch     → DATABASE_URL production (VPS)
└── dev branch      → DATABASE_URL local (laptop)
```

Neon branch gratis dan instantly fork dari main — data awal sama, perubahan tidak saling pengaruh.

**Langkah:**
1. Buka Neon dashboard → project → Branches → Create branch dari `main`
2. Nama: `dev`
3. Copy connection string branch `dev`
4. Update `.env` local → pakai connection string `dev`
5. VPS `.env` tetap pakai `main`

**Tambahan:** update `.env.example` dengan placeholder yang jelas mana production mana dev.

---

## Item 2 — Ganti `db push` ke Migration Proper 🔴

**Risiko:** Tinggi (silent data loss) | **Effort:** Sedang

### Masalah sekarang
`scripts/deploy.sh` pakai `prisma db push --accept-data-loss`. Flag ini bisa **drop column atau tabel** kalau schema berubah tanpa migration yang deliberate. Tidak ada rollback path.

Root cause: `prisma migrate deploy` timeout di Neon karena advisory lock.

### Fix
Dua langkah:

**Step 1:** Tambah `connect_timeout` ke `DATABASE_URL_UNPOOLED` agar advisory lock tidak timeout:
```
DATABASE_URL_UNPOOLED=...neon.tech/neondb?sslmode=require&connect_timeout=30
```

**Step 2:** Ganti `deploy.sh`:
```bash
# Ganti ini:
npx prisma db push --skip-generate --accept-data-loss

# Dengan ini:
npx prisma migrate deploy
```

**Step 3:** Workflow migration baru (menggantikan yang di DEPLOY.md):
```bash
# Di local, saat ada schema change:
npx prisma migrate dev --name nama_perubahan
# Commit migration file ke git
# Push → CI deploy → prisma migrate deploy di VPS
```

**Kenapa penting:** tanpa ini, setiap deploy yang menyentuh schema adalah operasi berisiko.

---

## Item 3 — Pisahkan Workers ke TypeScript 🟡

**Risiko:** Sedang (maintainability) | **Effort:** Besar

### Masalah sekarang
```
app/          → TypeScript, ESM-compatible, type-safe
src/          → Plain JavaScript CommonJS, no types
package.json  → "type": "commonjs" (akibat src/)
```

`src/listener.js`, `src/summarizer.js`, `src/reminder-worker.js`, dll tidak punya type safety. Bug tipe data tidak terdeteksi sampai runtime. Sulit untuk Claude refactor dengan confidence karena tidak ada type hints.

### Fix
Migrasi `src/` ke TypeScript secara bertahap:

```
Prioritas migrasi:
1. src/summarizer.js   → app/workers/summarizer.ts
2. src/reminder-worker.js → app/workers/reminder.ts
3. src/listener.js     → app/workers/listener.ts (paling kompleks, terakhir)
```

Setelah semua pindah:
- Hapus `"type": "commonjs"` dari `package.json`
- Update PM2 config untuk jalankan `ts-node` atau compiled output
- Update CI/CD

---

## Item 4 — Perbaiki MessageQueue 🟡

**Risiko:** Sedang (reliability) | **Effort:** Sedang

### Masalah sekarang
`MessageQueue` di PostgreSQL adalah polling-based queue yang naive:
- Tidak ada retry dengan exponential backoff
- Tidak ada dead letter queue — message gagal stuck di `status=failed`
- Kalau worker crash saat processing, message bisa stuck di `status=pending` selamanya
- Tidak ada visibility timeout (dua worker bisa process message yang sama)

### Fix opsi A — Perbaiki MessageQueue yang ada (recommended dulu)
Tambah field ke `MessageQueue`:
```prisma
model MessageQueue {
  ...
  nextRetryAt DateTime?   // kapan boleh di-retry
  errorMsg    String?     // last error message
  maxAttempts Int @default(3)
}
```

Update worker untuk:
- Set `nextRetryAt` dengan exponential backoff saat gagal
- Skip message yang `attempts >= maxAttempts` (dead letter)
- Gunakan transaction + pessimistic lock saat ambil message

### Fix opsi B — Migrasi ke BullMQ + Redis (kalau scale > 50 user)
Overkill untuk sekarang, tapi clean. Pertimbangkan saat sudah ada trafik signifikan.

---

## Item 5 — Error Monitoring 🟡

**Risiko:** Rendah-sedang | **Effort:** Kecil

### Masalah sekarang
Tidak ada visibility kalau ada error di production selain manual `pm2 logs`. Tidak tahu berapa banyak user yang kena error, error apa yang paling sering.

### Fix
Pasang Sentry (free tier cukup untuk fase ini):

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Yang penting di-capture:
- Unhandled errors di API routes
- WA listener disconnect / reconnect events
- Summarizer failures
- MessageQueue dead letters

---

## Item 6 — Staging Environment 🟢

**Risiko:** Rendah | **Effort:** Sedang

### Masalah sekarang
Tidak ada staging. Setiap push ke `main` langsung ke production. Tidak ada tempat untuk test end-to-end sebelum user nyata terdampak.

### Fix
Tambah branch `staging` dengan workflow terpisah:

```
main      → deploy otomatis ke production VPS
staging   → deploy otomatis ke staging VPS (atau subdomain berbeda)
```

Neon branch `dev` dipakai untuk staging juga, atau buat branch ketiga `staging`.

**Prerequisite:** Item 1 (pisah DB) harus selesai dulu.

---

## Urutan Pengerjaan yang Direkomendasikan

```
Sprint Refactor (sebelum launch):

Week 1:
  [x] Item 1 — Pisah DB local vs production   (1-2 jam)
  [x] Item 2 — Fix migration (connect_timeout + migrate deploy)   (2-3 jam)

Week 2:
  [ ] Item 4 — Perbaiki MessageQueue retry logic   (3-4 jam)
  [ ] Item 5 — Pasang Sentry   (1 jam)

Post-launch (kalau trafik naik):
  [ ] Item 3 — Migrasi workers ke TypeScript   (1-2 hari)
  [ ] Item 6 — Staging environment   (setengah hari)
```

---

## Yang TIDAK Perlu Dilakukan Sebelum Launch

- Docker — tidak ada kebutuhan containerization saat ini
- Kubernetes / container orchestration — over-engineering
- Microservices — monolith sudah cukup untuk skala ini
- Redis/BullMQ — MessageQueue fix (Item 4 opsi A) sudah cukup
- Horizontal scaling — single VPS cukup untuk ratusan user
