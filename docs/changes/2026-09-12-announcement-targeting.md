# Announcement targeting and tutor approval

Implemented locally and on the isolated test Supabase project on 12 September
2026. This batch is not production-deployed yet.

## What changed

- Admin now composes an audience with independent role, subject, year, class,
  and assigned-tutor choices. Values inside a group are alternatives; populated
  groups combine so recipients must match every selected group.
- Publishing resolves and stores a fixed recipient snapshot. Student and parent
  dashboards, notifications, and urgent-email jobs all use that same snapshot.
- Tutor announcements are limited to a class owned by the signed-in tutor and
  are saved as pending. Active admins receive an inbox approval request.
- Admin can approve or reject with feedback. Only approval creates the recipient
  snapshot and delivery records; the tutor receives the outcome.
- Urgent announcements are queued for email with claim, attempt, failure, sent,
  and stale-job recovery state. The existing authenticated daily cron retries
  pending/failed jobs up to three times.
- Missing email credentials never blocks in-app publishing. Jobs remain queued
  until `RESEND_API_KEY` and a verified `ANNOUNCEMENT_EMAIL_FROM` are configured.
- Supabase announcement reads now require either authorship or published
  recipient membership. Recipient membership and email-delivery tables expose
  no direct client policies.

## Database

Migration `0048_announcement_targeting_and_approval.sql` adds announcement
status/target fields, recipient snapshots, email delivery jobs, legacy-data
backfill, and the recipient-aware read policy. It has been applied to the
isolated test project only.

## Verification

- TypeScript type check passes.
- 24 test files / 146 tests pass.
- Production build passes.
- RLS audit passes for all 53 public tables.
- Manual authenticated audience, approval, and email-delivery QA remains listed
  in `checklist_beta_fix.md`.
