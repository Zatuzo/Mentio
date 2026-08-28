# Canvas WebSocket — Nginx Setup (One-Time Manual Config)

The canvas realtime sync server (`mentio-canvas-ws`) runs on port **1999**.
Nginx must proxy `/canvas-ws` WebSocket connections to it.

## Step

SSH ke VPS, lalu edit nginx config untuk mentio.space:

```bash
sudo nano /etc/nginx/sites-available/mentio.space
```

Tambahkan **sebelum** `location /` block:

```nginx
# Canvas realtime WebSocket sync
location /canvas-ws {
    proxy_pass http://127.0.0.1:1999/canvas-ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

Lalu reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Env var

Di `/home/ubuntu/mentio/.env`, tambahkan:

```
NEXT_PUBLIC_WS_URL=wss://mentio.space
WS_PORT=1999
```

## Verifikasi

```bash
# Cek ws-server berjalan
pm2 list | grep canvas-ws

# Cek port 1999 listening
ss -tlnp | grep 1999

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  https://mentio.space/canvas-ws?roomId=test
```
