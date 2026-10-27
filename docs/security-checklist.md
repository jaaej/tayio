# Backend Security Checklist

Every backend security item for the tayio portal, grouped by area and tagged by priority.

Last reconciled with code and the visible production configuration:
**6 October 2026**. Dashboard-only controls remain unchecked unless they were
directly verified; current product acceptance work is also tracked in
`checklist_beta_fix.md`.

**Legend**
- ✓ done
- ⚠ partial / has documented caveat
- ☐ not done
- - out of scope (frontend, infra, not backend)

**Priority**
- **P0** - must have before any real (non-seed) user touches the system
- **P1** - should have within first month of real users
- **P2** - future / nice-to-have

Full RLS detail lives in `docs/SECURITY.md`. This file is the broader checklist.

---

## A. Database / Row-Level Security

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| A1 | RLS enabled on every public table | ✓ | P0 | Migration 0004 + 0005 |
| A2 | Helper functions SECURITY DEFINER with pinned `search_path` | ✓ | P0 | See SECURITY.md §0004 |
| A3 | `lesson_notes_safe` view hides `internal_note` from students/parents | ✓ | P0 | Migration 0003 |
| A4 | Profile sync trigger on `auth.users` insert | ✓ | P0 | Migration 0001 |
| A5 | Storage policies for homework attachments | - | P1 | Broad client policies are intentionally unnecessary. The private bucket is uploaded/signed through the server-only service client only after application ownership checks; see `src/app/student/homework/_storage.ts`. Bucket privacy still needs dashboard evidence under E4. **Corrected 2026-10-28:** student submissions did not follow this. `/api/student/homework/[id]/submit` uploaded with the student's own session, which the bucket refuses ("new row violates row-level security policy"; neither dev nor Production has client storage policies), so every file hand-in failed, and the student's own submission and the tutor's link signed with the session and showed "File unavailable". Uploads now go through `storeSubmissionFile` (`src/lib/homework-submission.ts`) and links through `signHomeworkSubmission`, both on the service client after the ownership check. |
| A6 | Storage policies for resource library (admin/tutor uploads) | ✓ | P1 | No client-side `storage.objects` policies needed - same model as the `curriculum` bucket: all access is authorized at the app layer (`requireRole` + subject-scope check in `src/lib/resources.ts`) *before* a service-role client signs the URL (`uploadResourceFile`/`signResourceAttachment`, `src/lib/resources-storage.ts`). See E8 for bucket existence. |
| A7 | Storage policies for profile photos | ✓ | P2 | Migration 0058 creates a private `profile-photos` bucket with a 5 MB JPEG/PNG/WebP allowlist. Tutor-only server actions authorize direct uploads, validate magic bytes before saving the private object path, and sign reads through the service client. No broad authenticated-client object policy is required. Production bucket privacy still needs deployment verification. |
| A8 | Column-level UPDATE restriction on `profiles.role` | ✓ | P1 | **Closed 2026-07-02, migration 0013.** BEFORE UPDATE trigger silently reverts `profiles.role` unless caller is admin or a trusted server context (postgres/service_role). Verified via JWT impersonation: self-promote blocked, non-role updates unaffected, admin + server bypass work |
| A9 | Column-level UPDATE restriction on `homework_assignments.{score,feedback,marked_at,marked_by}` | ✓ | P0 | Migration 0007 - BEFORE UPDATE trigger silently reverts these columns unless caller is admin or the class's tutor (migration 0077; until 2026-10-20 the trigger called a helper no migration created, so on Production every API update of the table failed). Verified 2026-05-27, re-verified 2026-10-20 |
| A10 | New-table RLS discipline (every `pgTable` addition gets a migration entry) | ☐ | P0 | Process, not code - keep `SECURITY.md` updated |
| A11 | Periodic re-run of Supabase Advisor | ☐ | P1 | Catches RLS-disabled-in-public regressions |
| A12 | RLS enabled on `resources` table | ✓ | P0 | Migration 0024. Subject-scoped: students/parents see only enrolled subjects; tutors see taught subjects (incl. unpublished); admins all. Audit trigger on insert/update/delete via `handle_audit_log()`. `resource-library` storage bucket + policies tracked at E8 (Task 3). |
| A13 | RLS enabled on quizzes tables | ✓ | P0 | **Runtime-verified 2026-07-27.** Migrations 0025 and 0026 cover `quizzes`, `quiz_questions`, `quiz_options`, and `quiz_attachments`. Admins have full access; assigned tutors retain lifecycle write access; tutors may read approved quizzes for taught subjects. Students may discover approved quiz rows and attachments for enrolled subjects, but have no direct question/option policy because options contain `is_correct`. The student server query checks active enrolment and omits answer-key fields before delivery. Attachment mutations are app-authorized and audited. `npm run db:check-rls` passes all 37 public tables against the connected database. Migration 0027 added `quiz_questions.parent_id` (self-referential, for context/passage blocks) and `quiz_attachments.question_id` (per-question attachments); both are covered by the existing `quiz_id`-keyed policies with no new policies and no widened access, verified by `db:check-rls` on 2026-07-27. |
| A14 | RLS enabled on `class_credits` + `lesson_cancellations` (reschedule/cancellation credits) | ✓ | P0 | **Code-verified 2026-07-30, migration 0031.** Both tables have RLS enabled with no client policies - deny-by-default for `anon`/`authenticated`, same posture as `reschedule_requests`; all access is server-side Drizzle as the postgres role. Both are in `scripts/check-rls.mjs`'s `ALLOW_NO_RLS` allowlist (annotated "role-guarded workflow, migration 0031") so `db:check-rls` reports them as an intentional deny-all rather than a false-positive gap. Every self-serve action that reads or writes these tables (`cancelLesson`, `grantRescheduleCredit`, `redeemCreditIntoSlot` in `src/lib/credits.ts` / `src/app/_actions/*.ts`) re-verifies lesson ownership and parent-child linkage server-side before touching a row - the app layer is the real gate, matching C6/K3. `npm run db:check-rls` passes both new tables plus all pre-existing tables. Owner browser confirmation of the resulting UI is still pending - see `docs/changes/2026-07-29-reschedule-credits.md`. |
| A15 | RLS enabled on `allowance_adjustments` (admin allowance top-ups) | ✓ | P0 | **Code-verified 2026-07-31, migration 0032.** RLS enabled with no client policies - deny-by-default, same posture as `class_credits` (A14); in `scripts/check-rls.mjs`'s `ALLOW_NO_RLS` allowlist ("admin-only allowance top-ups, migration 0032"). The table plus the admin credit/allowance/undo actions (`src/app/admin/_lib/actions-credits.ts` → `src/lib/admin-credits.ts`) are all `requireAdmin`-guarded (K3/C6 posture); no self-serve or client path can write it. `npm run db:check-rls` reports it as intentional deny-all (42/42 tables green). Owner browser confirmation pending (no render harness). |
| A16 | RLS enabled on tutor leave + cover workflow | ✓ | P0 | **Code-verified 2026-09-04, migration 0043.** `tutor_leave_requests` and `tutor_cover_requests` use intentional deny-all RLS and server-only Drizzle access. Tutor mutations recheck ownership; admin decisions recheck role; claims require an active tutor, reject the original tutor, serialize same-day claims with a transaction advisory lock, and reject lesson overlaps. Both tables are registered in `scripts/check-rls.mjs`. Runtime verification requires applying migration 0043. |

