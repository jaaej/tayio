# Backend Security Checklist

Every backend security item for the tayio portal, grouped by area and tagged by priority.

**Legend**
- ✓ done
- ⚠ partial / has documented caveat
- ☐ not done
- — out of scope (frontend, infra, not backend)

**Priority**
- **P0** — must have before any real (non-seed) user touches the system
- **P1** — should have within first month of real users
- **P2** — future / nice-to-have

Full RLS detail lives in `docs/SECURITY.md`. This file is the broader checklist.

---

## A. Database / Row-Level Security

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| A1 | RLS enabled on every public table | ✓ | P0 | Migration 0004 + 0005 |
| A2 | Helper functions SECURITY DEFINER with pinned `search_path` | ✓ | P0 | See SECURITY.md §0004 |
| A3 | `lesson_notes_safe` view hides `internal_note` from students/parents | ✓ | P0 | Migration 0003 |
| A4 | Profile sync trigger on `auth.users` insert | ✓ | P0 | Migration 0001 |
| A5 | Storage policies for homework attachments | ☐ | P1 | Bucket not created yet; ~15 min once it is |
| A6 | Storage policies for resource library (admin/tutor uploads) | ✓ | P1 | No client-side `storage.objects` policies needed — same model as the `curriculum` bucket: all access is authorized at the app layer (`requireRole` + subject-scope check in `src/lib/resources.ts`) *before* a service-role client signs the URL (`uploadResourceFile`/`signResourceAttachment`, `src/lib/resources-storage.ts`). See E8 for bucket existence. |
| A7 | Storage policies for profile photos | ☐ | P2 | Feature not built |
| A8 | Column-level UPDATE restriction on `profiles.role` | ✓ | P1 | **Closed 2026-07-02, migration 0013.** BEFORE UPDATE trigger silently reverts `profiles.role` unless caller is admin or a trusted server context (postgres/service_role). Verified via JWT impersonation: self-promote blocked, non-role updates unaffected, admin + server bypass work |
| A9 | Column-level UPDATE restriction on `homework_assignments.{score,feedback,marked_at,marked_by}` | ✓ | P0 | Migration 0007 — BEFORE UPDATE trigger silently reverts these columns unless caller is admin or homework's authoring tutor. Verified 2026-05-27 |
| A10 | New-table RLS discipline (every `pgTable` addition gets a migration entry) | ☐ | P0 | Process, not code — keep `SECURITY.md` updated |
| A11 | Periodic re-run of Supabase Advisor | ☐ | P1 | Catches RLS-disabled-in-public regressions |
| A12 | RLS enabled on `resources` table | ✓ | P0 | Migration 0024. Subject-scoped: students/parents see only enrolled subjects; tutors see taught subjects (incl. unpublished); admins all. Audit trigger on insert/update/delete via `handle_audit_log()`. `resource-library` storage bucket + policies tracked at E8 (Task 3). |
| A13 | RLS enabled on quizzes tables | 🔶 | P0 | Migration 0025. `quizzes`, `quiz_questions`, `quiz_options` tables. Admin-full access via `public.is_admin()`; tutor-scoped via `assigned_tutor_id = auth.uid()`, questions/options scoped via parent quiz; no student policy (students default-denied). App-layer role guards in `src/app/_actions/quizzes.ts` are the primary control. **Pending runtime verification.** |

