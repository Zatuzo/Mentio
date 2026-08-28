# Anti-Ban Strategy — WA Mention Agent

> Dokumen ini menjelaskan langkah-langkah meminimalisir risiko ban dari WhatsApp saat menggunakan Baileys (unofficial library). Strategi ini difokuskan pada **perilaku koneksi dan bot**, bukan migrasi ke Meta official API.

---

## Konteks Risiko

WhatsApp mendeteksi automasi lewat beberapa sinyal:
- Pola koneksi yang tidak wajar (reconnect agresif, multi-device abuse)
- Aktivitas yang tidak manusiawi (kirim pesan masif, pola kirim yang terlalu konsisten)
- Fingerprint device yang berubah-ubah
- Session yang sering di-re-register

**Profil bot ini:** Bot mengirim pesan ke grup melalui dua jalur:
1. **Slash command** — user ketik `/command` di grup, bot membalas
2. **Task report** — bot mengirim notifikasi otomatis ke grup saat task selesai

Ini menempatkan bot di **tier risiko Sedang**. Bukan bot broadcast, tapi bukan pure listener. Pengendalian perilaku pengiriman adalah kunci utama.

---

## Tier Risiko

| Aktivitas | Risiko | Kita? |
|-----------|--------|-------|
| Read-only listener | Rendah | Sebagian |
| Bot reply via command | Sedang | ✓ |
| Notifikasi otomatis terbatas | Sedang | ✓ |
| Bulk messaging / broadcast | Tinggi | ✗ |
| Multi-device farming | Sangat Tinggi | ✗ |

---

## Langkah 1 — Konfigurasi Koneksi Baileys yang Aman

### 1.1 Gunakan session persistensi, jangan re-register ulang

```js
// ✅ Benar: simpan session, reuse saat restart
const { state, saveCreds } = await useMultiFileAuthState('./session')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

```js
// ❌ Salah: hapus session tiap restart → WhatsApp anggap device baru terus
fs.rmdirSync('./session', { recursive: true })
```

**Mengapa:** Setiap register ulang = device baru di mata WA. Terlalu sering → suspicious.

### 1.2 Set browser fingerprint yang stabil dan wajar

```js
const sock = makeWASocket({
  auth: state,
  browser: Browsers.macOS('Desktop'), // atau Chrome / Firefox
})
```

**Jangan** gunakan `browser: ['MyBot', 'Custom', '1.0']` — string tidak dikenal meningkatkan risiko deteksi.

### 1.3 Reconnect dengan exponential backoff + jitter

```js
// lib/connection.js
const BASE_DELAY = 3000   // 3 detik
const MAX_DELAY  = 60000  // 1 menit

let attempt = 0

function getReconnectDelay() {
  const exp = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY)
  const jitter = Math.random() * 0.3 * exp  // ±30% jitter
  attempt++
  return exp + jitter
}

sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
  if (connection === 'close') {
    const reason = lastDisconnect?.error?.output?.statusCode
    const isBanned = reason === DisconnectReason.loggedOut

    if (isBanned) {
      console.error('Session logged out — jangan auto-reconnect, cek manual')
      process.exit(1)  // Hentikan, jangan reconnect saat banned
    }

    const delay = getReconnectDelay()
    console.log(`Reconnect dalam ${Math.round(delay / 1000)}s (attempt ${attempt})`)
    setTimeout(connectToWA, delay)
  } else if (connection === 'open') {
    attempt = 0  // Reset counter setelah berhasil
  }
})
```

**Mengapa:** Reconnect terlalu cepat dan berulang = pola bot yang mudah terdeteksi.

### 1.4 Jangan reconnect saat `loggedOut`

Jika `DisconnectReason.loggedOut`, artinya session sudah di-revoke oleh WA (bisa karena ban atau logout manual). **Stop proses, jangan auto-reconnect.** Reconnect agresif setelah logout hanya memperburuk situasi.

---

## Langkah 2 — Minimalisir Footprint di WhatsApp

### 2.1 Jangan update presence secara otomatis

```js
// ❌ Jangan lakukan ini secara periodik
await sock.sendPresenceUpdate('available', jid)