## B. Authentication (Supabase Auth)

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| B1 | Role lives in `app_metadata` (server-only), not `user_metadata` | ✓ | P0 | Migration 0002 |
| B2 | Auth code reads `app_metadata.role` **only** | ✓ | P0 | **Hardened 2026-07-02 (OWASP A07).** Removed the `?? user_metadata?.role` fallback everywhere (`lib/auth.ts`, `middleware.ts` ×2, `login/actions.ts`, homework-submit API route). `user_metadata` is user-mutable via `supabase.auth.updateUser()`, so trusting it (even as fallback) was a latent privilege-escalation path. Verified all 23 users have `app_metadata.role` (0 would break). Dead `signup/form.tsx` (client `signUp` writing role to `user_metadata`) deleted |
| B3 | Rate limiting on `/login` (brute-force protection) | ✓ | P0 | **Implemented + verified 2026-07-02.** Login moved from client-side `signInWithPassword` to a server action (`src/app/(auth)/login/actions.ts`) wrapped in a Postgres-backed rate limiter (migration 0014, `check_rate_limit`): 20/5min per IP + 5/15min per email. Limiter function verified (fixed-window + reset PASS); login flow (server-side sign-in + cookie + redirect) verified in dev browser. Free-tier; no Pro Auth Hooks needed. Deploy note: per-IP limit assumes a trusted proxy (Vercel) - see `rate-limit.ts` trust boundary; per-email limit is IP-independent |
| B4 | Account lockout after N failed attempts | ⚠ | P1 | Partially addressed by B3's per-email limit (5 fails / 15 min throttles that account). Not a persistent lockout; revisit if needed |
| B5 | Password complexity requirements | ⚠ | P1 | Code-side minimums aligned 2026-07-02: admin-created passwords `min(8)` (was 6), reset flow already `min(8)`. Full complexity policy (length/charset/breach-check) is a Supabase dashboard setting - Auth → Policies (still to configure) |
| B6 | Email ownership confirmed during invite/setup | ⚠ | P0 | Self-signup is disabled; admins create accounts and the setup link is sent to the entered address. Custom-SMTP delivery to a normal external inbox remains unverified, so this cannot be closed yet. |
| B7 | Password reset flow tested end-to-end | ⚠ | P0 | UI/callback/password change work and one reset was received successfully on 2026-09-18. Repeat through Supabase custom SMTP to a normal non-team inbox before marking complete; see K6 and `checklist_beta_fix.md`. |
| B8 | JWT access token TTL reviewed (Supabase default: 1hr) | ☐ | P1 | OK at default; document choice |
| B9 | Refresh token rotation enabled | ☐ | P1 | Supabase setting; check + document |
| B10 | MFA / 2FA for admin accounts | ☐ | P2 | Supabase supports TOTP |
| B11 | Sign-up disabled (invite-only - admins create accounts) | ✓ | P0 | Decision: invite-only. Frontend done 2026-05-27 (signup page replaced with "contact admin"; login no longer links to /signup). Supabase dashboard signup toggle flipped off 2026-05-27 (Authentication → Sign In / Providers → Email) |
| B12 | A deactivated account stays out | ✓ | P0 | **Fixed 2026-10-21.** Deactivating banned the Auth login for `8760h` (one year) and nothing else checked `profiles.is_active`, so a deactivated account could sign in again a year later. The ban is now `876000h` (`DEACTIVATED_BAN_DURATION`, `src/lib/account-ban.ts`, used by Deactivate and by archiving Year 12s), and the sign-in action refuses an inactive profile even without a ban ("This account is no longer active."). Neither database had a deactivated account yet, so no existing ban needed extending. Verified on dev: an archived test student was refused in WebKit; its ban ran to 2126. Sessions already open when an account is deactivated still end only when their token cannot refresh (B8/B9). |

