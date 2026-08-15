# Deployment runbook

Staged rollout: **Phase 1** is an admin + tutor beta, **Phase 2** opens the portal to students and parents.
Phase 1 exists to get real operational data in (attendance, lesson notes, curriculum, invoices) with a small, trusted, staff-only user set.

The launch gate itself lives in `docs/security-checklist.md` §K5.
This file is the ordered "how", and it records which of those items each phase actually needs.
Incident procedures are in `docs/runbooks.md`.

**Hosting decision (2026-08-15): the owner hosts on their own Supabase and Vercel accounts**, and the portal is operated for a separate tutoring company.
Two consequences worth keeping in view.

First, the owner is holding another organisation's data - including minors' personal data - on their behalf, which makes them a data processor rather than the controller.
That is a written-agreement question, not a code question, and it decides who carries the notification duties in `docs/runbooks.md` §I3.

Second, keep the deployment **transferable**, in case the client later wants to own it.
The codebase is single-tenant (no `org_id` anywhere in `src/db/schema.ts`), so one Supabase project serves exactly one company - which is fortunate here, because it means the whole project can be handed over wholesale.
Never put a second client's data in this project, and never point a second deployment at this database.
A custom domain works either way: the client can keep their own DNS and point a CNAME at Vercel without owning the hosting.

---

## Setup sequence - the evening before deploy

Front-loads everything that has lead time or can fail, so deploy day is only clicks.
Roughly 90 minutes of work, most of it spent waiting on DNS.
The detailed reasoning for each item is in the phase sections further down; this is the running order.

### 1. Start the slow chain first

It is the only part that cannot be compressed on the day.

1. Register the domain, or pick the subdomain. If it is the client's domain they only need to add a CNAME later, so you are not blocked on them.
2. Sign up at Resend, add the domain, put its SPF/DKIM records into DNS. Do this **before** anything else - verification is the long pole and everything below runs while it propagates.

### 2. Create the production Supabase project

3. New project, region close to the users. Save the database password; it is shown once.
4. Upgrade to **Pro** ($25/mo). Free tier pauses after a week of inactivity and has no backups.
5. Settings → API: copy the Project URL, the anon key, and the service_role key.
6. Connect → Connection string: copy both pooler URLs. Transaction pooler (port 6543) is `DATABASE_URL`; session pooler (port 5432) is `DIRECT_URL`.

### 3. Bootstrap the schema

This is the step most likely to surprise you and the reason to do all of this the night before rather than in the morning.

Back up the dev environment first, because the next command points your machine at production:

```bash
cp .env.local .env.local.dev
```

Fill `.env.local` with the production values (`.env.example` lists every key), then:

```bash
npm run db:bootstrap -- --confirm
npm run db:status      # expect 37 of 37, and nothing under "recorded but not in this checkout"
npm run db:check-rls   # expect every table green
```

Restore dev the moment it passes:

```bash
cp .env.local.dev .env.local
```

**Never run `npm run dev` while `.env.local` holds production values.**

### 4. Finish the Supabase dashboard while you are in there

7. Storage: create five **private** buckets - `homework-attachments`, `homework-submissions`, `curriculum`, `discussion-attachments`, `resource-library`.
8. Authentication → Sign In / Providers → Email: **turn sign-up off**. This is per-project; the dev setting does not carry over.
9. Authentication → Users → Add user (your email, auto-confirm on), then set that user's `app_metadata` to `{"role": "admin"}`.
   The app reads `app_metadata` only - a role in `user_metadata` is deliberately ignored and will silently not work.
10. Database → Backups: confirm daily backups are on.

### 5. Vercel

11. Upgrade to **Pro** ($20/mo). Hobby is non-commercial and this is a commercial deployment.
12. Import the repo, and **set the Production environment variables before letting it build.**
    `next.config.ts` reads `NEXT_PUBLIC_SUPABASE_URL` at build time to construct the CSP, so a build without it bakes a policy that blocks every Supabase request. The site then loads and nothing works.

Generate a value for `ADMIN_PIN_SECRET` while pasting the rest, so admin PIN sessions survive a future service-role key rotation:

```bash
openssl rand -hex 32
```

### 6. Once Resend verifies

13. Supabase → Project Settings → Auth → SMTP: point at Resend, sender on the verified domain.
14. Project Settings → API → Site URL: the production URL.
15. Authentication → URL Configuration → Redirect URLs: add `https://<domain>/auth/callback`.

