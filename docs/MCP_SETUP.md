# MCP Setup Guide

## 1. Buat API Key

Buka dashboard Mentio → **Settings → Developer → API Keys** → klik "Buat API Key Baru".

Saat key berhasil dibuat, config MCP sudah otomatis muncul (pre-filled dengan key asli) — tinggal copy.

## 2. Copy Config ke Claude Code

Copy config yang muncul dan paste ke `~/.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "mentio": {
      "command": "npx",
      "args": ["mentio-mcp@latest"],
      "env": {
        "MENTIO_API_KEY": "mentio_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "MENTIO_BASE_URL": "https://your-mentio-domain.com"
      }
    }
  }
}
```

Tidak perlu clone repo atau install apa-apa — `npx` otomatis menangani sisanya.

## 3. Restart Claude Code

Setelah save config, restart Claude Code. MCP "mentio" akan tersedia.

---

## Publish ke npm (untuk self-hosters)

Agar `npx mentio-mcp@latest` berfungsi, package perlu dipublish ke npm:

```bash
npm run build:mcp   # build dist/mcp-server.js
npm publish --access=public
```

Untuk development lokal sebelum publish, gunakan path langsung:

```json
{
  "mcpServers": {
    "mentio": {
      "command": "node",
      "args": ["/absolute/path/to/dist/mcp-server.js"],
      "env": {
        "MENTIO_API_KEY": "mentio_xxx",
        "MENTIO_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

---

## Tools yang tersedia

| Tool | Deskripsi |
|---|---|
| `get_mentions` | Ambil mention terbaru, bisa filter per group/waktu/teks |
| `get_mention` | Detail satu mention + konteks percakapan |
| `list_groups` | List semua group yang di-watch |
| `list_projects` | List semua project + statistik |
| `list_tasks` | List task dengan filter status/project/group |
| `get_task` | Detail satu task + mention asalnya |
| `update_task_status` | Update status/priority task |
| `create_task_from_mention` | Buat task dari mention |
| `get_summary` | Ambil AI summary group |
| `trigger_summarize` | Jalankan summarization on-demand |
| `get_listener_status` | Cek status koneksi WA |

## Prompts yang tersedia

| Prompt | Deskripsi |
|---|---|
| `daily_standup` | Generate standup dari task kemarin + hari ini |
| `mention_triage` | Triage mention — urgent/normal/defer/info |
| `task_brief` | Brief singkat satu task untuk di-share ke tim |
| `group_health` | Analisis kesehatan group (frekuensi, overdue, pola) |

## Contoh penggunaan

```
"Ada mention urgent dari group dev-team hari ini?"
"List task yang masih open di project Mentio"
"Trigger summarize group dev-team sekarang"
"Buat standup dari project ini"
"Update task TASK-ID jadi in_progress"
```