## C. API / Server Actions

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| C1 | CSRF protection (Next.js Server Actions origin check) | ✓ | P0 | Verified 2026-05-27 - no custom server-action config in `next.config.ts` disables the default origin check. Next.js Server Actions enforce same-origin by default. |
| C2 | Zod validation on every server action input | ✓ | P0 | **Closed 2026-07-02.** Full audit of every `"use server"` action. All free-text inputs now length-capped: Zod-schema actions got `.max(N)` (announcements body 10k, users name/phone/school/email/password, classes name/location/onlineLink/description, curriculum description/urls, invoices description, family relationship); manual-FormData actions (tutor saveAttendance/saveLessonNote/createHomework/markSubmission, admin adminSaveAttendance, parent + admin reschedule reason) use `src/lib/validation.ts` `optionalText`/`requiredText` or an inline length guard. Type/format validation was already present; this closes the storage-abuse gap |
| C3 | XSS protection on user-generated content (lesson notes, feedback) | ✓ | P0 | Audited 2026-05-27 - no raw HTML rendering of user input found in any portal page. React's default escape covers everything |
| C4 | Rate limiting on write endpoints (homework submit, feedback post) | ✓ | P1 | **2026-07-02.** `src/lib/rate-limit.ts` (`rateLimit`, fails open) over migration 0014. Applied to the abuse-prone public writes: DM send (30/min/user), discussion thread (10/min), discussion reply (30/min) - all keyed by user id, generous enough to never hit normal use. Reusable helper for any other action |
| C5 | Service role key NEVER returned in any API response | ✓ | P0 | Audited 2026-05-27 - `createAdminClient()` is only ever instantiated server-side (in `_actions/*` and `_lib/*` files), never returned to the client. Service key is in `.env.local` only, server-read only |
| C6 | Service role used only when RLS-bypass is genuinely required | ✓ | P0 | **Re-audited 2026-07-02 (OWASP A01 + server-action review).** `createAdminClient()` (true service-role) used only in `actions-users.ts` for auth.users CRUD (genuinely required); `server-only`-guarded. Drizzle `db` (postgres role, bypasses RLS) is the deliberate architecture - **app-layer `requireRole` + ownership checks are the primary control and were verified present on every server action** (K3 review: no broken-access-control findings). RLS is defense-in-depth. Optional future (Option B): run reads under user JWT so RLS also enforces - significant refactor, not required given verified app-layer gating |
| C7 | No dynamic code-evaluation primitives or string-concatenated SQL | ✓ | P0 | Audited 2026-05-27 - no `eval`, `new Function`, or string-concat SQL anywhere. Drizzle parameterises every query. `scripts/apply-sql.mjs` uses `sql.unsafe()` but only on trusted migration files |
| C8 | Term report PDFs reach families only after an admin sends them | ✓ | P1 | **Fixed 2026-10-26.** `/reports/[studentId]/[termId]` checked the role and the parent link but not whether the report had been sent, so a linked parent (or an unrestricted student) who had the address got the PDF before admin review, with comments a tutor was still writing. Non-admins now need a `term_report_issues` row (else 404, the same answer as no report); malformed ids return 404 instead of a database error. Verified on dev: parent 200 before the fix on an unsent report, 404 after; 200 once sent; admin 200 throughout. |
| C9 | Writing on files: each layer of marks reaches only the right people | ✓ | P0 | **Added 2026-10-28.** Marks live in `file_markups` (migration 0085: RLS on with no client policies, like the other server-only tables in `scripts/check-rls.mjs`). Every open (`openMarkup`, `src/app/_actions/markups.ts`) and save (`POST /api/markups`) goes through `resolveMarkupTarget` (`src/lib/markup/targets.ts`), which re-checks the file against the viewer: a student's notes are written and read only by that student, on files they can already open (their homework worksheet or released solution, their class's booklet and week-plan files, their subjects' library); a submission's feedback is written only by the homework's tutor and shown to the student and linked parents once the work is marked or sent back. Admins and parents never write. The save route checks same origin, rate-limits (240 per 2 minutes per user), caps the body (`MAX_DOC_BYTES`, 2 MB; the column check is 3 MB), validates every mark with zod, and refuses a stale save (409) instead of overwriting a newer copy. "Submit this file" (`/api/student/homework/[id]/submit-markup`) is student-only with the same origin check and 10 per 10 minutes, re-checks that hand-in is open and the worksheet unchanged, and stores the drawn PDF through `storeSubmissionFile`. |

