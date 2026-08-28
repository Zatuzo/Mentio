#!/usr/bin/env bash
# Deploy script — run from the app directory on the VPS.
# Idempotent: safe to re-run.
set -euo pipefail

echo "──► Ensuring GitHub SSH host key is trusted"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null
chmod 600 ~/.ssh/known_hosts 2>/dev/null || true

echo "──► Pulling latest from main"
git fetch --all --prune
git reset --hard origin/main

echo "──► Installing dependencies (clean)"
rm -rf node_modules
npm ci

echo "──► Generating Prisma client"
npx prisma generate

echo "──► Syncing schema"
npx prisma db push --skip-generate --accept-data-loss

echo "──► Environment diagnostics"
echo "  node: $(node --version)"
echo "  npm:  $(npm --version)"
echo "  cwd:  $(pwd)"
echo "  disk: $(df -h . | tail -1 | awk '{print $4 " free of " $2}')"

echo "──► Building Next.js (clean build)"
rm -rf .next
NODE_OPTIONS='--max-old-space-size=1536' npm run build

echo "──► Verifying build manifests"
MANIFEST_COUNT=$(find .next/server/app -name "*client-reference-manifest.js" 2>/dev/null | wc -l)
echo "  Found $MANIFEST_COUNT manifest file(s)"
find .next/server/app -name "*client-reference-manifest.js" 2>/dev/null | while read f; do
  SIZE=$(wc -c < "$f")
  echo "  $f — ${SIZE} bytes"
  if [ "$SIZE" -lt 200 ]; then
    echo "  !! WARNING: manifest file is suspiciously small — build may be corrupted"
  fi
done

echo "──► Restarting PM2 services"
# Always delete + start to guarantee correct args are saved on every deploy.
# pm2 restart reuses old config — not safe when script args change.
pm2 delete mentio-web          2>/dev/null || true
pm2 delete mentio-listener     2>/dev/null || true
pm2 delete mentio-cron         2>/dev/null || true
pm2 delete mentio-reminders    2>/dev/null || true
pm2 delete mentio-canvas-ws    2>/dev/null || true

APP_DIR="$(pwd)"
pm2 start node_modules/.bin/next --name mentio-web      --cwd "$APP_DIR" -- start -p 9000
pm2 start npm                   --name mentio-listener  --cwd "$APP_DIR" --stop-exit-codes 5 -- run listener
pm2 start src/summarizer.js     --name mentio-cron      --cwd "$APP_DIR" -- --cron
pm2 start npm                   --name mentio-reminders --cwd "$APP_DIR" -- run reminders
pm2 start src/ws-server.js      --name mentio-canvas-ws --cwd "$APP_DIR"
pm2 save

echo "──► Waiting 5s for processes to stabilize..."
sleep 5
pm2 list
echo "──► mentio-web recent logs:"
pm2 logs mentio-web --lines 20 --nostream || true

echo "──► Patching Nginx: ensure client_max_body_size 20m (best-effort)"
{
  NGINX_CONF=""
  for candidate in \
      /etc/nginx/sites-available/mentio.space \
      /etc/nginx/sites-available/default \
      /etc/nginx/conf.d/mentio.conf \
      /etc/nginx/conf.d/default.conf; do
    if [ -f "$candidate" ]; then
      NGINX_CONF="$candidate"
      break
    fi
  done

  if [ -n "$NGINX_CONF" ]; then
    if grep -q "client_max_body_size" "$NGINX_CONF" 2>/dev/null || \
       sudo grep -q "client_max_body_size" "$NGINX_CONF" 2>/dev/null; then
      (sed -i 's/client_max_body_size[^;]*;/client_max_body_size 20m;/' "$NGINX_CONF" 2>/dev/null || \
       sudo sed -i 's/client_max_body_size[^;]*;/client_max_body_size 20m;/' "$NGINX_CONF" 2>/dev/null) && \
        echo "  Updated existing client_max_body_size in $NGINX_CONF"
    else
      (sed -i '/server_name/a\    client_max_body_size 20m;' "$NGINX_CONF" 2>/dev/null || \
       sudo sed -i '/server_name/a\    client_max_body_size 20m;' "$NGINX_CONF" 2>/dev/null) && \
        echo "  Added client_max_body_size 20m to $NGINX_CONF"
    fi
    (nginx -t && systemctl reload nginx || sudo nginx -t && sudo systemctl reload nginx) 2>/dev/null && \
      echo "  Nginx reloaded OK" || echo "  !! Nginx reload skipped (no sudo) — run manually once"
  else
    echo "  !! Nginx config not found — skip"
  fi
} || echo "  !! Nginx patch skipped (permissions) — add client_max_body_size 20m manually"

echo "──► Deploy complete: $(git rev-parse --short HEAD)"
