# Tayio Tuition Portal

Role-based web portal for Taiyo Tuition (Mount Waverley, VIC) - students, parents, tutors, and admins each get their own dashboard, surfacing only what they need.

Built on **Next.js 16 (App Router) · React 19 · Supabase auth · Drizzle ORM · Postgres · Tailwind v4**.

## Status - Phase 1 complete

- ✅ Foundation: auth, role middleware, schema (14 tables), design system
- ⏳ Phase 2: role-track features (4 parallel agents - see `docs/AGENT_HANDOFF.md`)
- ⏳ Phase 3: notifications, payments, reports

## Quick start

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # then fill in Supabase keys
npm run db:push              # applies schema to your Supabase project
npm run dev
```

Open http://localhost:3000.

## Project structure

```
src/
  app/
    page.tsx              landing
    (auth)/login,signup   public auth pages
    student/              student portal - owned by Student agent
    parent/               parent portal - owned by Parent agent
    tutor/                tutor portal  - owned by Tutor agent
    admin/                admin portal  - owned by Admin agent
    api/{role}/           role-scoped API routes (same ownership rule)
  components/
    ui/                   shared primitives (Button, Card, Input)
    portal/shell.tsx      role-aware nav + layout
    brand/wordmark.tsx    Taiyo wordmark (sun-dot on the i)
  db/
    schema.ts             single source of truth - Drizzle schema
    client.ts             postgres-js + drizzle client
  lib/
    supabase/             browser, server, middleware clients
    auth.ts               requireRole() helper
  middleware.ts           role-gating proxy
docs/
  PRD_*.md                role-specific PRDs
  AGENT_HANDOFF.md        Phase 2 ownership boundaries
```

## Parallel-agent rules

Each role agent owns `src/app/{role}/**` and `src/app/api/{role}/**` exclusively. Shared zones (`src/db/schema.ts`, `src/components/ui/*`, `src/lib/auth.ts`, `src/middleware.ts`) require coordination - see `docs/AGENT_HANDOFF.md`.

## Scripts

| Command | What |
|---------|------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm run db:push` | Push schema → database |
| `npm run db:generate` | Generate SQL migrations |
| `npm run db:studio` | Drizzle Studio (browse DB) |

## Brand

Palette and typography extracted from [taiyotuition.com](https://taiyotuition.com):
- Primary blue `#3482FF`
- Sun accent `#FFB547` (太陽 / *taiyo* = sun)
- Poppins + Instrument Serif (italic accents)