## D. Secrets / Configuration

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| D1 | `.env.local` in `.gitignore` | ✓ | P0 | `.gitignore` has `.env*`; no `.env` files tracked. Verified 2026-05-27 |
| D2 | No secrets in git history | ✓ | P0 | Verified 2026-05-27 - scanned for service role JWTs, `SUPABASE_SERVICE_ROLE_KEY=`, private key blocks. Zero hits |
| D3 | Vercel production env vars set separately from dev | ✓ | P0 | Production variable names were verified in Vercel on 2026-10-06. Values are secret and are not recorded in the repository. Local development uses `.env.local`; always confirm its target before database commands. |
| D4 | Anon key vs service role key - usage audited | ✓ | P0 | **Audited 2026-07-02 (J4/J5 + OWASP).** Anon key: client SDK + server SSR clients only. Service-role key: only in `supabase-admin.ts`, `server-only`-guarded, never in a `"use client"` file (verified 0 client `process.env` refs). No secret reaches the browser bundle |
| D5 | Supabase JWT secret rotated from any default / pre-shared value | ☐ | P1 | Supabase dashboard |
| D6 | Service role key rotation procedure documented | ✓ | P1 | `docs/runbooks.md` §I4 covers containment, Supabase rotation, local/Vercel replacement, redeploy, and exposure review. |

