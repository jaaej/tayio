# Current engineering handoff

Last reconciled with the repository and live infrastructure: **10 October 2026**.

This file is the fastest safe entry point for another coding agent. It replaces
the old Phase 2/four-agent placeholder handoff: the application is now a
production beta with all four role portals implemented.

## Verified deployment snapshot

- Production URL: `https://portal.taiyotuition.com`
- Vercel project: `tayio`; region: `syd1`
- Production status checked on 6 October 2026: `Ready`, custom-domain alias
  attached.
- Application code baseline at the start of this documentation audit:
  `49801e0` (`revert: remove wave artwork from login`).
- Domain CNAME resolves to Vercel.
- Resend DKIM, SPF, and MX DNS records resolve for the sending subdomain.
- Production Vercel contains the expected Supabase, database, cron, admin-PIN,
  and Resend variable names. Values are intentionally not recorded here.

Use `npx vercel@latest inspect https://portal.taiyotuition.com` for the current
deployment rather than treating this dated snapshot as permanent.

## Product state

The implemented surface is summarized in `README.md` and documented in detail
in `docs/features.md`. The active acceptance backlog is
`checklist_beta_fix.md`.

Important completed systems include:

- tiered admin/student roles and server-side role/ownership guards;
- user creation, linked parent creation, profile notes, postal/contact fields,
  activation/deactivation, password setup/reset, and owner-only hard delete;
- recurring classes and rolling lesson generation;
- student/parent rescheduling, make-up lesson isolation, permanent class moves,
  and role-specific notifications;
- tutor recurring availability, absence/leave approval, cover claims, admin
  reassignment, reminders, and clash checks;
- weekly tutor check-ins with snapshotted rates, owner corrections, audit
  history, missing-rate safeguards, and pay totals;
- weekly curriculum, topics, quizzes, in-portal PDF/video viewing, progressive
  week release, enrolment-term restrictions, and admin overrides;
- targeted admin announcements plus tutor class announcements requiring admin
  approval;
- in-app notifications/unread badges for every role and urgent-announcement
  email jobs through Resend;
- Taiyo Blitz with 30-second Sprint, 60-second standard modes, profile icons,
  and year/all-centre leaderboards;
- admin reports/CSV, payments/manual invoice editing, resources, discussions,
  direct messages, and global search.

## Known incomplete or unverified work

Do not convert these into success claims until the matching manual QA item is
checked in `checklist_beta_fix.md`:

- real-inbox account setup/password-reset delivery through **Supabase custom
  SMTP**;
- urgent-announcement email delivery and recipient isolation;
- the complete make-up move/attendance/privacy sequence;
- curriculum week/term locking and PDF/video viewer acceptance across roles;
- admin-created homework, due-date-gated homework solutions, and the compact
  quiz-builder layout require authenticated cross-role browser acceptance;
- inline homework attachment/solution viewing and admin editing of approved
  quizzes require authenticated browser acceptance;
- the connected calendar and permanent-class-time glass layout requires
  authenticated student and parent browser acceptance;
- the shared phone menu, collapsible curriculum weeks rail, calendar/table
  overflow, and full-screen phone file viewers require authenticated manual
  acceptance across all four roles and a desktop regression check;
- empty direct-message drafts, tutor profile-photo upload, and subject-only
  admin homework require authenticated cross-role browser acceptance;
- tutor payroll/check-in acceptance, cron reminders, audit attribution, and
  stale-edit rejection;
- admin global-search and tutor-profile-icon browser checks;
- production timing checks and final multi-role live smoke tests;
- Taiyo imagery (explicitly deferred) and the undefined “move Wednesday” note.

Email status matters: DNS is no longer the blocker. Resend DNS and Vercel
variables are present, but Supabase SMTP configuration and end-to-end delivery
to a normal non-team inbox have not been verified. `_dmarc.taiyotuition.com`
also had no TXT policy when checked on 6 October 2026; add one only after the
current sending flow is confirmed.

## Architecture and security boundaries

