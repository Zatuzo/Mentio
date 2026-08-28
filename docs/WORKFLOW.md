# Development Workflow

> Dokumen ini adalah instruksi kerja untuk Claude dan sub-agent di project ini.
> User cukup mendiskusikan fitur → sisanya otomatis.

---

## Ringkasan Alur

```
User mendeskripsi fitur
  └─► Claude (main): diskusi + klarifikasi → plan → coding + tulis test
        └─► Sub-agent: npm test → fix jika gagal → git push
              └─► GitHub Actions: test di CI → deploy ke VPS (jika pass)
```

Empat fase. Setelah user selesai bicara, tidak ada lagi yang perlu dilakukan.

---

## Fase 1 — Discovery (User + Claude)

### Cara Memulai

Cukup deskripsikan fitur dalam bahasa natural. Tidak perlu format khusus. Contoh:

> *"Mau tambah fitur export tasks ke CSV dari halaman project."*

> *"Ada bug: kalau task tidak punya group, notif WA crash."*

> *"Refactor prompt-builder supaya bisa inject digest mingguan."*

### Yang Claude Lakukan

1. **Klarifikasi** — kalau ada ambiguitas, tanyakan maksimal 3 pertanyaan sekaligus, bukan satu-satu.
2. **Echo back** — sebelum coding, Claude meringkas apa yang akan dikerjakan dalam 3-5 poin. User bisa koreksi di sini.
3. **Scope guard** — kalau fitur terlalu besar untuk satu sesi, Claude pecah jadi bagian terkecil yang bisa di-ship sendiri dan tanya mana yang dikerjakan duluan.

### Kapan Lanjut ke Fase 2

Setelah user mengkonfirmasi ringkasan atau tidak ada koreksi dalam 1 reply.

---

## Fase 2 — Planning (Claude)

Claude membuat plan internal sebelum menyentuh kode:

- File mana yang diubah
- File mana yang ditambah
- Apakah ada schema Prisma yang berubah (butuh migration)
- Test mana yang perlu ditulis atau diupdate
- Edge case yang harus ditangani

Plan ini **tidak perlu ditampilkan ke user** kecuali diminta. Langsung lanjut ke coding.

---

## Fase 3 — Coding (Claude)

### Urutan Pengerjaan

```
1. Schema / migration (kalau ada perubahan DB)
2. Business logic (app/lib/ atau src/)
3. API routes (app/api/)
4. UI components (app/ halaman/komponen)
5. Test — tulis atau update bersamaan, bukan setelah selesai
```

### Aturan Coding

- Ikuti pola yang sudah ada di file sekitar. Jangan introduce abstraksi baru kecuali benar-benar perlu.
- Kalau ada Prisma migration, jalankan `npx prisma migrate dev --name <nama>` di lokal sebelum push.
- Jangan ubah file yang tidak relevan dengan fitur (tidak ada "bonus cleanup").
- Tulis test untuk setiap fungsi baru di `app/lib/` dan setiap API route baru.

### Selesai Coding = Siap di-test

Claude tidak push sendiri. Setelah selesai coding, Claude **spawn sub-agent** untuk fase testing dan deploy.

---

## Fase 4 — Testing & Deploy (Sub-agent)

Claude spawn sub-agent dengan instruksi ini (tidak perlu user trigger manual):

### Prompt Sub-agent

```
Kamu adalah test-and-deploy agent untuk project wa-mention-agent.

Working directory: /Users/mac/code/wa-mention-agent

Tugasmu:
1. Jalankan: npm test
2. Jika semua test PASS:
   - git add (file yang berubah saja, bukan git add -A)
   - git commit -m "<deskripsi singkat fitur>"
   - git push origin main
   - GitHub Actions akan handle deploy ke VPS secara otomatis
   - Laporkan: "✅ Test passed. Pushed to main. Deploy berjalan di CI."
3. Jika ada test GAGAL:
   - Baca error output dengan teliti
   - Identifikasi apakah error di kode implementasi atau di test itu sendiri
   - Fix yang salah (maksimal 3 iterasi fix)
   - Setelah fix, jalankan npm test lagi
   - Jika setelah 3 iterasi masih gagal, STOP dan laporkan:
     "❌ Test masih gagal setelah 3 iterasi. Error: [ringkasan error]"
     Jangan push dalam kondisi test gagal.

Jangan lakukan apapun selain yang disebutkan di atas.
Jangan ubah file konfigurasi atau workflow.
Jangan force push.
```

### Yang Sub-agent Tidak Boleh Lakukan

- Push kalau test masih gagal
- Force push (`--force`)
- Ubah `.github/workflows/`
- Commit file secret (`.env`, `auth_info/`, `creds.json`)
- Amend commit yang sudah ada

### Output yang Dilaporkan ke User

Sub-agent selalu laporkan salah satu dari:

```
✅ Test passed (X tests). Pushed ke main.
   Deploy berjalan via GitHub Actions — cek https://github.com/[repo]/actions
```

atau:

```
❌ Test gagal setelah 3 iterasi.
   Error: [ringkasan singkat]
   File bermasalah: [nama file]
   Perlu intervensi manual.
```

---

## GitHub Actions — Gating Deploy

File: `.github/workflows/deploy.yml`

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm test          # ← test wajib pass

  deploy:
    needs: test                # ← deploy hanya kalau test CI pass
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.0.3
        with:
          # ... (secrets tetap sama)
          script: |
            cd ${{ secrets.VPS_APP_DIR }}
            bash scripts/deploy.sh
```

Test dijalankan dua kali: oleh sub-agent di lokal (catch early), dan oleh CI sebelum deploy ke VPS (final gate).

---

## Skenario Khusus

### Prisma Migration

Kalau ada perubahan schema:

```
Claude: prisma migrate dev --name <nama> di lokal
Sub-agent: test tetap jalan seperti biasa
scripts/deploy.sh: prisma migrate deploy (sudah ada) — apply ke DB production
```

Tidak perlu langkah tambahan dari user.

### Hotfix (Bug Kritis di Production)

Sama seperti alur normal. User cukup:
> *"Bug: [deskripsi]. Fix sekarang."*

Claude tidak perlu fase discovery panjang untuk bug yang jelas. Langsung ke fase 3.

### Fitur yang Menyentuh WA Listener (`src/`)

File di `src/` tidak punya unit test otomatis (butuh koneksi WA nyata). Workflow tetap sama, tapi sub-agent hanya test file di `app/`. Setelah deploy, user perlu verify manual di dashboard atau WA.

---

## Referensi Cepat

| Dokumen | Isi |
|---|---|
| `docs/TESTING.md` | Setup Vitest, pola test, coverage target |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `scripts/deploy.sh` | Deploy script di VPS |
| `CLAUDE.md` | Constraint dan arsitektur project |

---

## Checklist Setup (sekali jalan)

Jalankan ini sebelum workflow ini bisa aktif:

```bash
# 1. Install test runner
npm i -D vitest @vitest/coverage-v8 vitest-mock-extended next-test-api-route-handler

# 2. Tambah scripts di package.json:
#    "test": "vitest run"
#    "test:coverage": "vitest run --coverage"

# 3. Buat vitest.config.ts (lihat docs/TESTING.md)

# 4. Buat tests/setup.ts (mock Prisma + session)

# 5. Update .github/workflows/deploy.yml — tambah job test sebagai gate

# 6. Tulis minimal 1 test passing agar CI tidak error dari awal
```

Setelah checklist ini done, workflow di atas aktif sepenuhnya.
