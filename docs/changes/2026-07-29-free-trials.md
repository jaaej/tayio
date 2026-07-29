# Free-Trial Tracking

Date: 2026-07-29
Branch: `feat/free-trials`
Status: All 6 tasks code-complete and reviewed.
Machine-verified (migration, RLS audit, typecheck, unit tests, production build).
Manual browser verification by the owner remains pending before merge.

## Requested outcomes

- Record a free-trial start and end date on a specific enrollment.
- Show the tutor whether a student they teach is on a free trial, or the trial has ended.
- Give admin a dedicated worklist of every trial, grouped active / ending-soon / ended, with convert-to-regular and withdraw actions.
- Keep trial status admin- and tutor-facing only; students and parents must never see it.
- Defer the two automated notifications from the original braindump (missed-class alert, trial-end prompt) as [INFRA], since the app has no scheduler.

## Data model

Migration `0030_free_trials.sql` adds two nullable columns to `enrollments`: `trial_starts_at date` and `trial_ends_at date`.
An enrollment is a trial if and only if `trial_ends_at is not null`.
A check constraint, `enrollments_trial_shape`, enforces that both columns are null together or both set together, and that `trial_starts_at <= trial_ends_at` when set.
`date` was chosen over `timestamptz` because a trial window is day-granular; this avoids timezone-of-day ambiguity when comparing "today" against the end date.
The migration is additive only: no new tables, no RLS changes (`enrollments` keeps its existing 4 policies), and existing rows (both columns null) already satisfy the constraint.
0028/0029 belong to the held `feat/term-test` branch and are already applied to the live database, so this branch continues at 0030.
Applied to the connected Supabase database with `node scripts/apply-sql.mjs supabase/migrations/0030_free_trials.sql`.
`src/db/schema.ts` mirrors the two columns as `enrollments.trialStartsAt` / `enrollments.trialEndsAt`.

## Derived status (pure, tested)

`src/lib/trials.ts` exports `deriveTrialStatus(trialStartsAt, trialEndsAt, today): "none" | "on_trial" | "trial_ended"` and `isEndingSoon(trialEndsAt, today, withinDays = 7): boolean`.
Dates are compared as `YYYY-MM-DD` strings, which is timezone-safe and avoids any `Date` object arithmetic.
A null `trialEndsAt` is `"none"`; `today <= trialEndsAt` is `"on_trial"` (the end date itself counts as still on trial); anything after is `"trial_ended"`.
Both functions are pure, with no database or I/O access, so every caller supplies `today` explicitly rather than the function calling `new Date()` itself - this keeps server components deterministic and avoids hydration drift in any client component that reuses them.
`src/lib/trials.test.ts` covers both functions with 9 unit tests: the null/none case, the boundary at exactly the end date, the day after the end date, and the `isEndingSoon` window boundary.
All 9 tests pass.

## Access and audit

`setTrialDates({ classId, studentId, trialStartsAt, trialEndsAt })` in `src/app/admin/_lib/actions-enrollments.ts` is the only way to write these columns.
It mirrors the existing `setDeliveryMode` action exactly: `requireAdmin()` first, a Zod schema for shape (UUIDs, `YYYY-MM-DD` dates), explicit both-or-neither and start-<=-end checks that return `{ ok: false, error }` rather than throwing, and the update itself wrapped in `withActor({ id: user.id, role: "admin" }, ...)` for audit attribution.
Passing both dates as null clears the trial, which is how "convert to regular" is implemented - it calls the same action with nulls rather than a separate code path.
`getTrials()` in `src/app/admin/_lib/queries.ts` returns every enrollment where `trial_ends_at is not null` and the student has not been withdrawn, joined to student, class, subject, and tutor names, ordered by `trial_ends_at` ascending.
It returns raw dates only; grouping and status are computed by the pure helpers on the admin page, not in SQL.

Trial visibility on the tutor side never widens query scope.
The four tutor-facing reads that gained trial fields - `getTutorStudents`, `getStudentProfile`, `getLessonForTutor`'s roster select, and the class-roster page query - were all already scoped to `classes.tutorId = tutor.id` (directly or via `getTutorClassIds`) before this feature, and the new columns were added inside those existing scoped selects.
No student-facing or parent-facing query was opened or modified; `git diff --stat` across the whole branch confirms zero files under `src/app/student/` or `src/app/parent/`.

## Admin surfaces

The class-page enrollments manager (`src/app/admin/classes/[id]/_components/enrollments-manager.tsx`) gained a per-student trial control alongside the existing delivery-mode select: two date inputs, a "Set trial" action, a conditional "Clear" action, and the derived status shown as a pill.
`/admin/trials` (`src/app/admin/trials/page.tsx`) is a new admin-only page listing every trial, split into an Active group (ending-soonest first) and an Ended group (most-recently-ended first), with row actions in `src/app/admin/trials/_components/trial-actions.tsx`: convert to regular (`setTrialDates` with both dates null), withdraw (the existing `withdrawStudent` action), and a link to the class.
Both destructive-ish actions (convert, withdraw) confirm before firing, since they act on a worklist rather than the class page the admin is already looking at; the class-page "Set trial" / "Clear" controls do not confirm, matching the un-confirmed delivery-mode select already on that same page.
A "Trials" entry was added to the admin nav in `src/components/admin/shell.tsx`.