## E. File Uploads / Storage

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| E1 | Server-side file type validation (MIME + magic bytes, not just extension) | ✓ | P0 | **Closed 2026-07-02.** `src/lib/upload-validation.ts` sniffs leading bytes (pdf/png/jpeg/gif/webp/zip-OOXML/ole-Office/mp4/webm; text validated as UTF-8) and requires the *declared* MIME to be in a per-context allowlist AND the content family to match. All three upload paths (`createHomework`, `uploadTutorAttachment`, `uploadCurriculumFile`) route through it. Residual (accepted): OOXML/OLE subtypes not distinguished - verifies container family only. `image/svg+xml` deliberately excluded (XSS vector). Logic verified with 24 unit cases incl. html/exe-spoofed-as-pdf → rejected. **2026-10-28:** student homework submissions were a fourth path with no check (any declared type was stored as sent). They now go through `SUBMISSION_POLICY` (PDF, PNG, JPEG, HEIC, Word, text; 10 MB) with the canonical extension and content type; a file the browser sent with no type is judged by its extension (`typeFromFileName`) and still content-checked, so an HTML file renamed .docx is refused (unit tests and the real form on dev). |
| E2 | Server-side file size limits | ✓ | P0 | **Closed 2026-07-02.** `validateUpload` enforces per-policy `maxBytes` (25 MB attachments/booklets, 500 MB video) + rejects empty files, before any upload |
| E3 | Filename sanitisation (path traversal, special chars) | ✓ | P0 | **Closed 2026-07-02.** Extension + content-type are now **canonical**, derived from the validated allowlist entry - never from the client filename. A client cannot force a `.html`/`.exe`/`.svg` extension or a `text/html` content-type. Path components remain server-generated (`tutor.id`/`sectionId` + `randomUUID`) |
| E4 | Public vs private bucket separation | ⚠ | P0 | **Code complete:** homework attachments store object paths and are signed by the server-only service client after student/tutor ownership checks; curriculum, submissions, discussions, and resources follow the same private/signed pattern. **Remaining evidence:** verify all five Production buckets are private and live-test each role's allowed download plus a denied cross-user request. |
| E5 | Signed URL expiry for private downloads | ✓ | P0 | Signed URLs are short-lived (1 hr): curriculum `SIGNED_URL_TTL_SECONDS = 3600`, homework attachments + submissions `3600`. No long-lived/persisted URLs stored after E4 code change |
| E6 | Virus / malware scanning on uploads | ☐ | P2 | Real concern once external parents upload; defer |
| E7 | `discussion-attachments` private bucket exists | ⚠ | P1 | Created and verified in dev on 2026-07-22. Upload/signing use the service client after `requireRole` + board visibility checks. Confirm the Production bucket is private in the dashboard and run an allowed/denied live attachment test. |
| E8 | `resource-library` private bucket exists + storage policies | ⚠ | P1 | Created in dev; resource and quiz flows use randomized paths, server-side authorization, signed URLs, size/count limits, MIME/magic-byte validation, and staged-object cleanup. Confirm Production bucket privacy and one allowed/denied live download. |
| E9 | Office previews send a signed address to Microsoft | ✓ | P1 | **Decided 2026-10-26.** Word, PowerPoint and Excel library resources (tutor and admin uploads) preview in Microsoft's Office web viewer (`view.officeapps.live.com`, allowed in CSP `frame-src`). It is given the file's 1-hour signed address (`signResourceAttachment`, `src/lib/resources-storage.ts`) only after `openResourceFile` has checked the viewer's role and subject access, so Microsoft fetches that one file while the address lasts. Homework attachments, submissions and other student work are never sent there (`FileViewerButton` keeps Open separately). Microsoft belongs on the H6 subprocessor list. |