- `src/app/{student,parent,tutor,admin}` contains role surfaces.
- `src/components/` contains shared portal, notification, loading, profile,
  viewer, and UI components.
- `src/lib/auth.ts`, `src/lib/roles.ts`, route layouts, and server-action
  ownership checks are the primary authorization boundary.
- Drizzle uses a server database role that can bypass RLS. RLS is important
  defense-in-depth, not a substitute for application guards.
- Auth roles come from Supabase `app_metadata`, never user-editable
  `user_metadata`.
- `admin_restricted` (reception) cannot promote users, manage admin accounts,
  access owner payroll/bank details, or change the owner PIN.
- Student/parent-visible lesson notes use `lesson_notes_safe`; internal tutor
  notes must never be selected into those payloads.
- Private file buckets are `homework-attachments`, `homework-submissions`,
  `curriculum`, `discussion-attachments`, and `resource-library`. Files are
  opened through permission-checked signed URLs.

Read `docs/SECURITY.md`, `docs/security-checklist.md`, and `docs/runbooks.md`
before changing auth, RLS, storage, account deletion, payroll, or production
data.

## Database and migration state

- Drizzle schema: `src/db/schema.ts`
- Ordered SQL: `supabase/migrations/`
- At this audit there are 52 on-disk `.sql` files; the newest is
  `0055_student_curriculum_access.sql`. Numbering has historical gaps, so do not
  infer the file count from the largest prefix.
- Use `npm run db:status` against the intended environment to determine what is
  actually applied.
- Never use schema push on an existing database. `npm run db:push` is guarded
  because schema push can drop raw-SQL policies/views.
- `npm run db:bootstrap -- --confirm` is allowed only for a new empty project.
- Never run seed/demo scripts against production.

Migration `0056_admin_homework_and_solutions.sql` was applied to the isolated
development database on 8 October 2026.
It adds the homework creator and separate solution path and is not yet recorded
as applied to Production.

Migrations `0057_subject_homework_drafts.sql` and
`0058_tutor_profile_photos.sql` were applied to the isolated development
database on 8 October 2026.
They allow classless curriculum homework and create the private
`profile-photos` bucket.
Neither migration is yet recorded as applied to Production.

## Environment separation

Local development should use the developer/test Supabase project. Production
Vercel should use the client production project. Testing against a copy or
development seed must not mutate real client data.

Expected application variable names are in `.env.example`. Production also has
provider-side values used for email/DNS administration; never copy or print
their secrets into documentation, terminal output, issues, or commits.

Before any database command, check which project the selected `DIRECT_URL` and
`DATABASE_URL` refer to. Before local development, confirm `.env.local` is not
the production environment.

## Safe resume workflow

```bash
cd /Users/jaejeon/tayio_portal
git status --short
git log --oneline -8
npm install
npm run typecheck
npm test
npm run build
```

For browser work, start `npm run dev` and use non-client test accounts. Keep one
dev server only; after code/server-action changes, refresh the browser so it
does not submit an action identifier from an older build.

For a feature change:

1. Read the relevant role route, shared library, schema, and latest dated change
   note before editing.
2. Preserve unrelated user changes in the worktree.
3. Add or update focused tests for business rules.
4. Run typecheck, tests, and a production build.
5. Update both `checklist_beta_fix.md` and the relevant durable documentation in
   the same commit.
6. Push only after reviewing the diff. A push is not deployment proof; inspect
   Vercel and run the live acceptance case.

## Documentation priority

The complete document map and audit boundary are in `docs/README.md`.

When documents disagree, use this order:

1. Current code, migrations, and tests.
2. `checklist_beta_fix.md` for open acceptance work.
3. This handoff and `docs/features.md` for current behavior.
4. `docs/deploy.md`, `docs/runbooks.md`, and the security documents for
   procedures.
5. Dated files under `docs/changes/` and the PRDs as historical design context.

Do not use the old phase language in PRDs/change logs as evidence that a
feature is currently absent; verify the route and current checklist first.