## B. Authentication (Supabase Auth)

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| B1 | Role lives in `app_metadata` (server-only), not `user_metadata` | ✓ | P0 | Migration 0002 |
| B2 | Auth code reads `app_metadata.role` **only** | ✓ | P0 | **Hardened 2026-07-02 (OWASP A07).** Removed the `?? user_metadata?.role` fallback everywhere (`lib/auth.ts`, `middleware.ts` ×2, `login/actions.ts`, homework-submit API route). `user_metadata` is user-mutable via `supabase.auth.updateUser()`, so trusting it (even as fallback) was a latent privilege-escalation path. Verified all 23 users have `app_metadata.role` (0 would break). Dead `signup/form.tsx` (client `signUp` writing role to `user_metadata`) deleted |
| B3 | Rate limiting on `/login` (brute-force protection) | ✓ | P0 | **Implemented + verified 2026-07-02.** Login moved from client-side `signInWithPassword` to a server action (`src/app/(auth)/login/actions.ts`) wrapped in a Postgres-backed rate limiter (migration 0014, `check_rate_limit`): 20/5min per IP + 5/15min per email. Limiter function verified (fixed-window + reset PASS); login flow (server-side sign-in + cookie + redirect) verified in dev browser. Free-tier; no Pro Auth Hooks needed. Deploy note: per-IP limit assumes a trusted proxy (Vercel) — see `rate-limit.ts` trust boundary; per-email limit is IP-independent |
| B4 | Account lockout after N failed attempts | ⚠ | P1 | Partially addressed by B3's per-email limit (5 fails / 15 min throttles that account). Not a persistent lockout; revisit if needed |
| B5 | Password complexity requirements | ⚠ | P1 | Code-side minimums aligned 2026-07-02: admin-created passwords `min(8)` (was 6), reset flow already `min(8)`. Full complexity policy (length/charset/breach-check) is a Supabase dashboard setting — Auth → Policies (still to configure) |
| B6 | Email verification loop enforced on signup | ☐ | P0 | Currently seed scripts pass `email_confirm: true`; real signup flow must require verification |
| B7 | Password reset flow tested end-to-end | ⚠ | P0 | Pages built 2026-05-27: `/forgot-password` (email entry) and `/reset-password` (new password form). Wired via existing `/auth/callback` exchange. **Dev test still pending: click through end-to-end with a seed account on built-in SMTP.** For production SMTP setup see K6 |
| B8 | JWT access token TTL reviewed (Supabase default: 1hr) | ☐ | P1 | OK at default; document choice |
| B9 | Refresh token rotation enabled | ☐ | P1 | Supabase setting; check + document |
| B10 | MFA / 2FA for admin accounts | ☐ | P2 | Supabase supports TOTP |
| B11 | Sign-up disabled (invite-only — admins create accounts) | ✓ | P0 | Decision: invite-only. Frontend done 2026-05-27 (signup page replaced with "contact admin"; login no longer links to /signup). Supabase dashboard signup toggle flipped off 2026-05-27 (Authentication → Sign In / Providers → Email) |

## C. API / Server Actions

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| C1 | CSRF protection (Next.js Server Actions origin check) | ✓ | P0 | Verified 2026-05-27 — no custom server-action config in `next.config.ts` disables the default origin check. Next 16 Server Actions enforce same-origin by default |
| C2 | Zod validation on every server action input | ✓ | P0 | **Closed 2026-07-02.** Full audit of every `"use server"` action. All free-text inputs now length-capped: Zod-schema actions got `.max(N)` (announcements body 10k, users name/phone/school/email/password, classes name/location/onlineLink/description, curriculum description/urls, invoices description, family relationship); manual-FormData actions (tutor saveAttendance/saveLessonNote/createHomework/markSubmission, admin adminSaveAttendance, parent + admin reschedule reason) use `src/lib/validation.ts` `optionalText`/`requiredText` or an inline length guard. Type/format validation was already present; this closes the storage-abuse gap |
| C3 | XSS protection on user-generated content (lesson notes, feedback) | ✓ | P0 | Audited 2026-05-27 — no raw HTML rendering of user input found in any portal page. React's default escape covers everything |
| C4 | Rate limiting on write endpoints (homework submit, feedback post) | ✓ | P1 | **2026-07-02.** `src/lib/rate-limit.ts` (`rateLimit`, fails open) over migration 0014. Applied to the abuse-prone public writes: DM send (30/min/user), discussion thread (10/min), discussion reply (30/min) — all keyed by user id, generous enough to never hit normal use. Reusable helper for any other action |
| C5 | Service role key NEVER returned in any API response | ✓ | P0 | Audited 2026-05-27 — `createAdminClient()` is only ever instantiated server-side (in `_actions/*` and `_lib/*` files), never returned to the client. Service key is in `.env.local` only, server-read only |
| C6 | Service role used only when RLS-bypass is genuinely required | ✓ | P0 | **Re-audited 2026-07-02 (OWASP A01 + server-action review).** `createAdminClient()` (true service-role) used only in `actions-users.ts` for auth.users CRUD (genuinely required); `server-only`-guarded. Drizzle `db` (postgres role, bypasses RLS) is the deliberate architecture — **app-layer `requireRole` + ownership checks are the primary control and were verified present on every server action** (K3 review: no broken-access-control findings). RLS is defense-in-depth. Optional future (Option B): run reads under user JWT so RLS also enforces — significant refactor, not required given verified app-layer gating |
| C7 | No dynamic code-evaluation primitives or string-concatenated SQL | ✓ | P0 | Audited 2026-05-27 — no `eval`, `new Function`, or string-concat SQL anywhere. Drizzle parameterises every query. `scripts/apply-sql.mjs` uses `sql.unsafe()` but only on trusted migration files |

