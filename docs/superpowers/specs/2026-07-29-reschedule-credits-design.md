# Reschedule / Cancellation Credits + Limits - Design

**Date:** 2026-07-29
**Status:** Approved design, proceeding to plan.
**Branch:** `feat/reschedule-credits` (off `main` at `db12c5d`).
**Migration:** 0031 (next free number; live DB already has 0028/0029/0030 applied).
**Depends on:** the 2026-07-10 self-serve reschedule feature (`src/lib/reschedule.ts`, `src/app/_actions/reschedule.ts`) and role-tiers Spec 1 (`student_unrestricted`, `requireUnrestrictedStudent`, `coarseRole`).

This fills the two gaps the 2026-07-10 reschedule design left explicitly out of scope: make-up credits / class tokens, and a per-term cap on reschedule/cancellation count.
It also adds a new self-serve action that did not exist before: cancelling a single lesson occurrence in exchange for a class credit.

## Context and what changes

The shipped self-serve reschedule routes by timing.
Group lessons rescheduled at least 24 hours ahead move directly; everything else (one-on-one always, group under 24 hours, any second reschedule) creates a pending request a tutor or admin must approve (`reschedulePath` in `src/lib/reschedule.ts`).

The owner backlog (`docs/checklist.md` lines 247-249) replaces that timing split with fixed notice windows, per-term caps, and class credits.
This is not purely additive: it reshapes the routing and retires the self-serve approval path (see "Retiring the self-serve approval queue" below).

Owner decisions locked during brainstorming (2026-07-29):

- **Notice windows govern self-serve.** Cancel needs at least 24 hours notice; reschedule needs at least 7 days notice for both group and one-on-one lessons.
- **The "7-day window" is a notice deadline, not a landing constraint.** A reschedule/makeup must be initiated at least 7 days before the original lesson's date. The makeup itself may land in any available same-tutor slot, exactly as today. There is only one 7-day rule (the reschedule notice), not a separate makeup-placement window.
- **Credits redeem self-serve and cap-free.** A credit is granted on cancellation and on a reschedule that finds no slot. It redeems self-serve into a same-subject session/makeup with capacity, expires at term end, and redeeming it does not consume a cap (the cap was charged when the credit was granted).
- **At the cap, self-serve closes; admin is uncapped.** At the cap the self-serve action closes with a "message the office" route. Admin-initiated cancels/reschedules are uncapped and never count against a student's self-serve total.

## Rules

All rules below apply to self-serve actions taken by an `student_unrestricted` student on their own lesson, or by a parent on a linked child's lesson.
Admin-initiated actions (the existing `/admin/users/[id]/reschedule/[lessonId]` one-off tool) are uncapped, ungated, and never counted.

| Action | Notice gate | Per-term cap | On success |
|---|---|---|---|
| Cancel a lesson occurrence | at least 24 hours before the lesson start | 3 per term | mark the student absent on that lesson and grant 1 class credit |
| Reschedule a lesson | at least 7 days before the lesson start (group and one-on-one alike) | 3 per term, counted separately from cancellations | create a makeup lesson at the chosen same-tutor slot; if no slot exists, grant 1 class credit instead |

Failing a notice gate, or hitting a cap, closes self-serve for that action and shows the existing "Message the office" link (`getAdminContact` / `getAdminContactForStudent`).

The term for every rule is the term whose `[startDate, endDate]` range contains the **original lesson's date** (`terms` table).
A lesson whose date falls outside every defined term has no term; self-serve cancel/reschedule is closed for it (message the office), since caps and credit expiry cannot be resolved.

Notice gates are measured from now to `originalLesson.date + startTime` in local time, matching the existing 24-hour convention in `reschedulePath`.
Only upcoming, not-yet-started lessons are eligible, as today.

## Retiring the self-serve approval queue

Under the new rules a self-serve reschedule either passes its gates (at least 7 days notice, under the cap, and a tutor slot exists) and executes directly, or it fails a gate and routes to "Message the office."
No self-serve reschedule produces a pending approval request any more.

Consequences:

- `submitReschedule` stops calling `createRescheduleRequest`. It executes directly via `executeMakeupReschedule` + `recordDirectMakeup` when the gates pass, and returns a closed/"message the office" result otherwise.
- The tutor and admin reschedule-approval queues (`/tutor/reschedules`, `/admin/reschedules`) are no longer fed by self-serve. The pages, the `reschedule_requests` durable audit record, and `approve/reject` server actions stay in place (they still record direct moves with `status = 'approved'`, and admin one-off moves), but the approval UI simply has nothing self-serve to act on.
- The office-mediated escape hatch for under-window or at-cap requests is the existing admin one-off reschedule tool plus the messages thread, not the approval queue.

We deliberately do not delete the approval-queue code in this change (surgical-changes rule); we stop feeding it and note it as dormant.

## Data model

### `class_credits` (new table, migration 0031)

A credit is subject-scoped, granted to one student, redeemable once, and expires at term end.

- `id` uuid primary key
- `studentId` -> `profiles.id` (the student who holds the credit), `on delete cascade`
- `subjectId` -> `subjects.id` (a credit redeems only into the same subject), `on delete cascade`
- `termId` -> `terms.id` (the term the granting lesson fell in; drives expiry and reporting), `on delete cascade`
- `grantReason` enum `cancellation | reschedule_no_slot`
- `grantedFromLessonId` -> `lessons.id`, `on delete set null` (the lesson that was cancelled or could not be rescheduled)
- `grantedById` -> `profiles.id` (the acting student or parent)
- `status` enum `active | redeemed | expired` default `active`
- `redeemedOnLessonId` -> `lessons.id`, `on delete set null` (the makeup lesson the credit was spent on)
- `redeemedById` -> `profiles.id` nullable
- `redeemedAt` timestamptz nullable
- `expiresAt` date (copied from the term's `endDate` at grant time, so expiry is stable even if term dates are later edited)
- `createdAt` timestamptz default now

Expiry is derived lazily at read time, never by a scheduled job: a credit is effectively expired when `today > expiresAt`, regardless of the stored `status`.
The stored `status` moves to `expired` opportunistically (for example, whenever credits for a student are loaded) but correctness never depends on that write having run, mirroring the free-trial `deriveTrialStatus` pattern.

Indexes: `(studentId, status)` and `(termId)`.
RLS: enable row-level security with no client policies (deny-by-default for anon/authenticated); all access is server-side Drizzle as the postgres role, consistent with every other table.

### `lesson_cancellations` (new table, migration 0031)

A durable, auditable record of each self-serve cancellation, and the clean source for the per-term cancellation count.

- `id` uuid primary key
- `lessonId` -> `lessons.id`, `on delete cascade`
- `studentId` -> `profiles.id`, `on delete cascade`
- `cancelledById` -> `profiles.id` (acting student or parent)
- `termId` -> `terms.id`, `on delete cascade`
- `creditId` -> `class_credits.id`, `on delete set null` (the credit this cancellation granted)
- `reason` text nullable
- `createdAt` timestamptz default now

Indexes: `(studentId, termId)`.
RLS: same deny-by-default posture as `class_credits`.

We use a dedicated cancellation table rather than overloading `attendance` (whose `absent` status is also written by reschedules) so the cancellation count is unambiguous and the credit linkage is explicit.

### No schema change to `reschedule_requests`

Successful self-serve reschedules keep being recorded there via `recordDirectMakeup` with `status = 'approved'`, as today.
The per-term reschedule count reads from this table (self-serve rows only) plus `class_credits` rows with `grantReason = 'reschedule_no_slot'`.

## Counting model (pure, unit-tested)

Two independent per-term counters per student:

- **cancellationsUsed(term)** = count of `lesson_cancellations` for this student whose `termId = term`.
- **reschedulesUsed(term)** = count of self-serve `reschedule_requests` for this student whose original lesson falls in `term`, plus count of `class_credits` with `grantReason = 'reschedule_no_slot'` for this student in `term`.

"Self-serve" excludes admin-initiated rows: a `reschedule_requests` row counts only when its `requestedById` resolves to a non-admin profile (the student themselves or a linked parent).
The counting functions are pure over already-fetched rows so they can be unit-tested without a database, matching the project's vitest-only convention.

An action is allowed when `used < 3` for its counter and the notice gate passes.
The remaining allowance (`3 - used`) is surfaced in the UI.

## Execution flows

### Cancel a lesson (new)

1. Resolve the acting student (self or linked child) and confirm ownership of the lesson (`studentOwnsLesson`).
2. Confirm the lesson is upcoming and at least 24 hours away; resolve its term. Fail closed to "message the office" otherwise.
3. Load `cancellationsUsed(term)`; if it is already 3, close to "message the office."
4. In one transaction: mark the student `absent` on the lesson (reuse `markAbsentOnOriginal`), insert a `class_credits` row (`grantReason = 'cancellation'`, `subjectId` from the lesson's class, `expiresAt` from the term end), and insert a `lesson_cancellations` row linking the credit.
5. Notify tutor + linked parents + admin (reuse the notification helper shape).

### Reschedule a lesson (reworked)

1. Resolve student + ownership as today.
2. Confirm the lesson is upcoming and at least 7 days away; resolve its term. Fail closed to "message the office" otherwise.
3. Load `reschedulesUsed(term)`; if it is already 3, close to "message the office."
4. Load the same-tutor availability slots (`getOneOnOneSlots`, unchanged).
   - If at least one slot exists: the picker submits a chosen slot; execute directly via `executeMakeupReschedule` + `recordDirectMakeup`. No approval request is created.
   - If no slot exists: offer "get a class credit instead." On confirm, grant a `class_credits` row (`grantReason = 'reschedule_no_slot'`) and mark the student absent on the original lesson. This still counts as one reschedule for the term (via the credit row).
5. Notify as today.

### Redeem a credit (new)

1. List the holder's `active`, not-yet-expired credits (derived) with their subject and expiry.
2. For a chosen credit, list eligible redemption targets: future same-subject sessions with a spare seat, and/or same-tutor availability slots, reusing the existing seat-count and availability logic.
3. On booking: create/join the makeup (reuse `executeMakeupReschedule` for a one-on-one style slot, or the session-switch primitive for joining an existing group session), set the credit `status = 'redeemed'` with `redeemedOnLessonId`, `redeemedById`, `redeemedAt`.
4. Redemption does not touch either per-term counter.
5. Notify as today.

All three flows are server actions gated by role: the actor must own the lesson/credit (student self, or linked parent); restricted students never reach them.
The action is the real gate; UI affordances only mirror it.

## UI

Student (`student_unrestricted`) and parent surfaces, on the timetable and lesson views that already host the reschedule affordance:

- On an eligible upcoming lesson: a **Cancel** action and a **Reschedule** action, each labelled with the remaining allowance for the term (for example, "2 of 3 reschedules left"). When a gate fails or the cap is hit, that action is replaced by the "Message the office" link.
- A **class-credit** area: current active credits (subject + expiry), and a **redeem** flow that opens the target picker. Expired/redeemed credits are not shown as actionable.
- Restricted students never mount any of this (unchanged).

The UI work follows the `ui-ux-pro-max` ruleset: allowance and gate states use clear text and semantic color (not color alone), the primary action per card stays singular, and the credit balance reads as a calm status, not a loud promotion.

## Admin visibility (money implication)

Because credits carry monetary value, admins must see them.

- The admin reschedule area and/or the per-user admin view surfaces: credits granted (with reason and source lesson), credits redeemed (with target lesson), credits expired, and each student's per-term cancellation/reschedule usage.
- This is read-only reporting in this change; admin granting/revoking of credits by hand is out of scope (see below).

## Testing

- Pure logic covered by vitest: term resolution from a date, the 24-hour and 7-day notice gates, both per-term counters (including admin-exclusion), and `deriveCreditStatus(status, expiresAt, today)` across active/redeemed/expired and the expiry boundary.
- Execution/DB paths (cancel, reschedule rework, redeem) verified by typecheck, `db:check-rls`, the full test suite, and a clean production build.
- The real acceptance gate is owner browser QA across student, parent, tutor, and admin, since there is no automated render/DB harness in this project.

## Out of scope

- Admin manual grant/revoke of credits (only automatic grants in this change).
- Any scheduled job: credit expiry is lazy-derived, and no reminder notifications are sent (those are the separate `[INFRA]` backlog items).
- Refund-on-quit after term start (`docs/checklist.md` line 238) - a different flow.
- Deleting the dormant reschedule-approval-queue code.
- Native device push (in-app notifications only).

## Rollout

One cohesive subsystem, one implementation plan, phased so each phase is independently testable: credits table + pure logic, then the cancellation action, then the reschedule rework, then redemption, then the student/parent UI, then admin visibility, then docs + checklist.
Merge is held for owner browser QA, consistent with the other in-flight branches.
