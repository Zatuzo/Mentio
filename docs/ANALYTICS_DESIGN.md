# Analytics &amp; Productivity Report — Design Documen

> Dokumen ini adalah bahan brainstorming, bukan spec final.
> Semua keputusan arsitektur masih terbuka untuk diskusi.

---

## 1. Tujuan

Memberikan user visibility terhadap produktivitas mereka dari perspektif WA mentions:

- Seberapa cepat task diselesaikan?
- Dari group mana paling banyak permintaan masuk?
- Apakah ada backlog yang menumpuk?
- Tren minggu ini vs minggu lalu?

---

## 2. Data yang Tersedia (tanpa schema baru)

Semua metric di bawah bisa dihitung dari tabel yang sudah ada:


| Field       | Tabel   | Dipakai untuk                                        |
| ----------- | ------- | ---------------------------------------------------- |
| `status`    | Task    | completion rate, distribusi status                   |
| `createdAt` | Task    | volume masuk per periode                             |
| `updatedAt` | Task    | proxy "selesai pada" (jika status berubah ke `done`) |
| `dueDate`   | Task    | overdue rate                                         |
| `priority`  | Task    | distribusi prioritas                                 |
| `groupId`   | Task    | breakdown per WA group                               |
| `timestamp` | Mention | mention volume over time                             |
| `processed` | Mention | mention yang belum jadi task                         |


### Keterbatasan data saat ini

- **Tidak ada `completedAt`** — waktu task selesai harus di-proxy dari `updatedAt` saat `status = done`. Ini tidak akurat kalau task di-update setelah done tanpa mengubah status.
- **Tidak ada time tracking** — tidak ada data berapa lama task aktif dikerjakan.

---

## 3. Metric Kandidat

### 3a. Overview Cards (angka single)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Tasks Selesai  │  │  Completion Rate│  │  Avg. Cycle Time│  │  Mention Masuk  │
│      24         │  │      68%        │  │    3.2 hari     │  │      41         │
│  +4 vs minggu   │  │  ▲ dari 52%     │  │  ▼ dari 4.1hr   │  │  minggu ini     │
│  lalu           │  │  lalu           │  │  lalu           │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

- **Tasks Selesai** — count `status = done` dalam periode
- **Completion Rate** — done / (done + in_progress + todo) × 100
- **Avg. Cycle Time** — rata-rata (`updatedAt` - `createdAt`) untuk task done
- **Mention Masuk** — count `Mention.timestamp` dalam periode

### 3b. Charts

**Chart 1 — Task Volume (bar chart, per hari/minggu)**

- X: tanggal
- Y: jumlah task dibuat vs diselesaikan
- Insight: apakah backlog tumbuh atau menyusut?

**Chart 2 — Completion Rate Trend (line chart)**

- X: minggu
- Y: % tasks selesai dalam periode tersebut
- Insight: apakah produktivitas membaik dari waktu ke waktu?

**Chart 3 — Breakdown per Group (horizontal bar / donut)**

- Setiap WA group = satu bar
- Dibagi: todo / in_progress / done
- Insight: group mana yang paling banyak generate backlog?

**Chart 4 — Priority Distribution (stacked bar)**

- Urgent / High / Medium / Low / None
- Dibagi per status
- Insight: apakah task urgent selesai lebih cepat?

**Chart 5 — Cycle Time per Group (box plot atau simple bar)**

- Rata-rata waktu selesai per WA group
- Insight: request dari group mana yang biasanya lebih lama diselesaikan?

### 3c. Tabel Detail (bisa di-export)

Top tasks by age — task paling lama belum selesai:


| Task          | Group      | Priority | Dibuat | Usia    |
| ------------- | ---------- | -------- | ------ | ------- |
| Fix login bug | KEL.1 DPBO | Urgent   | 5 Jan  | 12 hari |
| ...           | ...        | ...      | ...    | ...     |


---

## 4. Filter &amp; Periode

```
[ Periode: 7 hari ▼ ]  [ Group: Semua ▼ ]  [ Export CSV ]
```

Opsi periode:

- 7 hari terakhir (default)
- 30 hari terakhir
- Bulan ini
- Custom range (nice to have, fasa 2)

---

## 4b. Keputusan Final


| Keputusan     | Pilihan                             |
| ------------- | ----------------------------------- |
| `completedAt` | Tambah sekarang ke schema           |
| Scope         | Per-project saja                    |
| Chart library | shadcn/ui Chart (berbasis Recharts) |
| Placement     | Sidebar item tersendiri             |
| Fasa          | Semua, dikerjakan berurutan         |


