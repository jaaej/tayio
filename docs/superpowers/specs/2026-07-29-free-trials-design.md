# Free-Trial Tracking - Design Spec

Date: 2026-07-29
Status: Approved (owner approved the design direction and set a deploy-ready quality bar; proceeding to plan + build)
Target branch: `feat/free-trials` (off main)
Scope: record a free trial (start + end date) on an enrollment, surface it to the tutor and to admin, and give admin a trials worklist.

## Context

A free trial is a property of a specific enrollment: a student is trialling a specific class.
Enrollments already carry per-enrollment fields (`enrolledAt`, `withdrawnAt`, `deliveryMode`, `adminNotes`) and a per-enrollment admin control pattern: `setDeliveryMode` (`src/app/admin/_lib/actions-enrollments.ts`) is an admin-only server action that updates one column on one `(classId, studentId)` row, wrapped in `withActor` for audit, and surfaced as a control in the class-page enrollments manager (`src/app/admin/classes/[id]/_components/enrollments-manager.tsx`).
Trials fit that exact pattern.

`classes` has no `term_id`; enrollment is a continuous `enrolledAt`/`withdrawnAt` range.
The owner wants the tutor to see whether a student is on a free trial, and (owner-confirmed) trials that pass their end date should persist as a distinct "Trial ended" state until an admin acts, with a dedicated admin trials worklist.

The two automated notifications from the braindump (an alert when a trial student misses a class; an automatic prompt when a trial ends) are [INFRA] - they need a time-based scheduler the app does not have (Next.js has no cron) - and are explicitly out of scope here.
The admin trials view's "ended" bucket is the non-scheduler substitute for the trial-end prompt.

## Goals

Let an admin record a trial start and end date on an enrollment, show tutors an "On trial" / "Trial ended" badge on the students they teach, and give admin a trials worklist (active / ending soon / ended) with convert-to-regular and withdraw actions - all at deploy-ready quality (validated, access-scoped, audited).

## Non-goals

- No automated notifications (missed-class alert, trial-end prompt) - those need a scheduler and are deferred.
- No student-facing or parent-facing trial indicator: trial status is visible to tutors and admins only.
- No change to the enrollment lifecycle itself (enroll/withdraw/delivery-mode) beyond adding the trial fields and one action.
- No billing/payment coupling (a trial is tracking + visibility only).

## Owner decisions (locked)

1. After the end date passes, the enrollment persists as "Trial ended" (distinct from active "On trial") until an admin converts it to a regular enrollment (clears the trial) or withdraws the student.
2. Admin gets a dedicated `/admin/trials` view listing trials grouped active / ending-soon / ended, in addition to setting trial dates on the enrollment.

## Architecture

### Data model

Add two nullable columns to `enrollments`:

- `trial_starts_at date` (nullable)
- `trial_ends_at date` (nullable)

An enrollment is a trial iff `trial_ends_at IS NOT NULL`.
Both dates are set together (a trial always has a start and an end) or both null (not a trial / converted to regular); this is enforced in the action and by a check constraint.
`date` (not `timestamptz`) because a trial window is day-granular; this avoids timezone-of-day ambiguity.

Migration `0030_free_trials.sql` (0028/0029 belong to the held `feat/term-test` branch and are already applied to the live database, so this branch continues at 0030).
Additive: two nullable columns + a check constraint `(trial_starts_at IS NULL) = (trial_ends_at IS NULL)` and `trial_starts_at <= trial_ends_at` when set.
No new tables, so no new RLS policies; `enrollments` RLS is unchanged.

### Derived status (pure, tested)

`deriveTrialStatus(trialStartsAt: string | null, trialEndsAt: string | null, today: string): TrialStatus` where dates are `YYYY-MM-DD` strings compared lexicographically (date-only, timezone-safe):

- `trialEndsAt` null -> `"none"`.
- `today <= trialEndsAt` -> `"on_trial"` (active; includes the last day inclusive).
- `today > trialEndsAt` -> `"trial_ended"`.

Plus a helper `isEndingSoon(trialEndsAt, today, withinDays = 7): boolean` (active and ending within N days) for the admin view's "ending soon" bucket.
Pure functions in `src/lib/trials.ts` with unit tests (boundaries: today == start, today == end, today == end + 1 day, null handling).

### Access and audit (deploy-ready)

- `setTrialDates({ classId, studentId, trialStartsAt, trialEndsAt })` is admin-only (`requireAdmin`), validates both-or-neither and `start <= end` with Zod + explicit checks, and is wrapped in `withActor({ id, role: "admin" }, ...)` for audit, mirroring `setDeliveryMode`.
  Passing both null clears the trial (convert to regular).