## D. Secrets / Configuration

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| D1 | `.env.local` in `.gitignore` | ✓ | P0 | `.gitignore` has `.env*`; no `.env` files tracked. Verified 2026-05-27 |
| D2 | No secrets in git history | ✓ | P0 | Verified 2026-05-27 — scanned for service role JWTs, `SUPABASE_SERVICE_ROLE_KEY=`, private key blocks. Zero hits |
| D3 | Vercel production env vars set separately from dev | ☐ | P0 | When deploying |
| D4 | Anon key vs service role key — usage audited | ✓ | P0 | **Audited 2026-07-02 (J4/J5 + OWASP).** Anon key: client SDK + server SSR clients only. Service-role key: only in `supabase-admin.ts`, `server-only`-guarded, never in a `"use client"` file (verified 0 client `process.env` refs). No secret reaches the browser bundle |
| D5 | Supabase JWT secret rotated from any default / pre-shared value | ☐ | P1 | Supabase dashboard |
| D6 | Service role key rotation procedure documented | ☐ | P1 | When you'd rotate, how to rotate, what breaks |

## E. File Uploads / Storage

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| E1 | Server-side file type validation (MIME + magic bytes, not just extension) | ✓ | P0 | **Closed 2026-07-02.** `src/lib/upload-validation.ts` sniffs leading bytes (pdf/png/jpeg/gif/webp/zip-OOXML/ole-Office/mp4/webm; text validated as UTF-8) and requires the *declared* MIME to be in a per-context allowlist AND the content family to match. All three upload paths (`createHomework`, `uploadTutorAttachment`, `uploadCurriculumFile`) route through it. Residual (accepted): OOXML/OLE subtypes not distinguished — verifies container family only. `image/svg+xml` deliberately excluded (XSS vector). Logic verified with 24 unit cases incl. html/exe-spoofed-as-pdf → rejected |
| E2 | Server-side file size limits | ✓ | P0 | **Closed 2026-07-02.** `validateUpload` enforces per-policy `maxBytes` (25 MB attachments/booklets, 500 MB video) + rejects empty files, before any upload |
| E3 | Filename sanitisation (path traversal, special chars) | ✓ | P0 | **Closed 2026-07-02.** Extension + content-type are now **canonical**, derived from the validated allowlist entry — never from the client filename. A client cannot force a `.html`/`.exe`/`.svg` extension or a `text/html` content-type. Path components remain server-generated (`tutor.id`/`sectionId` + `randomUUID`) |
| E4 | Public vs private bucket separation | ⚠ | P0 | **Code half done 2026-07-02.** `createHomework` now stores the storage **path** (not a persisted public URL); reads go through `signHomeworkAttachment` (student + tutor homework pages). No legacy rows to migrate (0 rows had attachment_url). **Remaining (needs you):** (1) flip the `homework-attachments` bucket to **private** in the Supabase dashboard; (2) ensure signing works on the private bucket — either add a storage.objects SELECT policy for that bucket (A5) or switch signing to a service-role client (app already authorizes who loads the homework, then signs); (3) live-test download as student + tutor. Curriculum (video/booklet) + submissions already use signed URLs |
| E5 | Signed URL expiry for private downloads | ✓ | P0 | Signed URLs are short-lived (1 hr): curriculum `SIGNED_URL_TTL_SECONDS = 3600`, homework attachments + submissions `3600`. No long-lived/persisted URLs stored after E4 code change |
| E6 | Virus / malware scanning on uploads | ☐ | P2 | Real concern once external parents upload; defer |
| E7 | `discussion-attachments` private bucket exists | ⚠ | P1 | **Created in dev Supabase 2026-07-22.** Was missing → discussion/DM file uploads failed at runtime (`"Bucket not found"`, 500). Private; access gated at app layer (`requireRole` + `canSeeBoard`), upload + signing via service-role (`src/lib/discussions-storage.ts`). **Prod: must be created at deploy** — same manual step as the homework-attachments bucket (E4). |
| E8 | `resource-library` private bucket exists + storage policies | ⚠ | P1 | **Created in dev Supabase 2026-07-23.** Private bucket; paths `${subjectId}/${randomUUID}.${ext}`. Signing via service-role only, after re-authorizing "can caller see this resource?" (`storage_bucket` + `storage_path` columns). Promoted resources reference the existing `curriculum` bucket path — no second upload. **Prod: must be created at deploy** — same manual step as `homework-attachments` (E4) and `discussion-attachments` (E7). |