---

## 5. Arsitektur — Dua Opsi

### Opsi A: Pure Server-Side (Simpler, recommended untuk MVP)

```
/analytics page (Server Component)
  └─► Prisma queries langsung di page.tsx
        ├─► aggregate tasks (groupBy status, groupBy groupId)
        ├─► filter by date range (searchParams)
        └─► pass serialized data ke Client chart components
```

**Pro:** tidak butuh API route baru, tidak ada caching layer, data selalu fresh.  
**Kon:** setiap filter change = full page reload (kecuali pakai route handler + client fetch).

### Opsi B: API Route + Client Fetch (Lebih interaktif)

```
/analytics page (Client Component)
  └─► useEffect / SWR → GET /api/analytics?range=7d&groupId=...
        └─► Prisma aggregate queries
              └─► return JSON → chart components render
```

**Pro:** filter bisa berubah tanpa reload halaman, bisa tambah loading state per chart.  
**Kon:** lebih banyak kode, perlu handle loading/error state.

**Rekomendasi saya:** mulai dengan Opsi A untuk MVP, migrasi ke B kalau user minta interaktivitas lebih.

---

## 6. Schema Tambahan (Opsional)

Untuk akurasi cycle time, ada satu field yang perlu ditambah:

```prisma
model Task {
  // ... field yang sudah ada ...
  completedAt  DateTime?   // di-set saat status berubah ke "done"
}
```

Tanpa ini, cycle time pakai `updatedAt` sebagai proxy — cukup untuk MVP tapi bisa misleading kalau task di-edit setelah done.

Tidak ada tabel baru yang dibutuhkan untuk fitur ini.

---

## 7. Library Chart

Opsi yang compatible dengan Next.js 14 + Tailwind:


| Library                        | Bundle size    | Ease of use   | Notes                                            |
| ------------------------------ | -------------- | ------------- | ------------------------------------------------ |
| **Recharts**                   | ~150kb         | Tinggi        | Paling populer di React ecosystem, banyak contoh |
| **Tremor**                     | ~80kb          | Sangat tinggi | Komponen analytics siap pakai, desain bersih     |
| **Chart.js + react-chartjs-2** | ~200kb         | Medium        | Powerful tapi verbose                            |
| **Visx** (Airbnb)              | Tree-shakeable | Rendah        | Sangat customizable tapi butuh effort lebih      |


**Rekomendasi:** Recharts (sudah battle-tested, banyak contoh, integrasi mudah dengan Tailwind).

---

## 8. Navigasi &amp; Placement

Dua opsi penempatan tab Analytics:

**Opsi A — Item di sidebar (sejajar Dashboard, Inbox, Calendar)**

```
├── Dashboard
├── Inbox
├── Calendar
├── Analytics  ← baru
└── Settings
```

**Opsi B — Sub-tab di dalam Dashboard**

```
Dashboard
├── [Board] [List] [Analytics]  ← toggle view di atas
```

Opsi A lebih clean dan scalable. Opsi B lebih compact tapi Analytics bisa tertanam terlalu dalam.

---

## 9. Fasa Implementasi (Usulan)

### Fasa 1 — MVP (bisa ship dalam 1 sesi)

- [ ] Route `/analytics` + sidebar link
- [ ] 4 overview cards (tasks selesai, completion rate, cycle time, mention masuk)
- [ ] Bar chart: task volume per hari (7 &amp; 30 hari)
- [ ] Filter periode (7d / 30d)
- [ ] Data dari Prisma aggregate, server-side

### Fasa 2 — Breakdown (sesi berikutnya)

- [ ] Chart breakdown per group
- [ ] Priority distribution chart
- [ ] Tabel "oldest open tasks"
- [ ] Filter per group

### Fasa 3 — Polish (opsional)

- [ ] Export CSV
- [ ] Completion rate trend (line chart)
- [ ] Field `completedAt` di Task untuk akurasi cycle time

---

## 10. Pertanyaan Terbuka untuk Diskusi

1. **Cycle time**: apakah kita perlu `completedAt` di schema sekarang, atau cukup pakai proxy `updatedAt` dulu?
2. **Scope**: analytics per-project saja, atau mau ada "global" yang aggregate semua project user?
3. **Chart library**: setuju Recharts, atau ada preferensi lain?
4. **Placement**: sidebar item (Opsi A) atau sub-tab di Dashboard (Opsi B)?
5. **Fasa**: langsung kerjakan semua fasa 1, atau ada yang mau diprioritaskan / dibuang?

