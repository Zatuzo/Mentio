# Product Roadmap — WA Mention Agent

> Solo founder strategy: nail the WA-native niche first, scale to full task management after traction, pursue B2B partnerships after product-market fit.

---

## Vision

**Phase 1 (now):** WhatsApp mention monitoring with AI summaries  
**Phase 2 (after 100 users):** Full task management — mentions become tasks  
**Phase 3 (B2B):** Team workspace, SSO, enterprise integrations  

Competitive edge over Jira/ClickUp:
- WA-native (they don't have this)
- AI summary out of the box
- Speed of iteration as a solo founder

---

## Current Stack

| Layer | Tech | Status |
|-------|------|--------|
| Frontend | Next.js 14 App Router + Tailwind | ✓ Done |
| Auth | Better Auth (email+password) | ✓ Done |
| Database | SQLite + Prisma | ⚠️ Must migrate |
| AI | DeepSeek (OpenAI-compatible) | ✓ Done |
| WA Listener | Baileys (shared + own mode) | ✓ Done |
| Multi-user | userId isolation, plan limits | ✓ Done |
| UI Library | Custom Tailwind | ⚠️ Upgrade to shadcn/ui |
| State (client) | None (full SSR) | ⚠️ Add TanStack Query |
| Job queue | node-cron | ⚠️ Upgrade when needed |
| Process manager | None | ⚠️ Add PM2 |
| Monitoring | console.log | ⚠️ Add Sentry |

---

## Phase 1 — Production-Ready MVP
> Target: launch + first 50 users

### P0 — Must do before launch

- [ ] **Migrate SQLite → PostgreSQL (Neon)**
  - Neon free tier: 0.5 GB, serverless, branching for dev/prod
  - Update `prisma/schema.prisma` provider to `postgresql`
  - Update `DATABASE_URL` in `.env`
  - Run `prisma migrate dev`
  - Why now: SQLite has write locking issues under concurrent load; migration is painful after data grows

- [ ] **Setup shadcn/ui**
  - Run `npx shadcn-ui@latest init`
  - Replace custom buttons, inputs, cards with shadcn components
  - Add `Button`, `Input`, `Card`, `Badge`, `Dialog`, `Switch`, `Table`
  - Immediate visual improvement, foundation for all future UI

- [ ] **Add TanStack Query**
  - Wrap app with `QueryClientProvider`
  - Replace manual `fetch` in Client Components with `useQuery` / `useMutation`
  - Benefit: optimistic updates, background refetch, loading/error states built-in

- [ ] **Setup PM2 for listener**
  - `npm install -g pm2`
  - Create `ecosystem.config.js` for listener + cron processes
  - Auto-restart on crash, log management, startup on reboot
  - Prevents listener from dying silently

- [ ] **Sentry error monitoring**
  - `npm install @sentry/nextjs`
  - Free tier: 5k errors/month
  - Catch and alert on production errors before users report them

### P1 — Nice to have for launch

- [ ] **Deployment setup**
  - Recommended: Railway (monorepo-friendly, affordable)
  - Alternatively: Render or a single VPS with PM2
  - Dockerfile for listener process

- [ ] **Rate limiting on API routes**
  - Simple: use `@upstash/ratelimit` (free tier)
  - Protect `/api/summarize` and auth endpoints

- [ ] **Email on register**
  - Welcome email via Resend (free tier: 3k/month)
  - Basic transactional flow

---

## Phase 2 — Growth Features
> Trigger: 100+ active users

- [ ] **Mention → Task conversion**
  - Each mention can be promoted to a "Task" with status, assignee, due date
  - New `Task` model in Prisma
  - Dashboard shows task board (Kanban view)
  - This is the core differentiator vs plain WA monitoring

- [ ] **Real-time updates (SSE)**
  - Server-Sent Events for live mention notifications
  - Dashboard badge updates without page refresh
  - Cheaper than WebSocket for read-heavy use case

- [ ] **Notifications**
  - In-app: unread mention badge
  - Email digest: daily/weekly summary
  - Push (PWA): browser notifications for urgent mentions

- [ ] **Group analytics**
  - Mention frequency per group
  - Response rate tracking
  - Peak hours heatmap

- [ ] **Mobile-first responsive UI**
  - Most users will check on mobile
  - Consider PWA manifest for add-to-home-screen

- [ ] **BullMQ job queue**
  - Replace `node-cron` with proper queue (requires Redis)
  - Retry failed summarizations
  - Priority queue for pro users
  - Defer until cron becomes a bottleneck

---

## Phase 3 — B2B Ready
> Trigger: first enterprise/partner inquiry

- [ ] **Team workspace**
  - Organization model (one org, multiple members)
  - Role-based access: admin, member, viewer
  - Shared groups and tasks within org

- [ ] **SSO / SAML**
  - Better Auth supports this via plugins
  - Required for enterprise procurement

- [ ] **Audit log**
  - Track all actions per user
  - Required for enterprise compliance

- [ ] **SLA & uptime**
  - Status page (BetterUptime or similar)
  - 99.9% uptime SLA for paid B2B contracts

- [ ] **Dedicated onboarding**
  - White-glove setup for B2B clients
  - Custom group configuration
  - Training session

- [ ] **API for integrations**
  - REST API with API keys
  - Webhook support (push mentions to external systems)
  - Connect to Jira/Linear/Notion as downstream task managers

---

## Recommended Final Stack (stable, no need to replace)

| Layer | Choice | Notes |
|-------|--------|-------|
| Database | PostgreSQL (Neon) | Free tier → paid as needed |
| ORM | Prisma | Already in use |
| Auth | Better Auth | Add SSO plugin later |
| Frontend | Next.js + shadcn/ui | Competitive UI |
| State | TanStack Query | Industry standard |
| AI | DeepSeek / pluggable | Swap model anytime |
| WA | Baileys | Unofficial, monitor updates |
| Process | PM2 | Simple, reliable |
| Deploy | Railway / Render | Solo-founder friendly |
| Monitoring | Sentry | Free tier sufficient |
| Email | Resend | Free tier sufficient |

---

## What NOT to build yet

> As a solo founder, say no to these until there's clear demand:

- ❌ Mobile native app (React Native) — PWA is enough for now
- ❌ Microservices — monolith scales further than you think
- ❌ GraphQL — REST + TanStack Query is sufficient
- ❌ Multi-region deployment — single region is fine pre-B2B
- ❌ Custom message broker (Kafka) — overkill for current scale
- ❌ Feature parity with Jira/ClickUp — compete on WA-native niche

---

## Key Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Baileys breaks on WA update | Medium | Monitor Baileys releases, have reconnect logic |
| SQLite corruption under load | High if not migrated | **Migrate to PostgreSQL ASAP** |
| Solo burnout | High | Scope ruthlessly, automate repetitive work |
| WA ToS enforcement | Low-Medium | Offer "own WA" mode, listener-only (no sending) |
| AI cost spike | Low | DeepSeek is cheap; only process tagged messages |

---

*Last updated: May 2026*