## F. Network / Headers

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| F1 | HTTPS only in production | ✓ | P0 | `https://portal.taiyotuition.com` was inspected as a Ready Vercel Production deployment on 2026-10-06; security headers are configured in `next.config.ts`. |
| F2 | HSTS header | ✓ | P1 | **2026-07-02** - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in `next.config.ts`. Ignored by browsers over http (dev), enforced over https (prod) |
| F3 | Content-Security-Policy header | ⚠ | P1 | **CSP present in `next.config.ts`; script-src is `'unsafe-inline'`. Nonce upgrade attempted 2026-07-02 and REVERTED - see below.** All directives locked except script/style: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, scoped img/media/connect (Supabase https+wss), env-derived, prod adds `upgrade-insecure-requests`. `style-src 'unsafe-inline'` required by inline `style={{}}`. **Verified in a prod build (`next build && next start`): `/login` serves with all 18 scripts loadable, no breakage.** <br>**Why not nonce-based:** a per-request nonce needs dynamic rendering, but public pages like `/login` are **statically prerendered** (`x-nextjs-prerender: 1`) - their HTML is baked at build with no nonce, so a nonce'd `script-src` blocks every script (verified: 0/18 scripts nonced → page dead). Making it work would require forcing the whole app to dynamic rendering (loses static optimization) for marginal gain over existing XSS defenses (C3: React auto-escaping, no `dangerouslySetInnerHTML`; object-src/base-uri/frame-ancestors already locked). Not worth it. Revisit only if a strong script-XSS control is specifically required. <br>**2026-10-28:** checked again in a prod build with the file writing viewer (pdf.js worker, fonts and character maps same-origin under `/pdfjs`, PDFs fetched from Supabase under `connect-src`): no violations in Chrome or WebKit. Zod 4 probed for `new Function` and logged a `script-src` violation on every page; `src/instrumentation-client.ts` sets its `jitless` option so it no longer tries. To test a local `next start` in WebKit, drop `upgrade-insecure-requests` and HSTS (WebKit applies both to `http://localhost`, Chrome exempts it). |
| F4 | X-Frame-Options / frame-ancestors (clickjacking) | ✓ | P1 | **2026-07-02** - `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` in `next.config.ts` |
| F5 | X-Content-Type-Options: nosniff | ✓ | P1 | **2026-07-02** - set in `next.config.ts` headers |
| F6 | Referrer-Policy: strict-origin-when-cross-origin (or stricter) | ✓ | P1 | **2026-07-02** - set in `next.config.ts` headers; also `Permissions-Policy` disables camera/mic/geo/topics |
| F7 | Supabase Site URL set to the production origin | ☐ | P0 | Production is live, but this dashboard value was not independently verified in the 2026-10-06 audit. Confirm it is `https://portal.taiyotuition.com`. |
| F8 | Auth redirect URLs whitelisted in Supabase | ☐ | P0 | Confirm `http://localhost:3000/auth/callback` for dev and `https://portal.taiyotuition.com/auth/callback` for Production. The callback route exists; dashboard evidence is still pending. |

## G. Logging / Monitoring / Audit

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| G1 | Audit logs for admin actions | ✓ | P0 | Migration 0006 (triggers on `profiles`, `family_links`, `classes`, `enrollments`, `invoices`, `announcements`). **Actor capture closed 2026-07-02:** `src/lib/with-actor.ts` `withActor()` sets `request.jwt.claims` transaction-locally so the SECURITY DEFINER trigger records the acting admin. Applied to every audited admin mutation (announcements, classes, enrollments, invoices, profiles updates, family links). Verified: with `withActor` → `actor_id` + `actor_role` populated; control without → NULL. Note: `createUser`'s profile row is inserted by the `handle_new_auth_user` trigger (auth context), so that one INSERT still logs NULL actor - the subsequent `updateUser`/role changes are attributed |
| G2 | Failed login attempt logging | ☐ | P1 | Supabase logs this; surface it |
| G3 | Sensitive-action logging (data export, account changes, role changes) | ✓ | P0 | Covered by G1 - every INSERT/UPDATE/DELETE on the six watched tables is logged with old + new JSONB and now an attributed actor (via `withActor`). **Admin-DM-read logging (safeguarding) deferred - no in-app path yet:** `getThreadForMe` scopes the admin messages UI to threads the admin participates in; RLS (0012) permits admin read of all DMs but nothing surfaces non-participant conversations. When a safeguarding-oversight view is built, instrument it with an audit READ row + report/reason gate |
| G4 | Error monitoring (Sentry / similar) | ☐ | P1 | Catches unexpected failures including security ones |
| G5 | Alerting on RLS-denial spikes (possible enumeration attack) | ☐ | P2 | Future; requires log aggregation |
| G6 | Postgres query log retention policy | ☐ | P1 | Supabase default; document |
| G7 | Audit log retention + immutability | ☐ | P1 | Once G1 exists |

