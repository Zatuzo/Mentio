# Agent Integration Plan

> Dibuat: 2026-05-25
> Status: Draft — belum ada keputusan final

---

## Latar Belakang

Diskusi ini muncul dari pertanyaan: *"Bagaimana agar tools ini bisa terhubung langsung dengan AI coding agent seperti Claude Code, Gemini CLI, Cursor?"*

Dari sana berkembang ke pertanyaan yang lebih besar: apakah kita butuh agent yang berjalan otonom, bukan hanya alat bantu developer?

---

## Summary Percakapan

### 1. MCP Server — untuk developer tooling
- MCP (Model Context Protocol) adalah standar open yang dipakai Claude Code, Cursor, Gemini CLI, dll.
- MCP expose **Tools** (fungsi), **Resources** (data), **Prompts** (template) ke agent.
- **Batasan kritis**: MCP hanya bekerja jika user sedang aktif membuka IDE/agent. Tidak bisa auto-trigger dari luar.
- Kesimpulan: MCP cocok untuk **kamu sebagai developer** yang butuh query data ad-hoc dari IDE, bukan untuk automation produksi.

### 2. Agent Worker Headless — untuk automation
- Untuk skenario "mention masuk → agent otomatis jalan", butuh **backend worker** yang spawn agent secara programmatic.
- Bisa pakai: Claude Agent SDK, Vercel AI SDK (multi-provider), LangChain, dll.
- **Vercel AI SDK** paling cocok karena stack sudah Next.js dan bisa swap provider via string.
- Worker bisa di-trigger 3 cara: event-driven (WA listener), dashboard button, cron schedule.

### 3. Agent Worker bukan hanya untuk Claude
- Arsitektur worker headless provider-agnostic.
- Yang berubah hanya string model: `"anthropic/claude-sonnet-4-6"` → `"google/gemini-2.5-pro"` → `"openai/gpt-5"`.
- Tool definitions, prompt logic, semua tetap sama.

### 4. Banyak pertimbangan sebelum implement
Diskusi melambat di sini karena ada banyak keputusan yang belum dijawab (lihat bagian open questions di bawah).

---

## Keputusan Arsitektur yang Sudah Jelas

| Keputusan | Pilihan |
|---|---|
| MCP server | Ya, tapi scope terbatas: developer tooling saja |
| Agent loop level | Level 2 (tool-using), bukan Level 3 (autonomous loop) |
| Baileys sending | **TIDAK** — listener only, sesuai constraint CLAUDE.md |
| Batch vs real-time | Batch tetap default, real-time hanya untuk flag URGENT |
| Provider | Mulai dengan Claude (sudah ada di repo), migrasi ke AI SDK kalau butuh multi-provider |

---

## Resiko yang Harus Dijaga

1. **Baileys unofficial** — jangan kasih agent kemampuan kirim pesan WA, resiko ban akun.
2. **Prompt injection** — mention dari orang lain adalah untrusted input. Jangan masukkan langsung ke system prompt tanpa sanitasi.
3. **Cost runaway** — agent loop bisa tak terduga. Wajib set `maxSteps`, `maxTokens`, billing alert.
4. **Privasi** — isi mention sensitif, hati-hati data yang keluar ke cloud LLM.
5. **Reversibility** — setiap tool harus dikategorikan: safe / reversible / irreversible. Yang irreversible butuh human approval.

---

## Open Questions (Belum Dijawab)

Ini yang harus dijawab sebelum mulai coding:

1. **Siapa user agent ini?**
   - [ ] Kamu sendiri (developer)
   - [ ] Tim/kolega
   - [ ] End-user yang akses dashboard

2. **Apa 1-3 use case konkret yang paling diinginkan?**
   - Contoh format: *"Ketika X terjadi, agent melakukan Y, hasilnya Z"*

3. **Apa yang agent boleh lakukan?**
   - [ ] Read-only (query mention, summary)
   - [ ] Write ke DB internal (buat task, tag mention)
   - [ ] Trigger workflow internal (kirim reminder)
   - [ ] Call external API (Slack, email, notif push)

4. **Budget LLM per bulan?** → menentukan strategi model (Haiku vs Sonnet, caching aggressiveness)

5. **Apakah butuh human-in-the-loop** untuk aksi tertentu, atau fully automated?

