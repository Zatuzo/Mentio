# Migration Guide — VPS & Domain

> Referensi untuk migrasi VPS atau domain di masa depan.
> Diperbarui terakhir: Juni 2026 (migrasi SumoPod → Jetorbit)

---

## Arsitektur yang Perlu Diperhatikan saat Migrasi

| Komponen | Ikut Pindah? | Catatan |
|---|---|---|
| App code | ✅ Clone dari GitHub | Tidak perlu copy manual |
| `.env` | ✅ Copy dari VPS lama | Berisi semua secrets & config |
| `auth_info/` | ✅ Copy dari VPS lama | Session WhatsApp Baileys — kalau tidak dipindah harus scan QR ulang |
| Database | ❌ Tidak perlu | Neon PostgreSQL remote — sama antara local & production |
| SSL/TLS | ❌ Tidak perlu | Domain-based, bukan VPS-based |

---

## Checklist Migrasi VPS (Domain Sama)

### Fase 1 — Provision VPS Baru

```
[ ] Order VPS baru, catat IP publik
[ ] Pilih OS: Ubuntu 22.04 LTS
[ ] Tambah SSH key (id_rsa.pub dari Mac) saat setup
[ ] Pastikan bisa SSH: ssh root@<IP_BARU>
```

### Fase 2 — Setup VPS Baru

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git build-essential

# Install PM2
npm install -g pm2

# Tambah SSH key Mac ke authorized (kalau belum)
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
```

### Fase 3 — Setup GitHub Deploy Key

```bash
# Generate key di VPS baru
ssh-keygen -t ed25519 -C "mentio-vps-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub  # copy output ini

# Tambah SSH config
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
EOF
chmod 600 ~/.ssh/config
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

Daftarkan public key di: **github.com/Resanso/mentio/settings/keys/new**
- Title: `mentio-<provider>-vps`
- Allow write access: ✓

### Fase 4 — Clone & Setup App

```bash
# Buat user ubuntu (runner tidak boleh root)
useradd -m -s /bin/bash ubuntu

# Clone repo
su - ubuntu -c "ssh-keyscan github.com >> ~/.ssh/known_hosts"
git clone git@github.com:Resanso/mentio.git /home/ubuntu/mentio
chown -R ubuntu:ubuntu /home/ubuntu/mentio
```

### Fase 5 — Copy Data dari VPS Lama

```bash
# Dari Mac — copy .env
ssh root@<IP_LAMA> "cat ~/mentio/.env" | ssh root@<IP_BARU> "cat > /home/ubuntu/mentio/.env"

# Copy auth_info (WA session)
ssh root@<IP_LAMA> "cd ~/mentio && tar czf - auth_info/" | \
  ssh root@<IP_BARU> "cd /home/ubuntu/mentio && tar xzf -"

chown -R ubuntu:ubuntu /home/ubuntu/mentio/auth_info
```

### Fase 6 — Build & Start

```bash
su - ubuntu -c "cd /home/ubuntu/mentio && npm ci && npx prisma generate && npm run build"
su - ubuntu -c "cd /home/ubuntu/mentio && pm2 start ecosystem.config.js"
su - ubuntu -c "pm2 save"

# Setup PM2 auto-start
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### Fase 7 — Setup GitHub Actions Runner

```bash
mkdir -p /home/ubuntu/actions-runner
cd /home/ubuntu/actions-runner

# Download runner (cek versi terbaru di github.com/Resanso/mentio/settings/actions/runners/new)
curl -o actions-runner-linux-x64-2.335.1.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.335.1/actions-runner-linux-x64-2.335.1.tar.gz
tar xzf ./actions-runner-linux-x64-2.335.1.tar.gz

chown -R ubuntu:ubuntu /home/ubuntu/actions-runner

