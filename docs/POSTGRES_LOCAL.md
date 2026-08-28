# PostgreSQL Lokal — Setup & Akses via SSH

VPS Mentio (103.235.75.245) menggunakan PostgreSQL 14 yang berjalan secara lokal,
menggantikan Neon yang quota-nya terbatas.

---

## Koneksi Database

```
Host:     localhost (hanya dari dalam VPS)
Port:     5432
User:     mentio_user
Password: mentio_pass_2026
Database: mentio_db
```

**DATABASE_URL** (di `/home/ubuntu/mentio/.env`):
```
postgresql://mentio_user:mentio_pass_2026@localhost:5432/mentio_db
```

---

## Cara Akses via SSH (untuk Troubleshooting)

### 1. SSH langsung ke VPS lalu jalankan psql

```bash
ssh -i ~/.ssh/id_rsa root@103.235.75.245

# Setelah masuk VPS:
PGPASSWORD='mentio_pass_2026' psql -U mentio_user -h localhost -d mentio_db
```

### 2. SSH Tunnel — akses dari mesin lokal

Buka tunnel di terminal pertama:
```bash
ssh -i ~/.ssh/id_rsa -N -L 5433:localhost:5432 root@103.235.75.245
```

Lalu di terminal lain, koneksi ke `localhost:5433` seolah-olah di VPS:
```bash
# psql
PGPASSWORD='mentio_pass_2026' psql -U mentio_user -h localhost -p 5433 -d mentio_db

# Prisma Studio (jalankan di repo lokal)
DATABASE_URL="postgresql://mentio_user:mentio_pass_2026@localhost:5433/mentio_db" npx prisma studio
```

### 3. One-liner — jalankan query dari mesin lokal

```bash
ssh -i ~/.ssh/id_rsa root@103.235.75.245 \
  "PGPASSWORD='mentio_pass_2026' psql -U mentio_user -h localhost -d mentio_db -c 'SELECT COUNT(*) FROM \"user\";'"
```

---

## Perintah Psql yang Sering Dipakai

```sql
-- List semua tabel
\dt

-- Lihat schema tabel
\d "User"

-- Hitung rows
SELECT COUNT(*) FROM "user";
SELECT COUNT(*) FROM "Mention";
SELECT COUNT(*) FROM "Task";

-- Lihat user terdaftar
SELECT id, name, email, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 10;

-- Lihat session aktif
SELECT id, "userId", "expiresAt" FROM "session" ORDER BY "expiresAt" DESC LIMIT 10;

-- Keluar psql
\q
```

---

## Cara Claude Akses untuk Troubleshooting

Claude punya akses SSH ke VPS via `~/.ssh/id_rsa` sebagai `root@103.235.75.245`.

Untuk troubleshooting database, Claude bisa langsung menjalankan:

```bash
# Dari mesin Mac lokal:
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no root@103.235.75.245 \
  "PGPASSWORD='mentio_pass_2026' psql -U mentio_user -h localhost -d mentio_db -c '<QUERY>'"
```

Contoh query diagnostik:
```bash
# Cek semua tabel dan jumlah rows
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no root@103.235.75.245 "
PGPASSWORD='mentio_pass_2026' psql -U mentio_user -h localhost -d mentio_db << 'SQL'
SELECT schemaname, tablename, n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
SQL
"

# Cek ukuran database
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no root@103.235.75.245 \
  "sudo -u postgres psql -c 'SELECT pg_size_pretty(pg_database_size(''mentio_db''));'"

# Cek koneksi aktif
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no root@103.235.75.245 \
  "sudo -u postgres psql -c 'SELECT * FROM pg_stat_activity WHERE datname = ''mentio_db'';'"
```

---

## Backup Manual

```bash
# Dari VPS:
PGPASSWORD='mentio_pass_2026' pg_dump \
  -U mentio_user -h localhost mentio_db \
  > /home/ubuntu/mentio_backup_$(date +%Y%m%d_%H%M%S).sql

# Download backup ke mesin lokal:
scp -i ~/.ssh/id_rsa root@103.235.75.245:/home/ubuntu/mentio_backup_*.sql .
```

---

## Restore dari Backup

```bash
PGPASSWORD='mentio_pass_2026' psql \
  -U mentio_user -h localhost -d mentio_db \
  < mentio_backup_YYYYMMDD_HHMMSS.sql
```

---

## PostgreSQL Service Management

```bash
# Dari VPS sebagai root:
systemctl status postgresql   # cek status
systemctl restart postgresql  # restart
systemctl stop postgresql     # stop
systemctl start postgresql    # start

# Log PostgreSQL:
tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## Konfigurasi Files

- **Config utama**: `/etc/postgresql/14/main/postgresql.conf`
- **Auth rules**: `/etc/postgresql/14/main/pg_hba.conf`
- **Data directory**: `/var/lib/postgresql/14/main/`
- **Log**: `/var/log/postgresql/postgresql-14-main.log`

Saat ini PostgreSQL hanya bisa diakses dari `localhost` (tidak expose ke publik) —
ini sudah benar untuk security. Akses dari luar selalu via SSH tunnel.