---

## Next Steps (setelah open questions dijawab)

```
[ ] Jawab 5 open questions di atas
[ ] Tulis 3 user story konkret
[ ] Tentukan tool list final (dengan kategori safe/reversible/irreversible)
[ ] Scaffold lib/agent-tools.ts — shared tool logic
[ ] Scaffold mcp-server.ts — thin wrapper untuk developer tooling
[ ] Scaffold worker/agent-worker.ts — headless agent untuk automation
[ ] Tambah /api/agent endpoint di Next.js untuk dashboard trigger
[ ] Set up billing alert + maxSteps guard
```

---

## Referensi

- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Vercel AI SDK — generateText dengan tools](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text)
- [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code/sdk)
- [Prompt injection di agentic systems](https://simonwillison.net/2023/Apr/25/dual-llm-pattern/)

---

# Optional WhatsApp Userflow

> Ditambahkan: 2026-05-25
> Status: Plan final — siap implementasi

---

## Latar Belakang

WhatsApp listener adalah userflow utama. Namun ada potensi user yang ingin memakai app ini sebagai alternatif gratis dari Jira — tanpa perlu menyambungkan WhatsApp sama sekali. WA connection harus opsional dan bisa disambungkan kapan saja.

---

## Keputusan Arsitektur

| Keputusan | Pilihan |
|---|---|
| WA listener | Tetap sebagai userflow utama |
| Task tanpa WA | Didukung penuh — `groupId` menjadi nullable |
| WA connection | Opsional, bisa disambung kapan saja dari Settings |
| Task dari WA | Tetap masuk dengan `groupId` terisi seperti biasa |

---

## Perubahan yang Diperlukan

### 1. Schema (Prisma)
- `Task.groupId String` → `String?` (nullable)
- Jalankan migration baru

### 2. API

| Endpoint | Perubahan |
|---|---|
| `POST /api/tasks` | Baru — buat task manual (title, description, status, dueDate, projectId) |
| `PATCH /api/tasks/[id]` | Fix: skip WA notification queue jika `groupId` null |
| `POST /api/groups/claim` | Tambah: tawarkan adopt task `groupId = null` di project yang sama |
| WA command handler | Fix: fallback lookup by `projectId` jika task tidak ditemukan by `groupId` |

### 3. UI

| Komponen | Perubahan |
|---|---|
| `KanbanBoard` | Wire tombol `+` di tiap kolom ke `CreateTaskModal` |
| `CreateTaskModal` | Baru — form: title, description, due date; status pre-filled dari kolom |
| `KanbanTaskCard` | Handle task tanpa group (sembunyikan badge group jika null) |
| `TaskDetailPanel` | Handle task tanpa group |
| `DashboardStats` | Fix: scope query by `projectId`, bukan `groupId` |
| Settings → WhatsApp | Tambah banner "Hubungkan WhatsApp untuk auto-capture mention" (non-blocking) |

---

## Bug yang Sudah Diidentifikasi & Fix-nya

### Bug 1 — Task "yatim" setelah WA disambungkan
**Skenario:** User punya task manual (groupId null) di Project X. Lalu claim group "Dev Team" dan link ke Project X.

**Masalah:** Task lama tetap `groupId = null` — tidak muncul di `/group/[id]`, tidak ketemu dari WA slash command.

**Fix:** Saat group di-claim dan di-link ke project → tawarkan adopt task `groupId = null` dalam project tersebut (set `groupId` mereka ke group yang baru di-claim).

---

### Bug 2 — Crash/silent fail saat task done tanpa groupId
**Masalah:** `PATCH /api/tasks/[id]` saat status → done langsung queue WA notification ke `task.groupId`. Kalau null → entry rusak atau runtime error.

**Fix:** Skip queue jika `groupId` null. Alternatif: cari group dari `projectId` kalau ada, gunakan group pertama yang terhubung ke project tersebut.

---

### Bug 3 — WA slash command tidak bisa resolve task manual
**Masalah:** Command `/done TASK-ID` atau `/tasks` di WA group query task by `groupId`. Task tanpa group tidak pernah ketemu.

**Fix:** Command handler fallback ke `projectId` — cari task di project yang terhubung ke group WA tersebut, bukan hanya yang punya `groupId` yang sama persis.

---

### Bug 4 — DashboardStats hitungan tidak akurat
**Masalah:** Query mungkin filter `groupId IS NOT NULL` sehingga task manual tidak masuk hitungan.

**Fix:** Scope query by `projectId` sebagai primary scope, bukan `groupId`.

---

## Checklist Implementasi

```
[ ] Migration: Task.groupId String → String?
[ ] API: POST /api/tasks (manual task creation)
[ ] API: PATCH /api/tasks/[id] — skip WA queue jika groupId null
[ ] API: POST /api/groups/claim — adopt null-groupId tasks di project
[ ] WA command handler — fallback lookup by projectId
[ ] UI: CreateTaskModal (form baru)
[ ] UI: Wire tombol + di KanbanBoard ke CreateTaskModal
[ ] UI: KanbanTaskCard — handle groupId null
[ ] UI: TaskDetailPanel — handle groupId null
[ ] UI: DashboardStats — fix query scope
[ ] UI: Settings/WhatsApp — tambah banner non-blocking
```

---

# Hybrid Baileys + Meta Cloud API

> Ditambahkan: 2026-05-25
> Status: Draft — riset, belum implementasi

---

## Latar Belakang

Diskusi muncul dari pertanyaan: *"apa saja penyebab nomor WA di-banned, dan apakah lebih baik fokus ke Meta Official saja?"*

Kesimpulan: Meta Cloud API **tidak support listening grup** (didesain untuk B2C 1-on-1), sehingga untuk goal monitor mention di grup, Baileys tetap satu-satunya opsi. Strategi terbaik adalah **hybrid**: Baileys untuk read (grup), Cloud API untuk write (1-on-1 notif ke user).

---

## Penyebab Nomor WA Banned (Baileys)

1. **Library unofficial** — pola koneksi non-resmi terdeteksi WA. Risiko fundamental, tidak bisa dihilangkan.
2. **Nomor baru / belum warm** — nomor < 1-3 bulan, belum ada riwayat chat manusiawi.
3. **Pengiriman agresif** — blast, reply otomatis super cepat (< 1 detik), kirim ke nomor yang belum save kontak.
4. **Report / block dari user** — bot reply di grup dianggap spam.
5. **Login berulang / re-pair QR** — session corrupt, ganti device terus.
6. **Konten terlarang** — phishing, judi, scam pattern, forward massal.
7. **Nomor VoIP** — TextNow, Google Voice, dll lebih cepat di-ban.
8. **IP / VPS mencurigakan** — datacenter IP, sering ganti region.

---

## Yang Bisa Di-tackle di Project Ini

| Area | Mitigasi |
|---|---|
| Rate limit reply slash command | Random delay 1-3 detik, throttle max X reply/menit/grup |
| Reconnect hygiene | Exponential backoff, jangan auto-reconnect saat 401, alert Telegram kalau down |
| Scope pesan | Hanya `WatchedJid` (sudah ada ✅), whitelist sender untuk slash command |
| Konten reply | Hindari link mencurigakan dari AI, limit panjang reply |
| Infra | VPS region Indonesia / IP residensial, jangan sering pindah server |

**Yang TIDAK bisa di-tackle dari code:** deteksi pattern Baileys, umur & reputasi nomor, report dari user lain.

---

## Strategi Hybrid

- **Baileys** → listener grup + slash command reply (read-heavy, risiko terkontrol)
- **Meta Cloud API** → kirim notif 1-on-1 ke user (summary mention, reminder task, dll)

Cloud API tidak menggantikan Baileys untuk fitur grup — ini layer tambahan untuk komunikasi outbound ke user.

---

## Persyaratan Daftar Meta Cloud API

### Wajib
1. **Meta Business Account** — business.facebook.com (gratis). Butuh email, nama bisnis, website, verifikasi domain.
2. **Facebook Developer App** — developers.facebook.com → tipe Business → add WhatsApp product.
3. **Nomor telepon baru** — tidak boleh terdaftar di WA biasa / WA Business app. Pakai eSIM / nomor kedua, jangan nomor pribadi (tidak bisa balik ke WA biasa).
4. **Display Name** — review 1-3 hari, harus mencerminkan brand, tidak boleh generic.
5. **Business Verification** — untuk production. Butuh dokumen legal entity (akta PT/CV, NPWP, SIUP) + tagihan utility. Review 2-5 hari kerja.

### Untuk Use Case Inisiasi Kirim
- **Message Template** — semua pesan di luar 24h window wajib pakai template approved. Kategori: Marketing / Utility / Authentication. Untuk summary mention → Utility.
- **User opt-in** — wajib ada bukti user setuju dikirimi pesan.
- **Webhook HTTPS** — endpoint publik untuk delivery status & incoming message (Vercel function cocok).

### Tier
- **Free:** 1,000 service conversation/bulan (user inisiasi → reply dalam 24h gratis).
- **Berbayar (per-conversation, bukan per-message):**
  - Marketing: ~Rp 600-800
  - Utility: ~Rp 250-350
  - Authentication: ~Rp 200-300
  - Service: gratis dalam 24h window

---

## Potensi Hambatan

- **Business verification ditolak** kalau tidak ada legal entity → workaround: pakai BSP (Twilio, MessageBird, Wati) — verifikasi cepat tapi biaya per-message lebih mahal.
- **Template ditolak** karena terlalu promosional atau ada link mencurigakan.
- **Nomor stuck** kalau pernah login di WA app dan belum di-delete dulu.

---

## Rekomendasi Eksekusi

1. **Phase 1 — Validasi:** pakai test number Meta (gratis, langsung jalan, max 5 nomor test). Cukup untuk validasi flow kirim summary ke nomor sendiri.
2. **Phase 2 — Production:** kalau flow terbukti berguna, daftar nomor production + business verification.
3. **Alternatif cepat:** Twilio WhatsApp API — verifikasi lebih cepat, DX bagus, ~2x lebih mahal.

---

## Checklist Riset / Implementasi

```
[ ] Hardening Baileys (rate limit reply, reconnect backoff, whitelist sender)
[ ] Buat Meta Business Account + Developer App
[ ] Dapat test number Meta, coba kirim hello_world template
[ ] Sketch helper lib/whatsapp-cloud.ts (sendTemplate, sendText)
[ ] Webhook handler /api/wa-webhook (delivery status, incoming)
[ ] Tentukan template summary mention (Utility category)
[ ] Decision point: daftar production sendiri (butuh PT/CV) vs pakai BSP
```

---

# Strategi Context untuk Task Generation

> Ditambahkan: 2026-05-29
> Status: Draft — belum implementasi

---

## Latar Belakang

Diskusi muncul dari pertanyaan: *"Bagaimana agar task yang di-generate AI lebih akurat dan relevan dengan project yang sedang dikerjakan?"*

Root problem: saat ini task di-generate dari mention dalam isolasi — AI tidak tahu project sedang di fase apa, tech stack-nya apa, atau task apa yang sudah ada.

```
Sekarang:  [mention message] → LLM → task
Idealnya:  [mention message] + [project context] + [task history] + [group history] → LLM → task
```

---

## Arsitektur Context (3 Layer)

```
STATIC (di-cache, murah):
  └── Repo context (README, schema, package.json, struktur folder)
        → sync manual dari GitHub / auto via webhook push

SEMI-STATIC (weekly refresh):
  └── AI project digest
        → cron tiap Senin, di-generate dari task history minggu lalu
        → berisi: fase project saat ini, apa yang selesai, pattern issue

DYNAMIC (real-time dari DB, per-batch):
  ├── Open/in-progress tasks
  ├── Completed tasks (30 hari terakhir)
  └── Last group summary (batch sebelumnya)
```

---

## Layer 1 — Repo Context (Static)

User tambah GitHub repo URL di project settings. Sistem fetch file-file kunci via GitHub API:

| File | Isi | Token est. |
|---|---|---|
| `README.md` | Deskripsi, tujuan, cara pakai | ~1,000 |
| `package.json` | Dependencies, tech stack aktual | ~300 |
| Struktur folder (2 level) | Arsitektur project | ~300 |
| `prisma/schema.prisma` | Model data | ~500 |
| `CLAUDE.md` / `CONTRIBUTING.md` | Conventions, rules | ~500 |
| **Total** | | **~2,600** |

Karena static → fully cacheable → biaya marginal hampir nol.

**Schema DB:**
```
Project.repoUrl        String?
Project.repoContext    String?   ← raw concat dari semua file
Project.repoSyncedAt  DateTime?
```

**Sync trigger:**
- Tombol "Sync ulang" di project settings (mulai dari ini)
- Opsional nanti: GitHub webhook (push → auto-sync)

**Keputusan yang sudah diambil:**
- Mulai dengan public repo saja (tanpa token)
- Simpan raw content, bukan AI-summarized (lebih akurat, tidak lossy)
- Manual sync dulu, webhook belakangan

---

## Layer 2 — AI Project Digest (Semi-static)

Daripada project brief yang ditulis manual (cepat stale), sistem generate digest otomatis berbasis aktivitas nyata:

**Cron tiap Senin pagi:**
```
→ Ambil task completed minggu lalu
→ Ambil open tasks saat ini
→ Kirim ke LLM (DeepSeek V3 — murah)
→ Generate digest:
    "Project sedang di fase X.
     Minggu lalu selesai: A, B, C.
     Sedang dikerjakan: D, E.
     Pattern issue yang sering muncul: F."
→ Simpan ke Project.aiDigest
→ Inject ke prompt task generator minggu ini
```

**Schema DB:**
```
Project.aiDigest       String?   ← digest terakhir
Project.aiDigestAt     DateTime? ← kapan di-generate
```

**Keunggulan vs brief manual:** berbasis aktivitas nyata, bukan asumsi user — otomatis up-to-date seiring project berkembang.

---

## Layer 3 — Dynamic Context (Real-time dari DB)

Tidak perlu disimpan ke brief — diambil fresh setiap kali generate task:

- **Open/in-progress tasks** → cegah duplikat, tahu apa yang sedang dikerjakan
- **Completed tasks (30 hari)** → tahu apa yang sudah selesai
- **Last group summary** → continuity antar batch
- **Surrounding messages (±10 pesan per mention)** → konteks *kenapa* mention itu ada

---

## Contoh Prompt Final

```
=== REPO CONTEXT (cached) ===
README: [isi README...]
Tech Stack: Next.js 14, Prisma, Baileys, @anthropic-ai/sdk
Schema: [isi schema.prisma...]
Struktur: /app, /lib, /prisma, /worker

=== PROJECT DIGEST (weekly, cached) ===
Fase: MVP — fokus stability listener dan dashboard.
Selesai minggu lalu: fix reconnect, buat halaman settings.
Sedang dikerjakan: rate limit slash command, modal buat task manual.
Pattern issue: banyak task soal listener stability.

=== OPEN TASKS (real-time) ===
- TASK-12: Fix reconnect listener (in_progress)
- TASK-15: Buat halaman settings WA (todo)

=== MENTIONS BATCH 14:00-18:00 (real-time) ===
[mention + surrounding context ±10 pesan...]
```

---

## Estimasi Biaya Tambahan (DeepSeek V3)

| Context | Token | Cacheable | Biaya/batch |
|---|---|---|---|
| Repo context | ~2,600 | ✅ | ~$0.00002 |
| AI digest | ~400 | ✅ | ~$0.000003 |
| Open tasks (20) | ~1,000 | ✅ kalau tidak ada perubahan | ~$0.00007 |
| Last summary + surrounding | ~1,900 | ❌ | ~$0.00013 |
| **Total tambahan** | **~5,900** | | **~$0.00022/batch** |

Untuk 5 grup × 6 batch/hari × 30 hari = 900 batch/bulan → **+$0.20/bulan**. Tidak signifikan.

---

## Checklist Implementasi

```
[ ] Schema: tambah repoUrl, repoContext, repoSyncedAt, aiDigest, aiDigestAt ke Project
[ ] Migration Prisma
[ ] API: POST /api/projects/[id]/sync-repo — fetch GitHub API → simpan repoContext
[ ] UI: settings project — input repoUrl + tombol "Sync ulang" + status last synced
[ ] Cron: POST /api/cron/project-digest — generate aiDigest tiap Senin
[ ] lib/prompt-builder.ts — fungsi buildTaskGenPrompt(project, tasks, lastSummary, mentions)
[ ] Update summarizer untuk inject semua layer context
[ ] Keputusan: public repo only dulu, private repo (token) belakangan
```
