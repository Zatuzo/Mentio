# AI Manage — Design & Cost Document

> Status: Draft for review  
> Scope: AI-powered management layer on top of Second Brain  
> Exchange rate used: **Rp 16.000 / USD** (Juni 2026)

---

## 1. Overview

AI Manage adalah lapisan kecerdasan di atas Second Brain yang bekerja dalam tiga mode:

| Mode | Kapan berjalan | Contoh |
|---|---|---|
| **Auto-Organize** | Setiap kali konten masuk | Auto-tag, extract task, suggest space |
| **Proactive Agent** | Terjadwal (harian/mingguan) | Daily digest, stale nudge, pattern detection |
| **AI Chat (Full Control)** | Dipanggil user | "Pindahkan semua notes #work ke Project Alpha" |

Ketiganya berbagi satu **Knowledge Base** yang sama (notes + mentions + tasks + summaries) dan satu pipeline embeddings untuk semantic retrieval.

---

## 2. Auto-Organize

Berjalan di background setiap kali item baru dibuat atau diupdate.

### 2.1 Trigger Points

```
Mention baru masuk     → auto-tag + surface related notes
Note disimpan          → auto-tag + auto-title + suggest space + extract tasks + detect duplicates
Summary dibuat         → auto-tag + link ke tasks yang relevan
Task dibuat dari chat  → auto-tag + suggest due date
```

### 2.2 Fitur Detail

**Auto-tag**
- Analisis isi konten → hasilkan 2–5 tag yang relevan
- Bandingkan dengan tag yang sudah ada (pilih dari existing dulu, buat baru kalau tidak ada yang cocok)
- Confidence threshold: hanya simpan tag dengan score ≥ 0.7

**Auto-title**
- Untuk note yang judulnya "Untitled" atau kosong
- Generate judul singkat (max 60 karakter) dari isi note

**Suggest Space**
- Analisis konten → rekomendasikan space yang paling cocok
- Tampilkan sebagai banner di editor: "Cocok di Space: **Work > Backend**" + tombol Apply

**Extract Tasks**
- Deteksi kalimat action item dalam note: "perlu...", "harus...", "todo:", "- [ ]", dll.
- Buat Task draft otomatis (status: `todo`, linked ke note sumber)
- Tampilkan sebagai notifikasi di note editor: "2 task ditemukan" + review sebelum disimpan

**Duplicate Detection**
- Sebelum save note baru, cek cosine similarity dengan semua notes existing
- Jika similarity > 0.85 → tampilkan warning: "Note serupa ditemukan: [judul]"

**Auto-link**
- Setelah note disimpan, cari notes lain dengan similarity > 0.75
- Suggest sebagai "Related notes" di panel kanan editor

### 2.3 Prompt Structure (Auto-Organize)

```
System: Kamu adalah asisten organisasi personal. Analisis konten berikut dan berikan:
        1. Tags (2-5, dari daftar existing jika mungkin)
        2. Judul yang cocok (jika belum ada)
        3. Space yang paling sesuai
        4. Action items (jika ada)
        Format: JSON.

User: [isi note atau mention]
Context: [daftar tags existing, spaces available]
```

Token estimate per call:
- Input: ~500 tokens (system + content + context)
- Output: ~150 tokens (JSON response)

---

## 3. Proactive Agent

Berjalan terjadwal via cron. Tidak menunggu user membuka app.

### 3.1 Daily Digest (setiap pagi, 08:00)

Rangkuman harian yang dikirim sebagai notifikasi in-app (dan opsional email):

```
📬 Daily Digest — Selasa, 10 Juni 2026

Kemarin kamu menerima 18 mentions dari 3 grup.
5 mentions belum ditindaklanjuti.

🔥 Perlu perhatian:
  • [Bug login di production] — dimention @budi 3x kemarin
  • [Deploy jadwal besok] — deadline hari ini

💡 Dari knowledge base kamu:
  • Note "Auth Flow v2" mungkin relevan dengan diskusi kemarin di Grup Backend

📝 Inbox: 4 notes belum diorganisir sejak 3 hari lalu
```

Token estimate:
- Input: ~3.300 tokens (aggregated data + sistem prompt)
- Output: ~800 tokens (digest text)

### 3.2 Weekly Review (setiap Senin pagi)

Laporan mingguan lebih dalam:

