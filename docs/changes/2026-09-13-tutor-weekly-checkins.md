# Tutor weekly check-ins and payroll history

Implemented locally and migrated to the isolated test Supabase project on
13 September 2026. Production still requires migration `0050` and deployment
after manual QA.

## Tutor workflow

- `Schedule → Weekly check-in` opens a Monday–Sunday record generated from the
  tutor's scheduled lessons.
- Tutors can navigate weeks, compare each class/date/time, and see total worked
  hours and estimated pay.
- Approving freezes that weekly snapshot for payroll history.
- Reporting an error changes the week to `disputed` and notifies every active
  owner-admin with a link to the exact tutor/week and the tutor's explanation.

## Owner workflow

- `Schedule & money → Tutor check-ins` is owner-only; reception neither sees the
  navigation link nor passes the server guard.
- The owner can filter a week by tutor or class and compare approved, pending,
  and disputed records.
- A payroll row can be corrected for class, subject, date, start/finish times,
  hourly rate, and note, or removed/restored from pay.
- Any owner change resets the weekly status to pending and notifies the tutor to
  review and approve it again. Corrections affect the payroll snapshot only, so
  the original timetable is never silently rewritten.
- Monthly history counts approved snapshots as pay owed and keeps pending or
  disputed totals separate.

## Scheduling, security, and audit

- Admin sets the tutor's hourly rate alongside existing owner-only payroll
  details.
- The authenticated daily cron creates deduplicated reminders: tutor on
  Saturday and Sunday, and owner-admin on Sunday if the week remains unapproved.
- Empty weeks and approved weeks are not reminded.
- Weekly snapshots, entries, and tutor pay rates use actor-aware audit triggers.
- The two new payroll tables have RLS enabled with intentional deny-all browser
  access; all reads and changes pass through role-checked server code.

## Validation completed

- TypeScript passed.
- 25 test files / 150 tests passed.
- The optimized Next.js production build passed.
- RLS audit passed for all 55 public tables on the isolated test database.
- An authenticated Sunday cron smoke test generated five pending weekly records
  with nine lesson rows and the expected tutor/owner reminders. A repeat run
  left zero duplicate reminder keys.
