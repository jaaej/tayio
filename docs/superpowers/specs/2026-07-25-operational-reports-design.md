# Operational Reports v1 - Design Spec

Date: 2026-07-25
Status: Approved (pending spec review)
Sub-project: A of 3 in the `/admin/reports` decomposition (Operational, Financial, Student).

## Context

`/admin/reports` is currently a stub (`src/app/admin/reports/page.tsx`) that renders a "Coming in Phase 3" placeholder with greyed-out `-` tiles and a static list of planned reports.
No data is queried.

The broader reporting work was decomposed into three independent sub-projects on 2026-07-25 (see the "Reporting to parents/tutors" row in `docs/checklist.md`).
This spec covers only sub-project A: Operational reports.
Financial and Student reports are out of scope here and get their own specs.

## Problem

The admin has no at-a-glance view of how the operation is running.
"Is attendance slipping? Are classes filling? Which class has a homework problem?" can only be answered today by manually inspecting individual pages.

## Goals

Give the admin a single term-scoped operational dashboard that answers "which classes are healthy and which need attention" from live data, with no manual entry.

## Non-goals (explicitly out of scope for v1)

- Per-student drill-down or any named-student performance (that is the Student reports sub-project).
- Financial figures of any kind (revenue, overdue) - that is the Financial reports sub-project and stays behind the `/admin/revenue` PIN gate.
- Students-at-risk composite flag (needs an owner-defined threshold rule; deferred).
- Tutor workload and tutor-note-completion metrics (nice-to-know, deferred).
- Scheduled or emailed report delivery (no cron, no email in v1).

## Audience and gating

Admin-only.
No PIN gate: every metric here is operational or academic, not financial, and admins already see all of it.
Access is guarded by `requireAdmin` at the query layer, consistent with the rest of `/admin`.

## Meaning of "automated"

The page computes itself from live data on each request.
Opening the page or changing the selected term re-runs the aggregate queries against current data.
There are no snapshot tables, no scheduled jobs, and no emailing in v1.

## Period model

Term-based.
A term selector (dropdown) defaults to the current term and is driven by a `?term=<termId>` URL query param so a given term's report is bookmarkable and shareable.
The `terms` table already exists (`src/db/schema.ts`), so no schema work is needed for term grouping.

Attendance and homework metrics are computed over the selected term's date range.
Fill is a current snapshot and is not affected by the selected term (documented in the UI).

## Page structure

Route: `/admin/reports` (replaces the stub).

1. Term selector - dropdown, default current term, `?term=` param.
2. Three rollup tiles (org-wide, selected term): Attendance %, Homework completion %, Fill %.
3. One per-class table, one row per active class, sortable, columns:
   - Class
   - Tutor
   - Attendance %
   - Homework completion %
   - Avg test result
   - Enrolled / Capacity

## Exact metric definitions

These definitions are the contract; the implementation must match them exactly.

### Attendance %

`attended / marked`, where:

- `attended` = attendance rows with status in (`present`, `late`, `left_early`, `makeup_attended`).
- `marked` = attendance rows with any of the above statuses OR `absent`.
- Lessons with no attendance row (unmarked or future) are excluded from both numerator and denominator, so early-term reports are not dragged down by lessons that have not happened yet.
- Decision A (recorded): `late`, `left_early`, and `makeup_attended` all count as attended.
- Scope: attendance rows for lessons belonging to the class, dated within the selected term.
- A class with zero marked lessons shows `-`.

### Homework completion %

`completed / assigned`, where:

- The denominator is homework assignments for homework whose `dueDate` falls within the selected term.
- `completed` = assignments with status in (`submitted`, `late`, `marked`, `returned`) - i.e. the work was handed in.
- The open set (`not_started`, `viewed`, `resubmission_requested`) counts as not completed.
- This split matches how the student dashboard already classifies open vs done work (`src/app/student/page.tsx` open-homework filter), so the report agrees with what students see.
- A class with zero homework due in the term shows `-`.

### Fill %

`active enrolments / capacity`, a current snapshot:

- `active enrolments` = enrolment rows for the class with `withdrawnAt` null.
- `capacity` = the class capacity.
- Not period-based; reflects the roster right now regardless of selected term.

### Avg test result

`AVG(score)` over marked test homework for the class's students, in-term:

- Only `homework.is_test = true`, only assignments that are marked (`score` not null).
- Scoped to homework due within the selected term.
- A class with no marked tests in the term shows `-`.

## Known data caveat: scores have no maximum

`homework_assignments.score` is `numeric(5,2)` with no accompanying max/out-of field on `homework`.
Averaging is therefore only meaningful if tutors enter scores on a consistent scale.
The app already makes this same assumption: the existing ranking feature (`getStudentOverallSubjectRank`) averages test scores as if they are comparable percentages.
The Avg test result column relies on that same convention and introduces no new assumption.
A future improvement would add a `max_score` (or store percentages) to `homework`; that is out of scope here.

## Data and code layout

- New module `src/app/admin/_lib/reports-queries.ts`, `server-only`, using Drizzle, guarded by `requireAdmin`.
- One query per metric family, each returning both the org-wide rollup and the per-class breakdown, or a single query returning per-class rows that the page rolls up.
- Follows the existing patterns in `src/app/admin/_lib/queries.ts`.
- No new tables and no migration.

## UI

Reuses the admin UI kit (`Card`, `CardHead`, `StatTile`, `PageHeader`, `Pill`) from `src/components/admin/ui`.
No new design system.
The per-class table is a standard admin table; the tiles reuse `StatTile`.
The table and tiles are run through the `ui-ux-pro-max` ruleset before implementation, per the project UI mandate.
Empty states: a term with no classes shows a friendly empty state rather than an empty table.

## CSV export

Decision B (recorded): included in v1.
A "Download CSV" action exports the per-class table for the selected term (same columns, `-` rendered as empty cells).
This directly serves the PRD "reporting to parents/tutors" framing.
Implementation: a server route or server action that streams the CSV; no third-party library.

## Verification

Success criteria and how each is checked:

- Seed or use existing data for a known term.
- Compute each metric by hand for one class and confirm the page matches.
- Confirm a class with no marked lessons / no homework / no tests shows `-`, not `0%` or a crash.
- Confirm switching the term via the dropdown updates all figures and the `?term=` param.
- Confirm Fill ignores the term (snapshot) while Attendance/Homework respect it.
- Confirm the CSV download opens with the same numbers as the table.
- Confirm a non-admin cannot reach the queries (guarded by `requireAdmin`).

## Rollout

Single change: replace the stub page, add the queries module, add the CSV export.
Update the "Reporting to parents/tutors" checklist row to reflect Operational shipped (and that Financial + Student remain).
No migration, no data backfill, no config.