## F. Network / Headers

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| F1 | HTTPS only in production | ⚠ | P0 | Code clean (only `http://` in code is the SVG namespace ID); auth callback uses `url.origin`. Verify Vercel "HTTPS redirect" toggle at deploy time |
| F2 | HSTS header | ✓ | P1 | **2026-07-02** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in `next.config.ts`. Ignored by browsers over http (dev), enforced over https (prod) |
| F3 | Content-Security-Policy header | ⚠ | P1 | **CSP present in `next.config.ts`; script-src is `'unsafe-inline'`. Nonce upgrade attempted 2026-07-02 and REVERTED — see below.** All directives locked except script/style: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, scoped img/media/connect (Supabase https+wss), env-derived, prod adds `upgrade-insecure-requests`. `style-src 'unsafe-inline'` required by inline `style={{}}`. **Verified in a prod build (`next build && next start`): `/login` serves with all 18 scripts loadable, no breakage.** <br>**Why not nonce-based:** a per-request nonce needs dynamic rendering, but public pages like `/login` are **statically prerendered** (`x-nextjs-prerender: 1`) — their HTML is baked at build with no nonce, so a nonce'd `script-src` blocks every script (verified: 0/18 scripts nonced → page dead). Making it work would require forcing the whole app to dynamic rendering (loses static optimization) for marginal gain over existing XSS defenses (C3: React auto-escaping, no `dangerouslySetInnerHTML`; object-src/base-uri/frame-ancestors already locked). Not worth it. Revisit only if a strong script-XSS control is specifically required |
| F4 | X-Frame-Options / frame-ancestors (clickjacking) | ✓ | P1 | **2026-07-02** — `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` in `next.config.ts` |
| F5 | X-Content-Type-Options: nosniff | ✓ | P1 | **2026-07-02** — set in `next.config.ts` headers |
| F6 | Referrer-Policy: strict-origin-when-cross-origin (or stricter) | ✓ | P1 | **2026-07-02** — set in `next.config.ts` headers; also `Permissions-Policy` disables camera/mic/geo/topics |
| F7 | Supabase CORS allowed origins set to production domain only | ☐ | P0 | Deferred until production deploy. Supabase dashboard → Project Settings → API → Site URL = `https://<your-domain>` |
| F8 | Auth redirect URLs whitelisted in Supabase | ☐ | P0 | Deferred until production deploy. Supabase dashboard → Authentication → URL Configuration → Redirect URLs: add `http://localhost:3000/auth/callback` (dev) and `https://<your-domain>/auth/callback` (prod). Callback path verified at `src/app/auth/callback/route.ts` |

