# Tutor leave and class-cover workflow

Date: 2026-09-04

## Delivered

- `/tutor/timetable#leave` provides two request paths:
  - one class unavailable: minimum 48 hours' notice, posted immediately;
  - extended leave: 2–90 inclusive days, held for admin approval.
- `/tutor/cover` is the notice board for taking cover, releasing it, and
  reviewing request status.
- Admin approvals and the live cover board sit at
  `/admin/reschedules#tutor-cover`.
- Approval materialises one cover request for every affected future lesson.
  The reminder sweep also picks up lessons generated after approval.
- Any active tutor except the original tutor may claim a class. Claims are
  serialized and rejected if the tutor already has an overlapping lesson.
- A successful claim updates `lessons.tutor_id`, placing the class into the
  replacement tutor's timetable and lesson-detail access.
- Admin can assign a replacement from the board. Tutors can release a claim;
  release immediately raises an urgent admin notification.

## Notifications and reminders

- Admin is notified when a class is posted, extended leave is requested or
  approved, and cover is claimed or released.
- Extended-leave requests and uncovered approvals are marked `URGENT:`.
- Each still-open lesson produces deduplicated 48-hour and 24-hour alerts.
- Approved extended leave produces one daily summary while any lessons remain
  open.
- A missed uncovered lesson is marked expired and generates an urgent alert.
- Urgent inbox rows are visually distinct, filterable, and reflected by the
  admin bell.

The reminder service is idempotent. It runs from a CRON_SECRET-protected daily
Vercel job (`0 20 * * *`, approximately 6–7am Melbourne depending on daylight
saving) and every five minutes while an admin portal tab is visible. The latter
provides timely thresholds on Vercel Hobby, whose cron minimum interval is once
per day.

## Deployment requirements

1. Apply `supabase/migrations/0043_tutor_cover_workflow.sql` before deploying
   the application code.
2. Add a random `CRON_SECRET` of at least 16 characters to Vercel Production.
3. Deploy and confirm the cron appears under Project → Settings → Cron Jobs.
4. Smoke-test request → approve → claim, plus an intentionally near-deadline
   cover row in a non-production environment.

No client policies are added for the two workflow tables. Both use RLS
deny-by-default; all access goes through role-checked server actions and queries.