Steps 14 and 15 are the only ones that truly need the final domain, so they can slide to deploy morning.

### 7. Last thing before bed

```bash
git log --oneline -1   # confirm this is the commit you are deploying
npm run build          # green on that exact commit
npm run dev            # then click through /admin and /tutor
```

Do not skip the click-through.
Several recent surfaces - the notifications inbox, the discussions recent-activity feed, the shared hero on all four messages pages - have never been opened in a browser.

### Deploy morning

Deploy, then: `db:check-rls` against prod, log in as admin, create a tutor, confirm that tutor cannot open a student they do not teach, upload one file, run a real password reset.

---

## 0. The thing that is easy to get wrong

`supabase/migrations/*.sql` **cannot build a database from nothing.**
None of those files create the core tables (`profiles`, `classes`, `enrollments`, `lessons`, ...) - they only ALTER, add RLS, and create later tables.
The base schema exists only in `src/db/schema.ts`, and it only ever reached the dev database via `drizzle-kit push`.

So a fresh database needs three steps in this order: push the schema, apply every migration, verify RLS.
That order is safe **only** on an empty database - `drizzle-kit push` drops every RLS policy and the `lesson_notes_safe` view, because those live in raw SQL rather than `schema.ts`.
This is why `npm run db:push` is blocked outright (`scripts/db-push-guard.mjs`).

`npm run db:bootstrap -- --confirm` does all three steps and refuses to run if the target's `public` schema has any tables, so it cannot be turned against a live database by mistake.
After the bootstrap, schema changes go back to the normal rule: raw-SQL ALTER migration + `scripts/apply-migration.mjs`, never push.

### Known drift: dev has tables that main does not create

The dev database contains `term_test_attempts` and `term_test_answers`, but `main` has no term-test schema and no `0028`/`0029` - those migrations live on the unmerged `feat/term-test` branch and were applied to dev by hand.

Production will therefore **not** have those tables, which is correct (the feature is not on `main`), but it means dev is not a faithful preview of what `db:bootstrap` produces.
Do not read "it works in dev" as proof that a table exists in prod.

**This is now tracked rather than guessed at.** `public.schema_migrations` records every migration applied to a database; `apply-migration.mjs` writes to it and skips anything already recorded, and `db:bootstrap` stamps the whole set as it goes.

```
npm run db:status     # applied vs pending, for whichever database DIRECT_URL points at
```

The dev database was back-stamped on 2026-08-15 after verifying each migration's artifacts actually existed.
It reports `37 of 37` plus three "recorded but not in this checkout": `0028`/`0029` from the unmerged `feat/term-test` branch, and `0030` from the archived `free-trials` branch, whose dead `enrollments.trial_starts_at`/`trial_ends_at` columns exist in dev and will never exist in prod.
That section of the output is the drift signal - anything listed there was applied from a branch, and a fresh production database will not have it.

The ledger is created idempotently by `scripts/migration-ledger.mjs` rather than by a numbered migration, because it has to exist before the first migration can be recorded.
It is deliberately absent from `src/db/schema.ts` - it is tooling, not application schema - which also means a stray `drizzle-kit push` would drop it. That would already be a catastrophe for RLS, so it is not a new risk.

---

## Phase 1 - admin + tutor beta

### 1. Ship-ready code

- Merge the feature branch to `main`; confirm `npm run build`, `npx vitest run`, and `npm run typecheck` are green on the exact commit you will deploy.
- Click through the admin and tutor portals locally against seed data.
  Recent UI work has repeatedly shipped without browser verification - see the 🔶 FE rows in `docs/checklist.md`.

### 2. New Supabase project (production, separate from dev - checklist I7)

1. Create the project. Note the region; keep it close to your users.
2. Point `DIRECT_URL` and `DATABASE_URL` in `.env.local` at the **new** project.
   `DIRECT_URL` must be the session pooler (port 5432) - DDL needs it.
3. `npm run db:bootstrap -- --confirm`
   This runs `drizzle-kit push` → all migrations in order → `check-rls`, and stops on the first failure.
   Then `npm run db:status` should report every on-disk migration applied and nothing in the "recorded but not in this checkout" section.
4. Create five **private** storage buckets:
   `homework-attachments`, `homework-submissions`, `curriculum`, `discussion-attachments`, `resource-library`.
   Missing buckets do not fail at build - they fail at runtime with `Bucket not found` and a 500 (this already happened once in dev; checklist E7/E8).
   `homework-attachments` must be private specifically, not just created (checklist E4).
