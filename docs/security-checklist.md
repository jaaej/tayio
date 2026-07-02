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
| A6 | Storage policies for resource library (admin/tutor uploads) | ☐ | P1 | Bucket not created yet |
| A7 | Storage policies for profile photos | ☐ | P2 | Feature not built |
| A8 | Column-level UPDATE restriction on `profiles.role` | ✓ | P1 | **Closed 2026-07-02, migration 0013.** BEFORE UPDATE trigger silently reverts `profiles.role` unless caller is admin or a trusted server context (postgres/service_role). Verified via JWT impersonation: self-promote blocked, non-role updates unaffected, admin + server bypass work |
| A9 | Column-level UPDATE restriction on `homework_assignments.{score,feedback,marked_at,marked_by}` | ✓ | P0 | Migration 0007 — BEFORE UPDATE trigger silently reverts these columns unless caller is admin or homework's authoring tutor. Verified 2026-05-27 |
| A10 | New-table RLS discipline (every `pgTable` addition gets a migration entry) | ☐ | P0 | Process, not code — keep `SECURITY.md` updated |
| A11 | Periodic re-run of Supabase Advisor | ☐ | P1 | Catches RLS-disabled-in-public regressions |

## B. Authentication (Supabase Auth)

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| B1 | Role lives in `app_metadata` (server-only), not `user_metadata` | ✓ | P0 | Migration 0002 |
| B2 | Auth code reads `app_metadata.role` first | ✓ | P0 | Commit 124bfb7 |
| B3 | Rate limiting on `/login` (brute-force protection) | ⚠ | P0 | **Deferred 2026-05-27.** Supabase Auth Hooks (the clean implementation) are Pro-tier only; project is on FREE. Custom server-action wrapper around `signInWithPassword` is the free alternative (~half-day) but skipped for MVP. Residual control: Supabase's built-in IP-based limits on `/auth/v1/token` (~tens of req/min/IP, not configurable). Mitigating factor: signup is invite-only (B11) so attackers must know an existing email. **Revisit on Pro upgrade or first real user volume.** |
| B4 | Account lockout after N failed attempts | ⚠ | P1 | Same deferral as B3. Supabase has no native account-lockout on FREE; would require the same custom wrapper |
| B5 | Password complexity requirements | ☐ | P1 | Supabase dashboard → Auth → Policies |
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
| C4 | Rate limiting on write endpoints (homework submit, feedback post) | ⚠ | P1 | Same constraint as B3 — Pro-tier Supabase Auth Hooks or custom server-action wrapper. Deferred |
| C5 | Service role key NEVER returned in any API response | ✓ | P0 | Audited 2026-05-27 — `createAdminClient()` is only ever instantiated server-side (in `_actions/*` and `_lib/*` files), never returned to the client. Service key is in `.env.local` only, server-read only |
| C6 | Service role used only when RLS-bypass is genuinely required | ⚠ | P0 | Audited 2026-05-27. Drizzle `db` (postgres role, bypasses RLS) is used for ALL server-side reads + writes — by design for the current architecture. `createAdminClient()` (true service-role) used only in `actions-users.ts` for auth.users mutations (creating/updating/banning users), which genuinely require it. No abuse. Open follow-up: switch some reads to the user's JWT session so RLS would defend against bugs in server code — but that's a significant refactor |
| C7 | No dynamic code-evaluation primitives or string-concatenated SQL | ✓ | P0 | Audited 2026-05-27 — no `eval`, `new Function`, or string-concat SQL anywhere. Drizzle parameterises every query. `scripts/apply-sql.mjs` uses `sql.unsafe()` but only on trusted migration files |

## D. Secrets / Configuration

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| D1 | `.env.local` in `.gitignore` | ✓ | P0 | `.gitignore` has `.env*`; no `.env` files tracked. Verified 2026-05-27 |
| D2 | No secrets in git history | ✓ | P0 | Verified 2026-05-27 — scanned for service role JWTs, `SUPABASE_SERVICE_ROLE_KEY=`, private key blocks. Zero hits |
| D3 | Vercel production env vars set separately from dev | ☐ | P0 | When deploying |
| D4 | Anon key vs service role key — usage audited | ☐ | P0 | Anon: client SDK only. Service: server-only, never imported into a client component |
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