## G. Logging / Monitoring / Audit

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| G1 | Audit logs for admin actions | ✓ | P0 | Migration 0006 (triggers on `profiles`, `family_links`, `classes`, `enrollments`, `invoices`, `announcements`). **Actor capture closed 2026-07-02:** `src/lib/with-actor.ts` `withActor()` sets `request.jwt.claims` transaction-locally so the SECURITY DEFINER trigger records the acting admin. Applied to every audited admin mutation (announcements, classes, enrollments, invoices, profiles updates, family links). Verified: with `withActor` → `actor_id` + `actor_role` populated; control without → NULL. Note: `createUser`'s profile row is inserted by the `handle_new_auth_user` trigger (auth context), so that one INSERT still logs NULL actor — the subsequent `updateUser`/role changes are attributed |
| G2 | Failed login attempt logging | ☐ | P1 | Supabase logs this; surface it |
| G3 | Sensitive-action logging (data export, account changes, role changes) | ✓ | P0 | Covered by G1 — every INSERT/UPDATE/DELETE on the six watched tables is logged with old + new JSONB and now an attributed actor (via `withActor`). **Admin-DM-read logging (safeguarding) deferred — no in-app path yet:** `getThreadForMe` scopes the admin messages UI to threads the admin participates in; RLS (0012) permits admin read of all DMs but nothing surfaces non-participant conversations. When a safeguarding-oversight view is built, instrument it with an audit READ row + report/reason gate |
| G4 | Error monitoring (Sentry / similar) | ☐ | P1 | Catches unexpected failures including security ones |
| G5 | Alerting on RLS-denial spikes (possible enumeration attack) | ☐ | P2 | Future; requires log aggregation |
| G6 | Postgres query log retention policy | ☐ | P1 | Supabase default; document |
| G7 | Audit log retention + immutability | ☐ | P1 | Once G1 exists |