## H. Compliance / Legal - students are minors

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| H1 | Privacy policy published | ☐ | P0 | Required for any public service |
| H2 | Terms of service published | ☐ | P0 | Same |
| H3 | Parental consent flow on minor signup (COPPA / Australian Privacy Act equivalent) | ☐ | P0 | Legal advice needed for your jurisdiction |
| H4 | Data retention + deletion policy | ☐ | P1 | GDPR-style right-to-be-forgotten |
| H5 | Data export feature (parent requests child's data) | ☐ | P1 | GDPR right-to-portability |
| H6 | Subprocessor list (Supabase, Vercel, Stripe later, etc.) | ☐ | P1 | Document for parents/legal. Include Microsoft (Office web viewer for library resources, E9). |
| H7 | DPA with Supabase + Vercel signed | ☐ | P1 | Available on their websites |
| H8 | Cookie consent banner (if EU users) | ☐ | P1 | If targeting any EU-resident user |

## I. Operational / Disaster Recovery

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| I1 | Supabase point-in-time recovery enabled | ☐ | P0 | Paid tier feature; verify on production |
| I2 | Backup restore actually tested at least once | ☐ | P1 | Untested backups are wishes |
| I3 | Incident response runbook | ✓ | P1 | **`docs/runbooks.md` §I3** - triage/contain/assess/eradicate/recover/notify, incl. minors breach-notification duties (Privacy Act NDB + Reportable Conduct) |
| I4 | Service role key compromise procedure | ✓ | P0 | **`docs/runbooks.md` §I4** - rotate in Supabase, update `.env.local`+Vercel+redeploy, assess exposure window via audit_logs, git-history note |
| I5 | Admin account compromise procedure | ✓ | P1 | **`docs/runbooks.md` §I5** - ban + revoke sessions, audit `actor_id` actions, reverse via `old_data`, check planted persistence |
| I6 | Migration rollback procedure | ✓ | P1 | **`docs/runbooks.md` §I6** - stop dev server, apply per-migration "Reversible by" via `apply-sql.mjs`, re-run `db:check-rls`; never `db:push`; PITR for data |
| I7 | Production Supabase project separate from dev | ✓ | P0 | Production and personal/test projects are intentionally separate. Never copy production database credentials into the local environment used for testing. |

## J. Code / Dependency Security

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| J1 | `npm audit` clean | ⚠ | P1 | **Patched 2026-10-26.** Production ran `next` 15.5.18, which `npm audit` flagged critical (unauthenticated remote code execution in the Image Optimization API with SVG or AVIF files, and on Windows hosts), plus high Server Action denial-of-service and SSRF advisories. Upgraded to `next` and `eslint-config-next` 15.5.28; `npm audit fix` (in-range only) also moved `zod` to 4.6.7 (memory exhaustion on oversized input, which matters because zod validates every request), `nanoid`, `source-map-js` and `postcss`. Verified: typecheck, lint, 720 tests, a production build, and `next start` serving `/login` with the CSP. **Left:** the `postcss` copy bundled inside `next` (build-time only, processes the portal's own CSS); its only fix is Next 16, a breaking upgrade - do not `npm audit fix --force`. Dependabot (J2) did not raise the Next patch; check its PRs are being merged. |
| J2 | Dependabot or Renovate enabled | ✓ | P1 | `.github/dependabot.yml` - weekly npm checks, PRs grouped by stack (Next, Supabase, Drizzle). Auto-activates on push to GitHub |
| J3 | No `sql.unsafe()` / Drizzle raw SQL without parameterisation | ✓ | P0 | **Re-audited 2026-07-02 (OWASP A03).** Only `scripts/apply-sql.mjs` uses `sql.unsafe` (trusted migration files). All app queries use the Drizzle builder or parameterised tagged `sql\`\`` templates (incl. `rate-limit.ts`, ranking queries). No string-concatenated SQL, no `sql.raw` in app code |
| J4 | `"server-only"` import on all server-side modules with secrets | ✓ | P0 | **Closed 2026-07-02.** Full audit. Added `import "server-only"` to the 7 unguarded plain modules - critically `src/db/client.ts` (DATABASE_URL) and `src/app/admin/_lib/supabase-admin.ts` (service-role key), plus `lib/notifications.ts`, `lib/curriculum.ts`, and the three per-subject `_queries.ts`. `"use server"` action files are inherently server-only; page/route files are server-only in the App Router |
| J5 | No `process.env.X` access in client components | ✓ | P0 | **Verified 2026-07-02.** Audited all 47 `"use client"` files - zero `process.env` references (public or otherwise). Only non-`NEXT_PUBLIC_*` env reads are in server modules (`db/client.ts`, `supabase-admin.ts`), now `server-only`-guarded (J4) |

## K. Pre-launch verification

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| K1 | OWASP Top 10 self-audit | ✓ | P0 | **Done 2026-07-02.** Full A01–A10 pass. No injection/XSS/SSRF/deserialization issues. Findings fixed: A07 user_metadata role fallback (B2), A01 open redirect in `auth/callback` + login (guarded), A09 audit actor capture (G1/G3 via `withActor`), A02 admin password min 6→8, A04 dead signup footgun removed. Residual (accepted/documented): A05 `script-src 'unsafe-inline'` (F3 - nonce not viable on static pages), login/createUser return raw Supabase error text (minor) |
| K2 | Penetration test (or HackerOne-style bounty) | ☐ | P2 | Probably overkill for MVP, essential later |
| K3 | Security review of all server actions before launch | ✓ | P0 | **Done 2026-07-02; admin-tier pass 2026-09-09.** Every mutation rechecks role/ownership server-side. Reception cannot create privileged accounts, change any role, edit/reset/deactivate an admin account, or set the admin PIN; hiding controls is only presentation. Tutor homework reminders reload overdue work and current enrolment server-side, apply `canDM`, and are rate-limited. Reschedule execution revalidates compatible targets rather than trusting the picker. |
| K4 | Supabase project settings reviewed (URL allowlist, redirect URLs, JWT secret) | ☐ | P0 | One-time before launch |
| K5 | All P0 items in this checklist resolved | ☐ | P0 | Gate for full release. Remaining evidence includes storage/dashboard checks, B6/B7/K6 custom-SMTP delivery, F7/F8/K4 Supabase URL settings, I1 backup/PITR, and H1–H3 legal/privacy/parental-consent work. |
| K6 | Configure production SMTP provider | ☐ | P0 | Resend DKIM/SPF/MX DNS and Vercel email variable names were verified on 2026-10-06. DNS does not configure Supabase Auth: confirm Auth → SMTP, then test account setup and reset to a normal external inbox before closing. |

---

## Recommended order

If you want a sequence rather than a category-by-category walk:

1. **D1, D2** (5 min): Confirm `.env.local` is gitignored and no keys in git history. Trivial, blocking.
2. **G1, G3** (1-2 days): Audit logs for admin actions. PRD requirement. Biggest gap.
3. **B3, B4** (half day): Rate limiting on `/login`. Brute-force protection.
4. **B6, B7** (half day): Email verification + password reset tested.
5. **C1, C2, C5** (1-2 days): Server action hardening - Zod everywhere, CSRF verified, service-role key audited.
6. **F1, F7, F8** (1 hour): Verify HTTPS, CORS, redirect allowlist in Supabase.
7. **H1, H2** (legal): Privacy policy + ToS published before any real signup.
8. **A5, E1-E5** (when uploads ship): Storage + upload validation.
9. **A9** (1 hour, but P0): Lock `homework_assignments` column-level UPDATE - pairs with student portal API audit.
10. Everything else in priority order.