## F. Network / Headers

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| F1 | HTTPS only in production | ⚠ | P0 | Code clean (only `http://` in code is the SVG namespace ID); auth callback uses `url.origin`. Verify Vercel "HTTPS redirect" toggle at deploy time |
| F2 | HSTS header | ✓ | P1 | **2026-07-02** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in `next.config.ts`. Ignored by browsers over http (dev), enforced over https (prod) |
| F3 | Content-Security-Policy header in `next.config.ts` | ⚠ | P1 | **2026-07-02** — CSP set in `next.config.ts`, env-derived Supabase origin (https+wss). Locked down: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, scoped img/media/connect. **Caveat:** `script-src` still allows `'unsafe-inline'` (Next injects inline bootstrap/hydration scripts) — so CSP is NOT yet a real XSS control for scripts. Upgrade path = per-request nonce via middleware. `style-src 'unsafe-inline'` required by inline `style={{}}` usage. **Needs a live `curl -I` smoke test + click-through before trusting** |
| F4 | X-Frame-Options / frame-ancestors (clickjacking) | ✓ | P1 | **2026-07-02** — `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` in `next.config.ts` |
| F5 | X-Content-Type-Options: nosniff | ✓ | P1 | **2026-07-02** — set in `next.config.ts` headers |
| F6 | Referrer-Policy: strict-origin-when-cross-origin (or stricter) | ✓ | P1 | **2026-07-02** — set in `next.config.ts` headers; also `Permissions-Policy` disables camera/mic/geo/topics |
| F7 | Supabase CORS allowed origins set to production domain only | ☐ | P0 | Deferred until production deploy. Supabase dashboard → Project Settings → API → Site URL = `https://<your-domain>` |
| F8 | Auth redirect URLs whitelisted in Supabase | ☐ | P0 | Deferred until production deploy. Supabase dashboard → Authentication → URL Configuration → Redirect URLs: add `http://localhost:3000/auth/callback` (dev) and `https://<your-domain>/auth/callback` (prod). Callback path verified at `src/app/auth/callback/route.ts` |

## G. Logging / Monitoring / Audit

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| G1 | Audit logs for admin actions | ⚠ | P0 | Migration 0006 applied. Triggers on `profiles`, `family_links`, `classes`, `enrollments`, `invoices`, `announcements`. Caveat: server-context mutations (Drizzle via postgres role) log with `actor_id = NULL`. To get reliable actor capture, server actions must set JWT claims before mutating |
| G2 | Failed login attempt logging | ☐ | P1 | Supabase logs this; surface it |
| G3 | Sensitive-action logging (data export, account changes, role changes) | ⚠ | P0 | Covered by G1 — every INSERT/UPDATE/DELETE on the six watched tables is logged with old + new JSONB. Same actor-capture caveat as G1 |
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
| I3 | Incident response runbook | ☐ | P1 | What to do when X happens |
| I4 | Service role key compromise procedure | ☐ | P0 | Must include: rotate key, audit logs, notify users |
| I5 | Admin account compromise procedure | ☐ | P1 | Lock admin, audit recent admin actions, restore from backup if needed |
| I6 | Migration rollback procedure | ⚠ | P1 | Partly in SECURITY.md (per-migration "reversible by" sections); needs a single runbook |
| I7 | Production Supabase project separate from dev | ☐ | P0 | If it isn't already — verify |

## J. Code / Dependency Security

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| J1 | `npm audit` clean | ☐ | P1 | Run `npm audit` regularly; fix high/critical |
| J2 | Dependabot or Renovate enabled | ✓ | P1 | `.github/dependabot.yml` — weekly npm checks, PRs grouped by stack (Next, Supabase, Drizzle). Auto-activates on push to GitHub |
| J3 | No `sql.unsafe()` / Drizzle raw SQL without parameterisation | ⚠ | P0 | `scripts/apply-sql.mjs` uses it (migrations only, trusted input) — audit any other usage |
| J4 | `"server-only"` import on all server-side modules with secrets | ✓ | P0 | **Closed 2026-07-02.** Full audit. Added `import "server-only"` to the 7 unguarded plain modules — critically `src/db/client.ts` (DATABASE_URL) and `src/app/admin/_lib/supabase-admin.ts` (service-role key), plus `lib/notifications.ts`, `lib/curriculum.ts`, and the three per-subject `_queries.ts`. `"use server"` action files are inherently server-only; page/route files are server-only in the App Router |
| J5 | No `process.env.X` access in client components | ✓ | P0 | **Verified 2026-07-02.** Audited all 47 `"use client"` files — zero `process.env` references (public or otherwise). Only non-`NEXT_PUBLIC_*` env reads are in server modules (`db/client.ts`, `supabase-admin.ts`), now `server-only`-guarded (J4) |

## K. Pre-launch verification

| # | Item | Status | Priority | Notes |
|---|---|---|---|---|
| K1 | OWASP Top 10 self-audit | ☐ | P0 | Walk the list against this codebase |
| K2 | Penetration test (or HackerOne-style bounty) | ☐ | P2 | Probably overkill for MVP, essential later |
| K3 | Security review of all server actions before launch | ☐ | P0 | Pairs with C-section items |
| K4 | Supabase project settings reviewed (URL allowlist, redirect URLs, JWT secret) | ☐ | P0 | One-time before launch |
| K5 | All P0 items in this checklist resolved | ☐ | P0 | Gate for launch |
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
