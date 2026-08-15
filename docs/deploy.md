# Deployment runbook

Staged rollout: **Phase 1** is an admin + tutor beta, **Phase 2** opens the portal to students and parents.
Phase 1 exists to get real operational data in (attendance, lesson notes, curriculum, invoices) with a small, trusted, staff-only user set.

The launch gate itself lives in `docs/security-checklist.md` §K5.
This file is the ordered "how", and it records which of those items each phase actually needs.
Incident procedures are in `docs/runbooks.md`.

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