```
📊 Weekly Review — Minggu, 9–15 Juni 2026

Aktivitas minggu ini:
  • 94 mentions diterima, 67 sudah diproses
  • 12 tasks dibuat, 8 selesai
  • 23 notes ditambahkan

⚠️  Perlu perhatian:
  • 8 notes di Inbox belum diorganisir (terlama: 9 hari)
  • 3 tasks overdue: [list]

🔍 Pattern yang terdeteksi:
  • 14 mentions tentang "payment gateway" bulan ini
    → Mau dijadikan ringkasan atau space baru?
  • Kamu paling aktif menerima mentions hari Rabu (rata-rata 22/hari)
```

Token estimate:
- Input: ~8.300 tokens (weekly aggregated data)
- Output: ~1.500 tokens

### 3.3 Stale Nudge (setiap 3 hari, background check)

- Scan notes yang tidak dibuka > 14 hari
- Scan tasks yang tidak diupdate > 7 hari
- Kirim notifikasi ringkas: "5 items mungkin sudah tidak relevan — review?"
- Token estimate: ringan, ~500 in + ~200 out per run

### 3.4 Pattern Detection (trigger: setiap 10 mentions baru masuk)

- Deteksi topik yang muncul berulang dalam 30 hari terakhir
- Jika topik sama muncul ≥ 5x → suggest: "Buat Space baru untuk topik ini?"
- Token estimate: ~2.000 in + ~300 out per run

### 3.5 Context Surfacing (trigger: setiap mention baru masuk)

- Embed mention baru → cari notes/summaries dengan similarity > 0.80
- Tampilkan di mention card: "Related dari knowledge base: [judul note]"
- Tidak memanggil LLM (hanya embedding + vector search) → biaya sangat kecil

---

## 4. AI Chat — Full Control

Extension dari AI chat yang sudah ada (`/ai`). Tambahan tools:

### 4.1 Tools Baru

```typescript
// Sudah direncanakan di SECOND_BRAIN.md:
search_knowledge_base(query, types?, limit?)
create_note(title, content, spaceId?, tags?)
save_mention_as_note(mentionId, additionalContext?)

// Tambahan untuk AI Manage:
organize_inbox()
// Batch-pindahkan semua notes di Inbox ke space yang tepat (AI decide)
// Returns: { moved: [{noteId, fromSpace, toSpace}] }

batch_tag(itemIds, tags, operation)
// operation: "add" | "remove" | "replace"
// Bisa tag banyak items sekaligus

find_related(itemId, itemType, limit?)
// Cari items yang semantically mirip dengan item tertentu

create_digest(period)
// Generate digest on-demand: "today" | "week" | "month"
// Sama dengan proactive digest tapi dipanggil manual

summarize_topic(topic, dateRange?)
// "Buatkan ringkasan semua yang pernah dibahas tentang payment gateway"
// Cari mentions + notes + tasks → generate summary

bulk_move_notes(filter, targetSpaceId)
// "Pindahkan semua notes #work dari minggu lalu ke Project Alpha"
// filter: { tags?, dateRange?, currentSpaceId? }

get_inbox_suggestions()
// Analisis Inbox → rekomendasikan space untuk setiap note
// Returns suggestions untuk di-review user sebelum apply
```

### 4.2 Contoh Percakapan

```
User: "Organisirlah inbox saya"
AI: [calls get_inbox_suggestions()]
    "Saya temukan 8 notes di Inbox. Saran saya:
     • 3 notes tentang API → Space: Work > Backend
     • 2 notes tentang ide produk → Space: Ideas
     • 2 notes tentang meeting → Space: Work > Meetings
     • 1 note tidak jelas — bisa kamu klasifikasikan sendiri
     Terapkan semua saran ini?"

User: "Ya, kecuali yang terakhir"
AI: [calls bulk_move_notes() untuk 7 notes]
    "Done. 7 notes sudah dipindahkan."
```

```
User: "Buatkan ringkasan semua yang dibahas tentang bug login bulan ini"
AI: [calls search_knowledge_base("bug login", types=["mention","note","task"], limit=20)]
    [calls summarize_topic("bug login", {last: "30d"})]
    "Dalam 30 hari terakhir, bug login dibahas 14x di 2 grup:
     
     **Root cause** (dari mentions tgl 3 Jun): token JWT tidak di-refresh setelah 24 jam
     **Status**: Task 'Fix JWT refresh' — in_progress, assigned @dika
     **Related notes**: 'Auth Flow v2', 'Session management decisions'
     
     Mau saya buat note ringkasan ini?"
```

---

## 5. Arsitektur

