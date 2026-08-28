#!/usr/bin/env bash
# Install GitHub Actions self-hosted runner on this VPS.
# Run once as the user yang sama dengan VPS_APP_DIR (bukan root).
#
# Usage: bash scripts/setup-runner.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO="Resanso/mentio"
RUNNER_LABEL="self-hosted"   # label yang dipakai di RUNNER_LABEL Variable GitHub
RUNNER_DIR="$HOME/actions-runner"
# Cek versi terbaru: https://github.com/actions/runner/releases
RUNNER_VERSION="2.334.0"

# ── 1. Download runner ────────────────────────────────────────────────────────
echo "──► Creating runner directory: $RUNNER_DIR"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

ARCHIVE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
if [ ! -f "$ARCHIVE" ]; then
  echo "──► Downloading runner v${RUNNER_VERSION}..."
  curl -fsSL -o "$ARCHIVE" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${ARCHIVE}"
fi

echo "──► Extracting..."
tar xzf "$ARCHIVE"
rm -f "$ARCHIVE"

# ── 2. Get registration token ─────────────────────────────────────────────────
echo ""
echo "──► Langkah selanjutnya: dapatkan token registrasi"
echo ""
echo "    Buka URL berikut di browser:"
echo "    https://github.com/${REPO}/settings/actions/runners/new?runnerOs=linux"
echo ""
echo "    Copy token yang muncul (berlaku 1 jam), lalu jalankan:"
echo ""
echo "    cd $RUNNER_DIR"
echo "    ./config.sh \\"
echo "      --url https://github.com/${REPO} \\"
echo "      --token <PASTE_TOKEN_DISINI> \\"
echo "      --labels ${RUNNER_LABEL} \\"
echo "      --name $(hostname)-runner \\"
echo "      --unattended \\"
echo "      --replace"
echo ""

# ── 3. Panduan install service ────────────────────────────────────────────────
cat << 'GUIDE'
──► Setelah config berhasil, install sebagai systemd service:

    sudo ./svc.sh install
    sudo ./svc.sh start
    sudo ./svc.sh status     # pastikan "active (running)"

──► Cek runner muncul di GitHub:
    https://github.com/Resanso/mentio/settings/actions/runners
    Status harus: "Idle"

──► Set GitHub repo Variables (bukan Secrets):
    https://github.com/Resanso/mentio/settings/variables/actions

    RUNNER_LABEL = self-hosted
    DEPLOY_MODE  = local

──► Untuk pindah ke VPS lain:
    1. Di VPS lama:  cd ~/actions-runner && sudo ./svc.sh stop && sudo ./svc.sh uninstall
    2. Di VPS baru:  jalankan script ini lagi
    3. Update RUNNER_LABEL jika nama label berubah
    Tidak perlu ubah workflow file.

──► Untuk kembali ke GitHub-hosted runner (darurat):
    Hapus/kosongkan variabel RUNNER_LABEL dan DEPLOY_MODE di GitHub.
    Workflow otomatis pakai ubuntu-latest + SSH.
GUIDE
