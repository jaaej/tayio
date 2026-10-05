# Production documentation sync — 6 October 2026

## Purpose

Reconcile the durable project documentation with the current code and visible
production configuration after the September beta implementation batches. No
feature behavior or production data was changed in this documentation pass.

## Verified facts

- Local branch at audit start: `main`, clean, commit `49801e0`.
- Vercel project `tayio` reported the custom-domain Production deployment
  `Ready`; `portal.taiyotuition.com` was attached as an alias.
- The portal CNAME resolved to Vercel.
- Resend DKIM, SPF, and MX records resolved for the configured sending
  subdomain.
- The expected Supabase/database/cron/admin-PIN/Resend variable names existed
  in Vercel Production. Secret values were not read into documentation.
- There were 52 SQL files in `supabase/migrations/`; the newest was
  `0055_student_curriculum_access.sql`. Migration prefixes have gaps, so the
  largest prefix is not the file count.
- Current code is Next.js 15/React 19/TypeScript/Tailwind 4, not the old
  Next.js 16 Phase 1 placeholder described by the former README.
- The current official Supabase documentation lists the built-in Auth provider
  at 2 emails per project per hour; custom SMTP is required for production and
  begins with a configurable 30-per-hour Auth limit.

## Documentation changed

- Replaced the early-phase `README.md` with the current production-beta status,
  workflows, safe local setup, validation commands, database rules, and doc map.
- Replaced `docs/AGENT_HANDOFF.md` with a current resume guide, architecture and
  security boundaries, migration state, environment separation, and explicit
  open acceptance work.
- Updated `checklist_beta_fix.md` to separate completed DNS/Vercel email setup
  from still-unverified Supabase custom SMTP and end-to-end delivery.
- Converted `docs/client-dns-setup.md` from a placeholder template into a
  completed-record/recovery guide without copying the DKIM public key.
- Added a current snapshot to `docs/deploy.md`, removed fixed migration counts,
  and labelled the Phase 1/2 sections as historical replacement-environment
  guidance.
- Corrected `docs/features.md` for curriculum release/grants, Taiyo Blitz timing
  and avatars, tutor payroll/profile/announcements, admin search/account
  management/reporting, targeted announcement email, and all five storage
  buckets.
- Removed fixed security caveats that migrations already closed, and updated
  the security checklist only where code or production evidence was available.
  Dashboard-only controls remain open rather than being guessed.
- Marked `docs/checklist.md` as a legacy/full inventory and pointed current
  acceptance work to `checklist_beta_fix.md`.

## Still open

- Configure or confirm Supabase Auth custom SMTP and test account setup and
  password reset to a normal external inbox.
- Test targeted urgent-announcement delivery and retry/recipient isolation.
- Add DMARC after the sending flow is stable; no `_dmarc.taiyotuition.com` TXT
  policy resolved during this audit.
- Complete the unchecked manual acceptance cases in `checklist_beta_fix.md`,
  especially make-up privacy, curriculum access/viewers, payroll/check-ins,
  cron/audit behavior, global search, and final live role smoke tests.
- Independently verify the remaining Supabase dashboard/security settings and
  Production bucket privacy recorded in `docs/security-checklist.md`.

## Validation

- `npm run typecheck` — passed.
- `npm test` — 167 tests passed across 29 files.
- `npm run build` — passed on Next.js 15.5.18; 51 static pages generated.
- `git diff --check` — passed.
