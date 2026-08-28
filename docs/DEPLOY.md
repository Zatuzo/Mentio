# Deploy Workflow

> Status: Referensi untuk Claude (dan developer) tentang bagaimana deploy dilakukan di project ini.

---

## Arsitektur Infra

| Komponen | Detail |
|---|---|
| VPS Provider | Jetorbit |
| VPS Name | sanzo |
| IP Publik | 103.235.75.245 |
| User | root |
| App directory | `/root/mentio` |
| Process manager | PM2 |
| Database | Neon PostgreSQL (remote, shared antara local & production) |
| GitHub repo | git@github.com:Resanso/mentio.git |
| CI runner | Self-hosted di VPS (`~/actions-runner`) — service: `actions.runner.Resanso-mentio.mentio-jetorbit` |

---

## PM2 Processes

| ID | Name | Script | Fungsi |
|---|---|---|---|
| 0 | `mentio-web` | `next start -p 9000` | Web dashboard (Next.js) |
| 1 | `mentio-listener` | `src/listener.js` | WhatsApp listener via Baileys |
| 2 | `mentio-sessions` | `src/session-manager.js` | WA session manager per user |
| 5 | `mentio-cron` | `src/summarizer.js` | Summarizer cron tiap 4 jam |
| 6 | `mentio-reminders` | `src/reminder-worker.js` | Reminder worker |

---

## Flow Deploy Normal (via GitHub Actions)

Setiap `push` ke `main` → GitHub Actions otomatis test lalu deploy ke VPS.

```
git commit → git push origin main
       ↓
GitHub Actions (.github/workflows/deploy.yml)
  ├── job: test  (ubuntu-latest, GitHub-hosted)
  │     npm ci → npm test → pass/fail
  │
  └── job: deploy  (self-hosted runner di VPS) — hanya jalan jika test pass
        bash $GITHUB_WORKSPACE/scripts/deploy.sh
          1. git fetch --all --prune && git reset --hard origin/main
          2. npm ci || npm install
          3. npx prisma db push --skip-generate --accept-data-loss
          4. npx prisma generate
          5. npm run build
          6. pm2 reload mentio-web   (zero-downtime)
          7. pm2 restart mentio-listener, mentio-cron, mentio-reminders
          8. pm2 save
```

---

## GitHub Actions — Variables & Secrets

### Variables (plain text, bisa dilihat)

| Variable | Nilai | Fungsi |
|---|---|---|
| `RUNNER_LABEL` | `self-hosted` | Runner untuk job deploy |
| `DEPLOY_MODE` | `local` | Jalankan deploy.sh langsung di VPS (tanpa SSH) |

Set di: `Settings → Secrets and variables → Actions → Variables`

### Secrets (terenkripsi)

| Secret | Keterangan |
|---|---|
| `VPS_HOST` | IP VPS (`103.235.75.245`) |
| `VPS_USER` | User SSH (`root`) |
| `VPS_SSH_KEY` | Private key untuk SSH fallback (`~/.ssh/mentio_deploy`) |
| `VPS_PORT` | Port SSH (default 22) |
| `VPS_APP_DIR` | Path app di VPS (`/root/mentio`) |

### Toggle ke mode SSH (fallback)

Hapus atau kosongkan `RUNNER_LABEL` dan `DEPLOY_MODE` → workflow otomatis SSH ke VPS menggunakan Secrets di atas.

---

## Self-hosted Runner

Runner berjalan sebagai systemd service di VPS:

```bash
# Status
sudo systemctl status actions.runner.Resanso-mentio.mentio-jetorbit

# Restart kalau bermasalah
sudo systemctl restart actions.runner.Resanso-mentio.mentio-jetorbit

# Logs
journalctl -u actions.runner.Resanso-mentio.mentio-jetorbit -n 50
```

---

## Flow Deploy Manual (dari local)

Kalau perlu hotfix cepat tanpa menunggu CI:

```bash
# SSH ke VPS dan jalankan deploy script
ssh root@103.235.75.245 \
  "cd ~/mentio && bash scripts/deploy.sh"
```

Atau kalau perlu pull saja tanpa full deploy:
```bash
ssh root@103.235.75.245 \
  "cd ~/mentio && git pull origin main && npm run build && pm2 reload mentio-web"
```

---

## SSH Setup

| Key | Path lokal | Keterangan |
|---|---|---|
| Key Mac | `~/.ssh/id_rsa` | Untuk SSH manual dari local ke VPS (root@103.235.75.245) |

Public key sudah terdaftar di `/root/.ssh/authorized_keys` di VPS.

```bash
# Test koneksi
ssh root@103.235.75.245 "echo connected && pm2 list"
```

---

## Database & Migrations

Database: **Neon PostgreSQL** — instance yang sama dipakai di local dan production.