- Tutor trial-status reads are scoped to the tutor's own classes: the tutor student/roster/attendance queries already restrict to `classes.tutorId = tutor.id`; trial fields are selected within those existing scoped queries, so a tutor can never see trial status for a student they do not teach.
- Trial status is never selected into any student-facing or parent-facing query.
- `/admin/trials` is admin-only (`requireAdmin`), consistent with the other admin pages.

### Admin surfaces

1. Enrollments manager (class page): a per-student trial control alongside the delivery-mode select - two date inputs (start, end) with a "Set trial" / "Clear" affordance, and the current derived status shown as a pill.
   Calls `setTrialDates`.
2. `/admin/trials` (new): lists every trial enrollment, grouped active / ending-soon / ended, each row showing student, class + subject, tutor, start/end dates, and derived status, with actions: convert to regular (calls `setTrialDates` with nulls), withdraw (existing `withdrawStudent`), and a link to the class.
   Query joins `enrollments` (where `trial_ends_at IS NOT NULL`) to student, class, subject, tutor.

### Tutor visibility

A shared `TrialBadge` (renders nothing for `none`, "On trial" for `on_trial`, "Trial ended" for `trial_ended`) placed on the tutor's student surfaces, fed by `deriveTrialStatus`:

- Class roster: `src/app/tutor/classes/[id]/students/page.tsx`
- Students list: `src/app/tutor/students/page.tsx`
- Student profile: `src/app/tutor/students/[id]/page.tsx`
- Attendance roster: `src/app/tutor/attendance/page.tsx`

Each of these already loads the tutor's students through a `classes.tutorId`-scoped query; the trial fields are added to those selects and passed to the badge.

## Files

Backend:
- `supabase/migrations/0030_free_trials.sql` (new): two columns + check constraint. Applied with `node scripts/apply-sql.mjs`, never `db:push`.
- `src/db/schema.ts` (modify): `enrollments.trialStartsAt`, `enrollments.trialEndsAt`.
- `src/lib/trials.ts` (new): `deriveTrialStatus`, `isEndingSoon`, the `TrialStatus` type.
- `src/lib/trials.test.ts` (new): unit tests.
- `src/app/admin/_lib/actions-enrollments.ts` (modify): add `setTrialDates`.
- `src/app/admin/_lib/queries.ts` (or a focused new query file): `getTrials()` for the admin view; add trial fields to the relevant admin enrollment selects.
- Tutor student queries (wherever the four tutor surfaces load students): add `trialStartsAt`/`trialEndsAt` to the scoped selects.

Frontend:
- `src/app/admin/classes/[id]/_components/enrollments-manager.tsx` (modify): trial control per student.
- `src/app/admin/trials/page.tsx` (new) + `_components/*` (new): the trials worklist + row actions.
- `src/components/tutor/trial-badge.tsx` (new, or colocated): the shared badge.
- The four tutor surfaces (modify): render the badge.
- Admin nav: add a "Trials" entry.

Records:
- `docs/changes/2026-07-29-free-trials.md` (new).
- `docs/checklist.md` (modify): the "Free-trial tracking" row.

## Testing

Pure-logic unit tests only (project convention):
- `deriveTrialStatus`: none (null end), on_trial (today < end, today == end), trial_ended (today == end + 1, today > end); null-start handling.
- `isEndingSoon`: active and within N days true; active but beyond N days false; ended false; not-a-trial false; boundary at exactly N days.

Backend task verification: typecheck, `npm test`, `npm run db:check-rls` green after the migration.
Front-end rows stay 🔶 until owner browser QA.

## Verification (owner browser gate)

- Admin sets a trial start/end on a student in a class; the enrollment shows "On trial"; clearing the dates converts them back to regular.
- The tutor of that class sees the "On trial" badge on the student in the roster, students list, profile, and attendance; a tutor who does not teach the student never sees it.
- Students and parents see no trial indicator anywhere.
- After the end date, the student shows "Trial ended" for the tutor and lands in the admin trials "ended" bucket; convert-to-regular and withdraw both work from `/admin/trials`.
- The admin trials view groups active / ending-soon / ended correctly.
- Validation: an end date before the start date is rejected; setting only one date is rejected.

## Rollout

Single feature branch off main, built with subagent-driven development, merged after the owner browser-approves.
Independent of the held `feat/term-test` branch (touches `enrollments` + admin/tutor surfaces, not `quizzes`); migration numbering (0030) avoids collision with the term-test branch's 0028/0029.