5. Authentication → Sign In / Providers → Email: **turn sign-up off.** The portal is invite-only; admins create accounts (checklist B11). This is a per-project setting, so flipping it in dev did not flip it here.
6. Authentication → URL Configuration → Redirect URLs: add `https://<your-domain>/auth/callback` (checklist F8).
   The callback route is `src/app/auth/callback/route.ts`.
7. Project Settings → API → Site URL: your production domain only (checklist F7).
8. Project Settings → Auth → SMTP: wire a real provider (Resend / SES / SendGrid) (checklist K6).
   **Not optional even for a staff-only beta.** `updateUser` in `src/app/admin/_lib/actions-users.ts` cannot set a password - only `createUser` does, at creation time. The single in-product recovery path is `sendPasswordReset`, which sends email. Supabase's built-in sender is capped at 4 emails/hour from a spam-flagged address, so without SMTP a locked-out tutor needs manual dashboard intervention.
9. Enable point-in-time recovery (checklist I1, paid tier).
   Phase 1 is a weeks-long data-entry period; the realistic disaster is losing typed lesson notes, not a breach.

### 3. Bootstrap the first admin

Sign-up is off and `profiles.role` is trigger-locked (migration 0013), so do this by hand:

1. Supabase dashboard → Authentication → Users → Add user, with `email_confirm` on.
2. Set `app_metadata.role = 'admin'` on that user.
   The app reads `app_metadata` **only** - `user_metadata.role` is deliberately ignored, because users can write it themselves (checklist B2).
3. The `handle_new_auth_user` trigger (migration 0001) creates the matching `profiles` row.
4. Log in, then create the tutor accounts from `/admin/users`.

**Do not run `scripts/seed-demo.mjs` or `scripts/seed-users.mjs` against production.**
They create Tom Tutor and friends; demo rows tangled with real ones are painful to unpick later.

### 4. Vercel

1. Set Production environment variables separately from Preview (checklist D3), all pointing at the new project:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (transaction pooler), `DIRECT_URL` (session pooler).
2. Confirm the HTTPS redirect is on (checklist F1).
   Security headers (HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy) already ship from `next.config.ts`.
3. Deploy.

### 5. Verify on production

- `npm run db:check-rls` against the production URL - all tables green.
- Log in as admin; create a tutor; log in as that tutor.
- **From the tutor account, try to open a student who is not theirs.** Admin is all-powerful by design, so tutor scoping is the only real access-control boundary this phase exercises.
- Upload one file per bucket path in use (curriculum, homework attachment, discussion attachment, resource) - this is what catches a missing bucket.
- Run the password reset end-to-end on real SMTP. It has never been tested (checklist B7).

### What Phase 1 defers, and why it is defensible

- **H3, parental consent on minor signup** - no minor holds an account yet.
- **B6, email verification on signup** - staff accounts are admin-created, invite-only.
- **Student- and parent-facing browser QA**, including the private-bucket download path students use (checklist E4 step 3).

**H1/H2 shrink rather than vanish.** You are still processing minors' personal data, so tutors need written handling rules now; the public privacy policy and terms have to be live before any parent logs in.

---

## Phase 2 - opening to students and parents

Everything deferred above comes due, plus:

1. Publish privacy policy and terms (H1, H2); resolve parental consent for your jurisdiction (H3) - this needs legal advice, not a code change.
2. Enforce email verification (B6).
3. Full browser QA of the student and parent portals, including the signed-URL download path on the private `homework-attachments` bucket.
4. Re-read the lesson-note split with real Phase 1 data before parents can see it.
   `parentVisibleComment` and `internalNote` are separate columns (`src/db/schema.ts:239-240`), so there is no visibility flag to get wrong, but it is worth confirming that what surfaces through the `lesson_notes_safe` view (migration 0003) is what tutors expected when they typed it.
5. Re-run `npm run db:check-rls` and the Supabase Advisor (checklist A11).

---

## Rollback

Code: redeploy the previous Vercel deployment.
Schema: `docs/runbooks.md` §I6 - per-migration "Reversible by" statements applied with `scripts/apply-sql.mjs`, then re-run `db:check-rls`. Never `db:push`.
Data: Supabase PITR (Dashboard → Database → Backups).