// ✅ Biarkan Baileys handle presence secara default (unavailable)
```

### 2.2 Jangan subscribe ke presence orang lain

```js
// ❌ Ini memicu traffic ke server WA
await sock.presenceSubscribe(jid)
```

### 2.3 Jangan request history messages saat startup

```js
const sock = makeWASocket({
  syncFullHistory: false,  // Pastikan false (default)
})
```

### 2.4 Batasi grup yang di-listen

Konfigurasi whitelist grup eksplisit di `.env`:

```env
WATCHED_GROUPS=120363xxxxxx@g.us,120363yyyyyy@g.us
```

Proses hanya event dari grup yang ada di whitelist — sisanya di-ignore sebelum masuk ke DB.

---

## Langkah 3 — Perilaku Pengiriman Pesan yang Aman

Ini adalah langkah **paling kritis** karena bot aktif mengirim pesan. Dua jalur pengiriman harus dikendalikan secara berbeda.

### 3.1 Jalur A — Slash Command (reply triggered by user)

Bot membalas pesan user di grup. Risiko lebih rendah karena ada trigger manusia yang terdeteksi WA.

**Aturan:**
- Hanya balas satu pesan per command, jangan kirim beberapa pesan sekaligus untuk satu command
- Selalu quote/reply ke pesan asli (bukan kirim pesan baru ke grup) — ini terlihat lebih natural
- Tambahkan delay sebelum balas: **1–3 detik + jitter random**

```js
async function replyToCommand(sock, msg, replyText) {
  const groupJid = msg.key.remoteJid
  const delay = 1000 + Math.random() * 2000  // 1–3 detik

  await sock.sendPresenceUpdate('composing', groupJid)
  await new Promise(r => setTimeout(r, delay))

  await sock.sendMessage(groupJid, {
    text: replyText,
    quoted: msg,  // reply ke pesan, bukan pesan baru
  })

  await sock.sendPresenceUpdate('paused', groupJid)
}
```

### 3.2 Jalur B — Task Report (pesan otomatis tanpa trigger langsung)

Bot mengirim notifikasi ke grup saat task selesai. Ini lebih berisiko karena tidak ada trigger manusia yang terdeteksi WA secara langsung.

**Aturan:**
- **Jangan kirim ke lebih dari 1 grup dalam 10 detik** — jika task selesai dan perlu notif ke beberapa grup, antri dan kirim berjeda
- Tambahkan delay sebelum kirim: **3–8 detik + jitter random**
- Jangan kirim saat tengah malam (00:00–06:00 WIB) — pola ini tidak wajar untuk manusia

```js
// lib/sender.js — antrian pengiriman dengan rate limit global
import PQueue from 'p-queue'

// Satu pesan per 8 detik maksimum, global untuk semua pengiriman
const sendQueue = new PQueue({ interval: 8000, intervalCap: 1 })

export async function sendTaskReport(sock, groupJid, text) {
  return sendQueue.add(async () => {
    const hour = new Date().getHours()

    // Tahan pengiriman di jam dini hari, kirim saat jam 07:00
    if (hour >= 0 && hour < 7) {
      console.log('Task report ditahan — jam dini hari, dijadwalkan jam 07:00')
      return scheduleForMorning(sock, groupJid, text)
    }

    const delay = 3000 + Math.random() * 5000  // 3–8 detik

    await sock.sendPresenceUpdate('composing', groupJid)
    await new Promise(r => setTimeout(r, delay))
    await sock.sendMessage(groupJid, { text })
    await sock.sendPresenceUpdate('paused', groupJid)
  })
}
```

### 3.3 Rate limit global — jangan exceed batas harian

Tidak ada angka resmi dari WA, tapi praktik komunitas Baileys menyarankan:
- Maksimum **~200 pesan/hari** dari satu nomor ke grup-grup berbeda
- Jika task report bisa sangat sering, tambahkan **batching**: gabungkan beberapa notif dalam satu pesan daripada kirim satu-satu

```js
// Daripada kirim 5 pesan terpisah:
// "Task A selesai", "Task B selesai", ... 