```
┌────────────────────────────────────────────────────────────────┐
│                        AI MANAGE LAYER                          │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Auto-Organize  │  │ Proactive Agent  │  │   AI Chat     │  │
│  │  (on-write)     │  │ (cron scheduled) │  │  (on-demand)  │  │
│  │                 │  │                  │  │               │  │
│  │ • auto-tag      │  │ • daily digest   │  │ • 10 tools    │  │
│  │ • auto-title    │  │ • weekly review  │  │ • full CRUD   │  │
│  │ • suggest space │  │ • stale nudge    │  │ • bulk ops    │  │
│  │ • extract tasks │  │ • pattern detect │  │ • summarize   │  │
│  │ • detect dupes  │  │ • ctx surfacing  │  │               │  │
│  └────────┬────────┘  └───────┬──────────┘  └──────┬────────┘  │
│           └───────────────────┼─────────────────────┘           │
│                               ▼                                  │
│              ┌────────────────────────────────┐                 │
│              │      Knowledge Base (RAG)       │                 │
│              │                                 │                 │
│              │  PostgreSQL + pgvector          │                 │
│              │  Notes · Mentions · Tasks       │                 │
│              │  Summaries · Embeddings         │                 │
│              └────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────┘
```

**Flow Auto-Organize:**
```
Konten masuk → Queue (async) → LLM call → Hasil ditulis ke DB → UI refresh
```

**Flow Proactive Agent:**
```
Cron trigger → Aggregasi data dari DB → LLM call → Notifikasi dibuat → Push ke user
```

**Flow AI Chat:**
```
User message → Embed query → Vector search (top-K) → Inject ke context → LLM → Response + citations
```

---

## 6. Estimasi Biaya (Rupiah)

### 6.1 Asumsi Profil Pengguna

| Parameter | Light | Moderate | Heavy |
|---|---|---|---|
| Mentions/hari | 5 | 20 | 50 |
| Notes dibuat/hari | 2 | 5 | 15 |
| Chat sessions/hari | 1 (3 turns) | 3 (5 turns) | 10 (5 turns) |
| Daily digest | Ya | Ya | Ya |
| Weekly review | Ya | Ya | Ya |

### 6.2 Token per Fitur per Hari

| Fitur | Light (in/out) | Moderate (in/out) | Heavy (in/out) |
|---|---|---|---|
| Auto-organize notes | 1.000 / 300 | 2.500 / 750 | 7.500 / 2.250 |
| Auto-tag mentions | 1.125 / 250 | 4.500 / 1.000 | 11.250 / 2.500 |
| Daily digest | 1.500 / 400 | 3.300 / 800 | 8.000 / 1.500 |
| AI Chat | 12.300 / 1.200 | 61.500 / 6.000 | 205.000 / 20.000 |
| Weekly review (÷7) | 286 / 57 | 1.186 / 214 | 2.857 / 500 |
| **Total/hari** | **16.211 / 2.207** | **72.986 / 8.764** | **234.607 / 26.750** |
| **Total/bulan** | **~486K / 66K** | **~2,19M / 263K** | **~7,04M / 802K** |

### 6.3 Perbandingan Biaya per Model per Bulan

> Biaya = (input tokens × harga input) + (output tokens × harga output)  
> Kurs: **Rp 16.000 / USD**

#### DeepSeek V4 Flash — $0,14/M input · $0,28/M output
*Model terbaru DeepSeek, paling murah di kelas frontier (menggantikan V3)*

| Tier | USD/bulan | Rp/bulan |
|---|---|---|
| Light | $0,09 | **Rp 1.400** |
| Moderate | $0,38 | **Rp 6.100** |
| Heavy | $1,21 | **Rp 19.400** |

#### DeepSeek R1 — $0,55/M input · $2,19/M output
*Model reasoning, cocok untuk weekly review & pattern detection*

| Tier | USD/bulan | Rp/bulan |
|---|---|---|
| Light | $0,41 | **Rp 6.600** |
| Moderate | $1,78 | **Rp 28.500** |
| Heavy | $5,63 | **Rp 90.000** |

#### Claude Haiku 4.5 — $1/M input · $5/M output
*Paling cepat dari Anthropic, kualitas lebih tinggi dari DeepSeek untuk bahasa Indonesia*

| Tier | USD/bulan | Rp/bulan |
|---|---|---|
| Light | $0,82 | **Rp 13.100** |
| Moderate | $3,51 | **Rp 56.100** |
| Heavy | $11,05 | **Rp 176.800** |

