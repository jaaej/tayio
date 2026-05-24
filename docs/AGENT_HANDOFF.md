# Phase 2 — Agent Handoff

Phase 1 (foundation) is complete. Four agents can now work in parallel.

## What's already done (do not change without coordination)

- **Database schema** — `src/db/schema.ts` (Drizzle, snake_case). This is the contract every role agent depends on. Schema changes require a co-ordinated migration.
- **Auth** — `src/lib/auth.ts`, `src/lib/supabase/*`, `src/middleware.ts`. Role gating is enforced at the middleware and in each role layout's `requireRole(...)` call.
- **Design system** — `src/app/globals.css`, `src/components/ui/*`, `src/components/brand/*`, `src/components/portal/shell.tsx`. Use these primitives; don't introduce new component libraries.
- **Landing + auth pages** — `src/app/page.tsx`, `src/app/(auth)/*`.
- **Role layout shells + placeholder dashboards** — already exist for student/parent/tutor/admin.

## Ownership boundaries

Each role agent owns:

| Agent | UI folder | API folder |
|-------|-----------|------------|
| Student | `src/app/student/**` | `src/app/api/student/**` |
| Parent  | `src/app/parent/**`  | `src/app/api/parent/**`  |
| Tutor   | `src/app/tutor/**`   | `src/app/api/tutor/**`   |
| Admin   | `src/app/admin/**`   | `src/app/api/admin/**`   |

These folders are disjoint — agents cannot create merge conflicts in each other's pages.

## Shared zones (touch carefully)

- `src/db/schema.ts` — changes affect everyone. Discuss before editing.
- `src/components/ui/*` and `src/components/portal/shell.tsx` — additive changes only. If you need a new variant, add it; don't change defaults.
- `src/lib/auth.ts`, `src/middleware.ts` — auth/security. Don't modify without review.

## Phase 2 deliverables per agent

Refer to the matching PRD in `docs/PRD_*.md` for the full feature list. MVP scope per role:

- **Student** — timetable, homework list + submission, lesson recaps, dashboard polish.
- **Parent** — attendance view, homework completion, tutor feedback feed, child switcher (uses `family_links`).
- **Tutor** — today's classes, student profiles, attendance marking, lesson note form, homework upload + marking.
- **Admin** — user CRUD, class CRUD, enrolment management, basic invoice list, announcements.

## Phase 3 (after role tracks)

Cross-cutting work, single owner each:
1. **Notifications** — `notifications` table is already in schema; build delivery + in-app feed.
2. **Payments** — Stripe integration on top of existing `invoices` table.
3. **Reports** — admin reporting dashboard reading across schemas.
