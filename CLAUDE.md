# WA Mention Agent

<!-- eksperimen commit date -->

## Development Workflow

**Baca `docs/WORKFLOW.md` sebelum mengerjakan fitur apapun.**

Ringkasan: user diskusi fitur → Claude plan + coding + tulis test → Claude spawn sub-agent untuk `npm test` + git push → GitHub Actions deploy ke VPS. User tidak perlu melakukan apapun setelah diskusi awal selesai.

---

## Goal
Build a WhatsApp mention monitoring agent that:
- Listens to specified WhatsApp groups via Baileys
- Filters only messages that mention my JID
- Stores mentions in SQLite via Prisma
- Generates summaries via Claude API (Sonnet)
- Serves a web dashboard (Next.js) showing summaries per group

## Tech Stack
- Runtime: Node.js 20+
- WhatsApp: @whiskeysockets/baileys
- Database: SQLite + Prisma
- AI: @anthropic-ai/sdk (Claude Sonnet)
- Frontend: Next.js 14 + Tailwind CSS

## Architecture
1. listener.js — connects to WA, filters mentions by MY_JID
2. database — Prisma schema: Mention, Summary tables
3. summarizer.js — cron job, batches unprocessed mentions per group, 
   calls Claude API
4. web dashboard — shows summaries grouped by project/group, 
   with timestamp + sender + message context for navigation

## Key Config
- MY_JID: 62xxxx@s.whatsapp.net
- Groups: configured via .env or admin page

## Constraints
- Baileys unofficial library — listener only, no sending
- Summary runs every 4 hours or on-demand via dashboard button
- Cost-efficient: only process tagged messages