#### Gemini 2.5 Flash — $0,30/M input · $2,50/M output
*Google, kuat untuk multimodal, harga output lebih mahal dari DeepSeek*

| Tier | USD/bulan | Rp/bulan |
|---|---|---|
| Light | $0,31 | **Rp 5.000** |
| Moderate | $1,31 | **Rp 21.000** |
| Heavy | $4,12 | **Rp 65.900** |

#### Embeddings — OpenAI text-embedding-3-small · $0,02/M token
*Dipakai untuk semantic search & RAG — bukan untuk generate text*

| Tier | Token/bulan | USD/bulan | Rp/bulan |
|---|---|---|---|
| Light | ~29K | $0,001 | **Rp 9** |
| Moderate | ~90K | $0,002 | **Rp 29** |
| Heavy | ~248K | $0,005 | **Rp 79** |

*Biaya embedding praktis nol — diabaikan dari total.*

---

### 6.4 Rekap Perbandingan (Moderate User)

| Model | Rp/bulan | Keterangan |
|---|---|---|
| DeepSeek V4 Flash | **Rp 6.100** | Paling murah, kualitas frontier |
| Gemini 2.5 Flash | Rp 21.000 | Output mahal, hindari heavy output |
| DeepSeek R1 | Rp 28.500 | Overkill untuk semua fitur |
| Claude Haiku 4.5 | Rp 56.100 | Kualitas bahasa Indonesia terbaik |
| Claude Sonnet 4.6 | ~Rp 210.000 | Terlalu mahal untuk personal use |

---

### 6.5 Rekomendasi Stack Hybrid

Gunakan model yang tepat untuk tugas yang tepat:

| Fitur | Model | Alasan |
|---|---|---|
| Auto-tag, auto-title | DeepSeek V4 Flash | Output pendek, tidak perlu reasoning |
| Extract tasks | DeepSeek V4 Flash | Structured JSON output |
| Daily digest | DeepSeek V4 Flash | Volume tinggi, butuh cepat dan murah |
| Weekly review | DeepSeek R1 | Butuh reasoning untuk pattern detection |
| AI Chat (umum) | DeepSeek V4 Flash | Mayoritas percakapan tidak kompleks |
| AI Chat (complex) | DeepSeek R1 | Jika user tanya analisis mendalam |
| Embeddings | OpenAI text-embedding-3-small | Model terbaik untuk semantic search |

**Estimasi biaya hybrid (80% V4 Flash + 20% R1):**

| Tier | USD/bulan | **Rp/bulan** |
|---|---|---|
| Light | $0,15 | **Rp 2.400** |
| Moderate | $0,66 | **Rp 10.600** |
| Heavy | $2,10 | **Rp 33.600** |

> **Kesimpulan:** Untuk pengguna moderate (paling realistis), biaya AI Manage kurang dari **Rp 11.000/bulan** — lebih murah dari secangkir kopi.

---

## 7. Implementasi Phases

### Phase 1 — Auto-Organize Foundation (1 minggu)
- [ ] Background job runner (gunakan existing `node-cron` atau queue)
- [ ] `POST /api/internal/auto-organize` — endpoint internal yang dipanggil setelah note/mention disimpan
- [ ] Implementasi: auto-tag + auto-title
- [ ] Tambahkan `confidence` field ke NoteTag + MentionTag (float, 0–1)
- [ ] UI: tampilkan AI-generated tags dengan badge "AI" yang bisa dihapus user

### Phase 2 — Extract Tasks + Suggest Space (3–4 hari)
- [ ] Extract tasks dari note content → buat Task draft + link ke note
- [ ] Space suggestion banner di note editor
- [ ] Duplicate detection (pre-save check)
- [ ] Auto-link: suggest related notes setelah save

### Phase 3 — Daily Digest (3–4 hari)
- [ ] Cron job harian 08:00 → generate digest per user
- [ ] Model `Digest` baru di Prisma (atau simpan sebagai Note di Space "AI Digests")
- [ ] Notifikasi in-app: badge + panel kecil di dashboard
- [ ] Opsional: kirim via email (Resend)

### Phase 4 — Weekly Review + Pattern Detection (1 minggu)
- [ ] Cron job Senin 08:00 → weekly review per user
- [ ] Pattern detection: topik berulang → suggest Space baru
- [ ] Stale nudge: cron 3 hari sekali
- [ ] Context surfacing: tampilkan related items di mention card

