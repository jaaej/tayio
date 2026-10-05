# Taiyo Tuition Portal

Production-beta portal for Taiyo Tuition in Mount Waverley, Victoria. Students,
parents, tutors, reception staff, and the owner each receive a role-scoped
workspace for classes, learning, communication, scheduling, and operations.

**Live portal:** [portal.taiyotuition.com](https://portal.taiyotuition.com)

**Documentation last reconciled with the codebase:** 6 October 2026

## Current status

- The custom domain is connected to Vercel and the Production deployment was
  verified `Ready` on 6 October 2026.
- The four role portals are implemented. The remaining release work is mainly
  the manual acceptance list in [`checklist_beta_fix.md`](checklist_beta_fix.md),
  not placeholder dashboard development.
- Resend DKIM/SPF/MX records and the Vercel email environment-variable names
  are present. Supabase custom SMTP and real-inbox end-to-end delivery still
  need to be verified before email can be called complete.
- Do not add real client data to a personal/test Supabase project. Production
  and development must remain separate.

## Stack

- Next.js 15 App Router and React 19
- TypeScript and Tailwind CSS 4
- Supabase Auth and private Supabase Storage
- Postgres with Drizzle ORM and raw SQL migrations
- Vercel hosting in the Sydney region
- Resend transport for urgent announcement email when configured

Package versions are authoritative in [`package.json`](package.json).

## Major workflows

- **Students:** timetable and make-up moves, curriculum with staged week/term
  access, homework, progress, resources, discussions/messages, notifications,
  payments, Taiyo Blitz, and profile/security settings.
- **Parents:** linked-child dashboards, classes/reschedules, homework,
  progress, tutor feedback, resources, messages, notifications, and payments.
- **Tutors:** today/schedule views, availability and leave, cover board,
  attendance and notes, homework/marking, curriculum additions, resources,
  class announcements requiring admin approval, and weekly payroll check-ins.
- **Admins:** user/family/account management, class/enrolment operations,
  attendance, reschedules and tutor cover, curriculum/terms/quizzes,
  announcements, payments/revenue, reports, resources, notifications, global
  search, and owner-only payroll controls.

See [`docs/features.md`](docs/features.md) for the role-by-role reference and
[`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md) for the current engineering
handoff.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with **development/test** Supabase values. Never copy
production database credentials into the local file used to run the dev
server. Open [http://localhost:3000](http://localhost:3000).

Required and optional variable names are documented in
[`/.env.example`](.env.example). Never commit their real values.

## Validation

Run these before committing application changes:

```bash
npm run typecheck
npm test
npm run build
```

Database/security checks use the database selected by `DIRECT_URL` and should
only be run after confirming which environment the file points to:

```bash
npm run db:status
npm run db:check-rls
```

## Database safety

- The schema definition is in `src/db/schema.ts`; ordered changes live in
  `supabase/migrations/`.
- Never run `drizzle-kit push` against an existing database. The guarded
  `npm run db:push` script intentionally refuses that workflow because a push
  can remove raw-SQL RLS policies and views.
- `npm run db:bootstrap -- --confirm` is for a brand-new, empty project only.
- Apply later schema changes as reviewed SQL migrations, then run
  `npm run db:status` and `npm run db:check-rls`.
- Production contains personal information about minors and payroll data.
  Never seed it with demo scripts or reuse it for another client.

## Documentation map

- [`docs/README.md`](docs/README.md) - authoritative documentation index,
  status labels, conflict order, and audit scope.
- [`checklist_beta_fix.md`](checklist_beta_fix.md) — current implementation and
  manual QA backlog.
- [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md) — current state, safe resume
  workflow, and known open work.
- [`docs/features.md`](docs/features.md) — implemented features by role.
- [`docs/deploy.md`](docs/deploy.md) — deployment, migration, and production
  verification runbook.
- [`docs/runbooks.md`](docs/runbooks.md) — operational and incident procedures.
- [`docs/SECURITY.md`](docs/SECURITY.md) and
  [`docs/security-checklist.md`](docs/security-checklist.md) — security model and
  remaining security checks.
- [`docs/checklist.md`](docs/checklist.md) — legacy/full implementation inventory;
  current acceptance work is tracked in `checklist_beta_fix.md`.
- `docs/changes/` — dated implementation history, not the current backlog.

## Deployment

`main` is connected to the Vercel project `tayio`. A push to `main` normally
starts a Production deployment, but a GitHub push alone is not proof that the
site is live. Confirm the deployment is `Ready` and the custom-domain alias is
attached:

```bash
npx vercel@latest inspect https://portal.taiyotuition.com
```

Then run the relevant role-specific checks from `checklist_beta_fix.md` on the
live domain.
