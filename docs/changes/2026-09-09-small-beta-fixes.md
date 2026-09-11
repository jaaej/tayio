# Small beta fixes — 9 September 2026

## Included

- Reschedule execution now enforces the same subject/year boundary at the
  server layer. Per-term usage counts distinct original lessons, so moving the
  same lesson again remains one allowance use.
- Tutors can send a one-click, task-specific overdue-homework reminder from
  `Students to bump`. The server reloads current tasks and enrolment scope,
  rate-limits sends, writes the DM, and creates a student inbox notification.
- Reception cannot create privileged accounts, change roles, edit/reset/
  deactivate admin accounts, or change the owner-controlled admin PIN. These
  restrictions are enforced inside server actions as well as reflected in UI.
- Taiyo Blitz correct answers now show a short green reward burst and animated
  score. Existing selectable sound/Mute support remains, and reduced-motion
  preferences are respected.
- The daily secured cron sends same-day free-trial notices to admin and the
  assigned tutor, including student/class/subject/time/tutor details, and sends
  admin one follow-up after the trial ends. Regular and make-up attendance are
  both supported.

## Database and deployment

Apply `supabase/migrations/0044_notification_dedupe.sql` before deploying the
new code. It adds a nullable `notifications.dedupe_key` and unique
`(user_id, dedupe_key)` index so scheduled retries cannot create duplicates.
Existing notifications keep a null key and are unaffected.

The free-trial sweep shares `/api/cron/tutor-cover-reminders` and therefore the
existing `CRON_SECRET` Vercel configuration and daily schedule.

## Verification

Automated type, unit, and production-build checks are supplemented by the
manual acceptance cases in `checklist_beta_fix.md`. The migration itself still
needs to be applied to the target Supabase project before runtime QA.