### Phase 5 — AI Chat Tools Baru (1 minggu)
- [ ] Tambah tools: `organize_inbox`, `batch_tag`, `find_related`, `create_digest`, `summarize_topic`, `bulk_move_notes`
- [ ] Test dengan percakapan natural di `/ai`
- [ ] Citation system: setiap jawaban RAG sertakan sumber yang bisa diklik

---

## 8. Skema Prisma Tambahan

```prisma
// Menyimpan digest harian/mingguan yang sudah digenerate
model Digest {
  id        String   @id @default(cuid())
  userId    String
  user      user     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // "daily" | "weekly"
  content   String   @db.Text
  period    String   // "2026-06-10" untuk daily, "2026-W24" untuk weekly
  readAt    DateTime?
  createdAt DateTime @default(now())

  @@unique([userId, type, period])
  @@index([userId, type, createdAt])
}

// Tracking auto-organize jobs agar tidak double-run
model AutoOrganizeJob {
  id          String   @id @default(cuid())
  userId      String
  itemType    String   // "note" | "mention"
  itemId      String
  status      String   @default("pending") // pending | done | failed
  result      String?  @db.Text            // JSON hasil dari LLM
  attempts    Int      @default(0)
  createdAt   DateTime @default(now())
  processedAt DateTime?

  @@unique([itemType, itemId])
  @@index([status, createdAt])
}
```

Tambahan ke model existing:

```prisma
// Tambah ke NoteTag dan MentionTag:
  confidence Float @default(1.0) // 1.0 = manual, < 1.0 = AI-generated
  source     String @default("manual") // "manual" | "ai"

// Tambah ke user:
  digests    Digest[]
```

---

## 9. Settings Additions

Di Settings → AI Manage:

| Setting | Default | Keterangan |
|---|---|---|
| Auto-organize | ✅ On | Auto-tag + title setiap note baru |
| Auto-extract tasks | ✅ On | Buat task draft dari note |
| Daily digest | ✅ On | Notifikasi digest tiap pagi |
| Digest time | 08:00 | Jam pengiriman digest |
| Weekly review | ✅ On | Review setiap Senin |
| Email digest | ❌ Off | Kirim digest ke email |
| Context surfacing | ✅ On | Tampilkan related items di mention card |
| AI model | V4 Flash | Pilih model untuk auto-organize |
| Reasoning model | R1 | Pilih model untuk weekly review |

---

## 10. Pertanyaan Terbuka

1. **Auto-apply vs suggest**: auto-tag langsung disimpan, atau ditampilkan sebagai saran dulu yang perlu disetujui user? Saran lebih aman, auto-apply lebih seamless. Rekomendasi: auto-apply dengan confidence ≥ 0.8, suggest kalau di bawah itu.

2. **Digest channel**: cukup in-app notification, atau perlu email juga dari awal? Email butuh Resend setup tapi lebih berguna karena user tidak harus buka app.

3. **Rate limit AI Manage**: jika user membuat 50 notes dalam satu menit, auto-organize akan spike biaya. Perlu queue + rate limit per user (max 10 auto-organize calls/menit).

4. **Bahasa digest**: generate dalam bahasa yang sama dengan konten (campur Indonesia-Inggris), atau selalu Indonesia? Rekomendasi: detect bahasa dominan dari mentions, gunakan itu.

5. **Biaya untuk multi-user SaaS**: estimasi di atas adalah per user. Jika 100 moderate users: ~Rp 1.060.000/bulan total AI cost — sangat manageable untuk dijadikan fitur premium plan.

---

## 11. Non-Goals

- ❌ AI yang mengirim pesan WhatsApp atas nama user (melanggar ToS Baileys)
- ❌ AI yang mengakses internet secara mandiri (hanya beroperasi pada data user sendiri)
- ❌ Training model custom dari data user
- ❌ Real-time streaming untuk auto-organize (async/background sudah cukup)

---

*Created: 2026-06-10 | Status: Draft — awaiting review*

---

**Sources:**
- [DeepSeek API Pricing Docs](https://api-docs.deepseek.com/quick_start/pricing)
- [AI API Pricing Comparison 2026 — DevTk.AI](https://devtk.ai/en/blog/ai-api-pricing-comparison-2026/)
- [LLM API Pricing 2026 — BenchLM.ai](https://benchlm.ai/llm-pricing)
- [DeepSeek Pricing 2026 — CloudZero](https://www.cloudzero.com/blog/deepseek-pricing/)