### Environment variables DB

| Var | URL | Dipakai untuk |
|---|---|---|
| `DATABASE_URL` | Pooler URL (`-pooler.` di hostname) | Query normal dari app |
| `DATABASE_URL_UNPOOLED` | Direct URL (tanpa `-pooler`) | Prisma `directUrl` di schema |

`directUrl` di `prisma/schema.prisma` membuat Prisma otomatis pakai direct URL untuk operasi migration-level.

### Kenapa `db push` bukan `migrate deploy` di production

`prisma migrate deploy` membutuhkan advisory lock PostgreSQL. Neon (baik pooler maupun direct) sering timeout saat acquire lock ini (P1002). Oleh karena itu `scripts/deploy.sh` menggunakan `prisma db push` yang tidak membutuhkan advisory lock.

`prisma migrate deploy` tetap dipakai di local saat membuat migration baru.

### Membuat migration baru (dari local)

```bash
# Buat file migration
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_nama_migration
# Tulis SQL DDL ke migration.sql

# Apply ke database (dari local)
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

Setelah di-push ke `main`, `scripts/deploy.sh` akan menjalankan `db push` di VPS yang akan no-op karena schema sudah sync.

---

## Checklist Deploy Manual (untuk fitur besar)

```
[ ] npm run build — pastikan build sukses di local sebelum push
[ ] npx tsc --noEmit — pastikan tidak ada TypeScript error
[ ] npm test — pastikan semua test passing
[ ] git push origin main
[ ] Pantau GitHub Actions: github.com/Resanso/mentio/actions
[ ] Kalau CI gagal: baca log, fix, push ulang
[ ] Kalau CI sukses tapi VPS bermasalah:
      ssh root@103.235.75.245
      cd ~/mentio && pm2 logs mentio-web --lines 50
[ ] Cek pm2 list — semua process harus status "online"
[ ] Smoke test: buka dashboard, cek fitur utama
```

---

## Debug Production

### Akses VPS

```bash
ssh root@103.235.75.245
```

### Cek status semua service

```bash
pm2 list
pm2 logs --lines 50           # semua service
pm2 logs mentio-web --lines 100
pm2 logs mentio-listener --lines 100
pm2 logs mentio-cron --lines 50
```

### Cek apakah app bisa diakses

```bash
curl -s http://localhost:9000/api/health | python3 -m json.tool
```

### Cek database connection

```bash
cd ~/mentio && node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRaw\`SELECT 1\`.then(()=>{console.log('DB OK');p.\$disconnect()})"
```

### Cek environment variables

```bash
cd ~/mentio && cat .env | grep -v "KEY\|SECRET\|PASSWORD\|TOKEN"
```

### Lihat log real-time

```bash
pm2 logs mentio-web --raw     # streaming
```

### Restart service tertentu

```bash
pm2 reload mentio-web         # zero-downtime (untuk web)
pm2 restart mentio-listener   # full restart (untuk worker)
pm2 restart mentio-cron
pm2 restart mentio-reminders
```

### Cek disk & memory VPS

```bash
df -h && free -h
```

---

## Troubleshooting Umum

### `npm ci` gagal di VPS dengan ENOTEMPTY

```bash
ssh root@103.235.75.245 "cd ~/mentio && rm -rf node_modules && npm install"
```

### PM2 process crash loop (↺ count tinggi)

```bash
ssh root@103.235.75.245 "pm2 logs mentio-web --lines 100"
```

### Build sukses tapi halaman tidak update

Pastikan `pm2 reload` (bukan `restart`) dipakai untuk mentio-web agar zero-downtime, dan browser cache di-clear.

### Runner tidak muncul / Idle di GitHub

```bash
ssh root@103.235.75.245 \
  "sudo systemctl restart actions.runner.Resanso-mentio.mentio-vps"
```

### Rollback ke commit sebelumnya

```bash
ssh root@103.235.75.245 << 'EOF'
cd ~/mentio
git log --oneline -5
git reset --hard <commit-hash>
npm run build
pm2 reload mentio-web
EOF
```

---

## Workflow Claude saat Deploy

```
1. Pastikan semua perubahan sudah di-commit (git status bersih)
2. npm test — pastikan passing sebelum push
3. git push origin main
4. GitHub Actions otomatis: test → deploy
5. Kalau perlu deploy manual:
   a. SSH ke VPS: ssh root@103.235.75.245
   b. cd ~/mentio && bash scripts/deploy.sh
   c. Kalau ada schema change baru: npx prisma db push (bukan migrate deploy)
6. Verifikasi: pm2 list — semua "online"
```

Claude tidak perlu password VPS — autentikasi via `~/.ssh/id_rsa` (key Mac sudah terdaftar di root@103.235.75.245).