## H. Compliance / Legal — students are minors

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| H1 | Privacy policy published | ☐ | P0 | Required for any public service |
| H2 | Terms of service published | ☐ | P0 | Same |
| H3 | Parental consent flow on minor signup (COPPA / Australian Privacy Act equivalent) | ☐ | P0 | Legal advice needed for your jurisdiction |
| H4 | Data retention + deletion policy | ☐ | P1 | GDPR-style right-to-be-forgotten |
| H5 | Data export feature (parent requests child's data) | ☐ | P1 | GDPR right-to-portability |
| H6 | Subprocessor list (Supabase, Vercel, Stripe later, etc.) | ☐ | P1 | Document for parents/legal |
| H7 | DPA with Supabase + Vercel signed | ☐ | P1 | Available on their websites |
| H8 | Cookie consent banner (if EU users) | ☐ | P1 | If targeting any EU-resident user |

## I. Operational / Disaster Recovery

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| I1 | Supabase point-in-time recovery enabled | ☐ | P0 | Paid tier feature; verify on production |
| I2 | Backup restore actually tested at least once | ☐ | P1 | Untested backups are wishes |
| I3 | Incident response runbook | ✓ | P1 | **`docs/runbooks.md` §I3** — triage/contain/assess/eradicate/recover/notify, incl. minors breach-notification duties (Privacy Act NDB + Reportable Conduct) |
| I4 | Service role key compromise procedure | ✓ | P0 | **`docs/runbooks.md` §I4** — rotate in Supabase, update `.env.local`+Vercel+redeploy, assess exposure window via audit_logs, git-history note |
| I5 | Admin account compromise procedure | ✓ | P1 | **`docs/runbooks.md` §I5** — ban + revoke sessions, audit `actor_id` actions, reverse via `old_data`, check planted persistence |
| I6 | Migration rollback procedure | ✓ | P1 | **`docs/runbooks.md` §I6** — stop dev server, apply per-migration "Reversible by" via `apply-sql.mjs`, re-run `db:check-rls`; never `db:push`; PITR for data |
| I7 | Production Supabase project separate from dev | ☐ | P0 | If it isn't already — verify |

## J. Code / Dependency Security

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| J1 | `npm audit` clean | ⚠ | P1 | **Triaged 2026-07-02.** 6 moderate, all transitive/dev: `esbuild` via `@esbuild-kit` → `drizzle-kit` (devDependency, not shipped) and `postcss` bundled inside `next`. Both "fixes" are breaking downgrades (`npm audit fix --force` wants `next@9.3.3`) — rejected. Neither processes untrusted input at runtime. Revisit on Next / drizzle-kit upgrade; do NOT force-downgrade |
| J2 | Dependabot or Renovate enabled | ✓ | P1 | `.github/dependabot.yml` — weekly npm checks, PRs grouped by stack (Next, Supabase, Drizzle). Auto-activates on push to GitHub |
| J3 | No `sql.unsafe()` / Drizzle raw SQL without parameterisation | ✓ | P0 | **Re-audited 2026-07-02 (OWASP A03).** Only `scripts/apply-sql.mjs` uses `sql.unsafe` (trusted migration files). All app queries use the Drizzle builder or parameterised tagged `sql\`\`` templates (incl. `rate-limit.ts`, ranking queries). No string-concatenated SQL, no `sql.raw` in app code |
| J4 | `"server-only"` import on all server-side modules with secrets | ✓ | P0 | **Closed 2026-07-02.** Full audit. Added `import "server-only"` to the 7 unguarded plain modules — critically `src/db/client.ts` (DATABASE_URL) and `src/app/admin/_lib/supabase-admin.ts` (service-role key), plus `lib/notifications.ts`, `lib/curriculum.ts`, and the three per-subject `_queries.ts`. `"use server"` action files are inherently server-only; page/route files are server-only in the App Router |
| J5 | No `process.env.X` access in client components | ✓ | P0 | **Verified 2026-07-02.** Audited all 47 `"use client"` files — zero `process.env` references (public or otherwise). Only non-`NEXT_PUBLIC_*` env reads are in server modules (`db/client.ts`, `supabase-admin.ts`), now `server-only`-guarded (J4) |

## K. Pre-launch verification

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| K1 | OWASP Top 10 self-audit | ✓ | P0 | **Done 2026-07-02.** Full A01–A10 pass. No injection/XSS/SSRF/deserialization issues. Findings fixed: A07 user_metadata role fallback (B2), A01 open redirect in `auth/callback` + login (guarded), A09 audit actor capture (G1/G3 via `withActor`), A02 admin password min 6→8, A04 dead signup footgun removed. Residual (accepted/documented): A05 `script-src 'unsafe-inline'` (F3 — nonce not viable on static pages), login/createUser return raw Supabase error text (minor) |
| K2 | Penetration test (or HackerOne-style bounty) | ☐ | P2 | Probably overkill for MVP, essential later |
| K3 | Security review of all server actions before launch | ✓ | P0 | **Done 2026-07-02.** Audited every `"use server"` action + the one API route for broken access control. Result: no CRITICAL/IDOR — every ID-taking action has an ownership/scope check (`assertOwns*`, `assertTeaches*`, `canSeeBoard`, `canDM`, thread-participant, `studentId = user.id`), every admin action gates `requireAdmin`. One finding fixed (homework-submit route read `user_metadata.role` first → now `app_metadata` only) |
| K4 | Supabase project settings reviewed (URL allowlist, redirect URLs, JWT secret) | ☐ | P0 | One-time before launch |
| K5 | All P0 items in this checklist resolved | ☐ | P0 | Gate for launch. **All code-side P0s now resolved.** Remaining P0s are deploy/dashboard/legal only: E4 bucket flip, B6 email verification, D3/F1/F7/F8/I1/I7/K4/K6 deploy config, H1–H3 legal (privacy/ToS/parental consent) |
| K6 | Configure production SMTP provider | ☐ | P0 | **Pre-launch must.** Supabase's built-in email service is limited to 4 emails/hour and sends from `noreply@mail.app.supabase.io` (lands in spam, not branded). Required for: password reset (B7), email change, magic links if ever used. Set in Supabase dashboard → Project Settings → Auth → SMTP Settings. Recommended providers: Resend, AWS SES, SendGrid |

---

## Recommended order

If you want a sequence rather than a category-by-category walk:

1. **D1, D2** (5 min): Confirm `.env.local` is gitignored and no keys in git history. Trivial, blocking.
2. **G1, G3** (1-2 days): Audit logs for admin actions. PRD requirement. Biggest gap.
3. **B3, B4** (half day): Rate limiting on `/login`. Brute-force protection.
4. **B6, B7** (half day): Email verification + password reset tested.
5. **C1, C2, C5** (1-2 days): Server action hardening — Zod everywhere, CSRF verified, service-role key audited.
6. **F1, F7, F8** (1 hour): Verify HTTPS, CORS, redirect allowlist in Supabase.
7. **H1, H2** (legal): Privacy policy + ToS published before any real signup.
8. **A5, E1-E5** (when uploads ship): Storage + upload validation.
9. **A9** (1 hour, but P0): Lock `homework_assignments` column-level UPDATE — pairs with student portal API audit.
10. Everything else in priority order.