# Configure (token dari github.com/Resanso/mentio/settings/actions/runners/new — expired dalam 1 jam)
su - ubuntu -c "cd /home/ubuntu/actions-runner && ./config.sh \
  --url https://github.com/Resanso/mentio \
  --token <TOKEN_DARI_GITHUB> \
  --name mentio-<provider> \
  --labels self-hosted \
  --unattended"

# Install sebagai service
./svc.sh install ubuntu
./svc.sh start
```

### Fase 8 — Update GitHub Secrets

Di **github.com/Resanso/mentio/settings/secrets/actions**, update:

| Secret | Nilai |
|---|---|
| `VPS_HOST` | IP baru |
| `VPS_USER` | `root` atau `ubuntu` |
| `VPS_APP_DIR` | `/home/ubuntu/mentio` |
| `VPS_SSH_KEY` | Isi dengan `cat ~/.ssh/mentio_deploy` |

### Fase 9 — Update DNS

Di registrar domain (saat ini: Hostinger → mentio.space):
- Update A record `@` ke IP VPS baru
- TTL: 300 (rendah) saat migrasi, naikkan ke 14400 setelah stabil
- Propagasi: 1–24 jam tergantung TTL lama

### Fase 10 — Verify & Cleanup

```bash
# Test health check
curl http://localhost:9000/api/health

# Test CI/CD
git commit --allow-empty -m "chore: test deploy ke <provider>" && git push

# Setelah semua OK, matikan VPS lama
```

---

## Checklist Migrasi Domain Saja (VPS Sama)

```
[ ] Beli domain baru
[ ] Update A record domain baru → IP VPS saat ini
[ ] Update .env di VPS: BETTER_AUTH_URL, NEXT_PUBLIC_BETTER_AUTH_URL, APP_URL
[ ] Update Google OAuth callback URL di console.cloud.google.com
[ ] Update GitHub OAuth callback URL di github.com/settings/developers
[ ] Rebuild & restart: npm run build && pm2 reload mentio-web
[ ] Update docs/DEPLOY.md
```

---

## Google OAuth — Callback URLs yang Harus Diupdate saat Ganti Domain

Di **console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client**:

**Authorized redirect URIs:**
```
https://<DOMAIN_BARU>/api/auth/callback/google
https://<DOMAIN_BARU>/api/calendar/google/callback
```

**Authorized JavaScript origins:**
```
https://<DOMAIN_BARU>
```

---

## GitHub OAuth — Callback URL saat Ganti Domain

Di **github.com/settings/developers → OAuth Apps → mentio**:
```
Homepage URL: https://<DOMAIN_BARU>
Authorization callback URL: https://<DOMAIN_BARU>/api/auth/callback/github
```

---

## Perbedaan Deploy Mode

Workflow CI/CD mendukung dua mode (dikontrol via GitHub Variables):

| Mode | RUNNER_LABEL | DEPLOY_MODE | Cara Kerja |
|---|---|---|---|
| **Local** (aktif) | `self-hosted` | `local` | Runner di VPS langsung jalankan deploy.sh |
| **SSH** (fallback) | kosong | kosong | GitHub runner SSH ke VPS |

Untuk pindah ke SSH mode: hapus/kosongkan `RUNNER_LABEL` dan `DEPLOY_MODE` di GitHub Variables.

---

## Catatan Penting

- **Runner token expired dalam ~1 jam** — minta token baru di halaman runners kalau config gagal
- **Runner tidak boleh jalan sebagai root** — selalu setup di user `ubuntu`
- **auth_info = session WA** — wajib dipindah, tanpa ini WA harus scan QR ulang dari awal
- **Database Neon tidak perlu dipindah** — sudah remote dan shared
- **`prisma db push` bukan `migrate deploy`** di production — Neon tidak support advisory lock

---

## Riwayat Migrasi

| Tanggal | Dari | Ke | Domain |
|---|---|---|---|
| Jun 2026 | SumoPod (43.133.158.53) | Jetorbit (103.235.75.245) | mentio.space |