// Gabung jadi satu:
// "Update task:\n✓ Task A\n✓ Task B\n✓ Task C"
```

### 3.4 Hindari teks yang terlihat seperti spam

WA juga memiliki heuristik konten, bukan hanya frekuensi:
- Jangan kirim URL yang sama berulang kali
- Jangan format pesan identik persis — variasikan sedikit teks laporan
- Hindari ALL CAPS berlebihan atau karakter berulang (`!!!`, `###`)

---

## Langkah 4 — Infrastruktur & Deployment

### 4.1 Satu nomor = satu instance

Jangan jalankan dua instance Baileys dengan session yang sama secara bersamaan.

```bash
pm2 list  # Verifikasi tidak ada duplikat
```

### 4.2 Gunakan nomor yang sudah "tua"

Nomor baru yang langsung dipakai automasi berisiko tinggi. Idealnya gunakan nomor yang:
- Sudah dipakai manual minimal beberapa minggu
- Sudah ada di beberapa kontak dan grup secara organik

### 4.3 Backup session secara berkala

```bash
# Crontab di VPS: backup session tiap hari
0 3 * * * tar -czf /backup/session-$(date +%Y%m%d).tar.gz /app/session/
```

Jika session corrupt karena crash, restore dari backup — jangan register ulang.

---

## Langkah 5 — Monitoring & Early Warning

### 5.1 Alert jika terjadi `loggedOut`

```js
if (reason === DisconnectReason.loggedOut) {
  await sendAlert('⚠️ WhatsApp session logged out — kemungkinan ban atau logout manual')
  process.exit(1)
}
```

### 5.2 Hitung pesan terkirim per hari

Simpan counter ke DB, tampilkan di dashboard. Jika mendekati 150 pesan/hari, beri warning.

```js
// Setiap kali sendMessage berhasil
await db.dailySendCount.upsert({
  where: { date: today() },
  update: { count: { increment: 1 } },
  create: { date: today(), count: 1 },
})
```

### 5.3 Monitor di dashboard

Status koneksi WA sertakan:
- Status: `connected` / `reconnecting` / `logged_out`
- Waktu terakhir connected
- Jumlah disconnect dalam 24 jam
- **Pesan terkirim hari ini** (vs batas aman 150)

---

## Ringkasan Prioritas

| # | Langkah | Effort | Dampak |
|---|---------|--------|--------|
| 1 | Session persistence, jangan hapus session | Kecil | Tinggi |
| 2 | Reconnect dengan backoff + jitter | Kecil | Tinggi |
| 3 | Stop proses saat `loggedOut` | Kecil | Tinggi |
| 4 | Delay + typing indicator sebelum kirim | Kecil | Tinggi |
| 5 | Antrian global rate limit (p-queue 1/8s) | Sedang | Tinggi |
| 6 | Tahan task report di jam dini hari | Kecil | Sedang |
| 7 | Batching notif task jadi satu pesan | Sedang | Sedang |
| 8 | Counter pesan harian + warning di dashboard | Sedang | Sedang |
| 9 | Browser fingerprint wajar | Sangat Kecil | Sedang |
| 10 | Disable presence update & history sync | Kecil | Sedang |
| 11 | Whitelist grup di-listen | Kecil | Sedang |

---

## Yang Tidak Perlu Dilakukan

- **Tidak perlu rotate nomor** — kita tidak spam, satu nomor cukup
- **Tidak perlu proxy/VPN** — justru bisa mencurigakan
- **Tidak perlu fake activity** (kirim pesan ke diri sendiri, dll) — tidak efektif dan berisiko
- **Tidak perlu migrasi ke Meta official API** — overkill untuk use case ini