## Tutor visibility

A shared `TrialBadge` (`src/components/tutor/trial-badge.tsx`) renders nothing for `"none"`, an "On trial" pill for `on_trial`, and a "Trial ended" pill for `trial_ended`, reusing the existing `Pill` component's `info`/`warn` tones rather than introducing any new color, radius, or shadow token.
It is placed on four tutor pages, each of which already loaded the relevant students through a `classes.tutorId`-scoped query: `/tutor/students`, `/tutor/students/[id]`, `/tutor/classes/[id]/students`, and `/tutor/lessons/[id]`'s per-student attendance roster.
`/tutor/lessons/[id]` was substituted for `/tutor/attendance` from the original file list: `/tutor/attendance` renders one row per lesson with aggregate counts and has no per-student rows or trial fields at all, while `/tutor/lessons/[id]` is the actual per-student roster page reached from both `/tutor/attendance` and the class-roster page, and its roster already carried the trial columns from the query-layer task.
This is documented in `.superpowers/sdd/2026-07-29-free-trials/task-5-report.md` for anyone auditing the file-list deviation.

## Deferred [INFRA]

Two automated notifications from the original braindump were explicitly out of scope for this branch: an alert when a trial student misses a class, and an automatic prompt when a trial ends.
Both need a time-based scheduler, and this application has no cron or scheduled-job runtime.
The `/admin/trials` "ended" bucket is the non-scheduler substitute for the trial-end prompt: instead of an automated notification, admin sees every ended trial surfaced in a dedicated worklist and can act on it (convert or withdraw) without waiting for a message.
The missed-class alert has no substitute yet and remains fully unbuilt.

## Files changed

### Data and schema

- `supabase/migrations/0030_free_trials.sql`
- `src/db/schema.ts`

### Trial status logic

- `src/lib/trials.ts`
- `src/lib/trials.test.ts`

### Admin actions and queries

- `src/app/admin/_lib/actions-enrollments.ts`
- `src/app/admin/_lib/queries.ts`

### Admin UI

- `src/app/admin/classes/[id]/page.tsx`
- `src/app/admin/classes/[id]/_components/enrollments-manager.tsx`
- `src/app/admin/trials/page.tsx`
- `src/app/admin/trials/_components/trial-actions.tsx`
- `src/components/admin/shell.tsx`

### Tutor queries and UI

- `src/app/tutor/_data.ts`
- `src/app/tutor/classes/[id]/students/page.tsx`
- `src/app/tutor/students/page.tsx`
- `src/app/tutor/students/[id]/page.tsx`
- `src/app/tutor/lessons/[id]/page.tsx`
- `src/components/tutor/trial-badge.tsx`

### Project records

- `docs/checklist.md`
- `docs/superpowers/specs/2026-07-29-free-trials-design.md`
- `docs/superpowers/plans/2026-07-29-free-trials.md`
- `docs/changes/2026-07-29-free-trials.md`

This list covers the code, schema, and record files for the feature; it is not a byte-for-byte reproduction of `git diff --stat`.

## Migration and data impact

Migration 0030 was applied successfully to the connected Supabase database.
It added two nullable columns and one check constraint to `enrollments`; it did not delete or rewrite any existing enrollment, class, student, or payment data.
Every pre-existing enrollment row already has both new columns null, which satisfies the check constraint without a backfill.
No RLS policy was added, removed, or changed; `enrollments` keeps its existing 4 policies.

## Verification evidence

- `node scripts/apply-sql.mjs supabase/migrations/0030_free_trials.sql` applied cleanly to the connected database.
- `npm run db:check-rls` passed for all public tables, `enrollments` unchanged at 4 policies.
- `npm run typecheck` passed with zero diagnostics.
- `npm test` passed, including the 9 new tests in `src/lib/trials.test.ts`.
- `npm run build` completed with exit code 0; `/admin/trials` compiled as a dynamic route alongside the modified admin and tutor routes.
- `git diff --stat` across the whole branch confirms no file under `src/app/student/` or `src/app/parent/` was touched.
- The new free-trial code (every line this feature added, across all touched files) was grepped for the em dash character and contains none.
- Several pre-existing em dashes remain in files this branch touched, predating this branch: `src/app/admin/_lib/queries.ts`, `src/app/tutor/_data.ts`, `src/app/tutor/lessons/[id]/page.tsx`, `src/app/tutor/students/[id]/page.tsx`, `src/app/tutor/classes/[id]/students/page.tsx`, `src/components/admin/shell.tsx`, and `src/db/schema.ts`.
- One pre-existing em dash inside `enrollments-manager.tsx` (an "Add a student" placeholder string, not something this feature introduced) was fixed in the Task 4 fix pass because that file was already in that task's diff; the rest were left alone as out of scope for this feature and are flagged here for a separate cleanup pass.

## Manual verification still required

No claim is made that the admin trial control, the `/admin/trials` worklist, or the tutor badges have been clicked through in a browser with real data.
The exact outstanding browser checks - setting and clearing a trial from the class page, working the active/ending-soon/ended groups on `/admin/trials`, confirming the tutor badge renders correctly on all four surfaces, and confirming no trial indicator ever reaches a student or parent view - are recorded in `docs/checklist.md`.
