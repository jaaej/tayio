# Reschedule and Cancellation Credits

Date: 2026-07-29 (built 2026-07-30)
Branch: `feat/reschedule-credits`
Migration: `supabase/migrations/0031_reschedule_credits.sql`, applied to the live DB.
Status: Code, migration, automated tests, typecheck, production build, and RLS audit complete.
Browser verification by the owner is still pending across all four roles - see the checklist at the bottom.

## What shipped

This closes the two gaps the 2026-07-10 self-serve reschedule feature left open: make-up credits and a per-term cap on reschedule/cancellation counts.
It also adds a self-serve action that did not exist before - cancelling a single lesson occurrence in exchange for a class credit.

Two new tables, both created in migration 0031 with RLS enabled and no client policies (server-side Drizzle only, same deny-by-default posture as `reschedule_requests`):

- `class_credits` - a student- and subject-scoped credit, `status` `active | redeemed | expired`, `grantReason` `cancellation | reschedule_no_slot`, `expiresAt` copied from the granting term's end date at grant time.
- `lesson_cancellations` - a durable audit row per self-serve cancellation, and the source of truth for the per-term cancellation count.

Pure, unit-tested logic lives in `src/lib/reschedule-credits.ts` and has no database import:

- `resolveTerm(dateIso, terms)` - the term whose `[startDate, endDate]` range contains a lesson's date, or null.
- `meetsCancelNotice` / `meetsRescheduleNotice` - the 24-hour and 7-day notice gates.
- `remaining(cap, used)` - the surfaced allowance, never negative.
- `deriveCreditStatus(stored, expiresAt, today)` - lazy expiry (see below).
- Constants: `CANCEL_NOTICE_HOURS = 24`, `RESCHEDULE_NOTICE_DAYS = 7`, `CANCEL_CAP = 3`, `RESCHEDULE_CAP = 3`.

The server layer (`src/lib/credits.ts`) adds `getTerms`, `getCancellationsUsed`, `getReschedulesUsed`, `grantCredit`, `cancelLesson`, `listRedeemableCredits`, `getRedemptionSlots`, and `redeemCreditIntoSlot`.
`getReschedulesUsed` counts self-serve approved reschedules in the term plus `reschedule_no_slot` credits; admin-initiated reschedules are excluded from every count.

### Rules (owner-confirmed 2026-07-29)

| Action | Notice gate | Per-term cap | On success |
|---|---|---|---|
| Cancel a lesson occurrence | at least 24 hours before the lesson start | 3 per term | mark the student absent and grant 1 class credit |
| Reschedule a lesson | at least 7 days before the lesson start (group and one-on-one alike) | 3 per term, counted separately from cancellations | move to the chosen same-tutor slot, or grant 1 class credit if no slot exists |

The 7-day figure is a notice deadline, not a landing-window constraint: a reschedule must be initiated at least 7 days before the original lesson, but the makeup itself can land in any available same-tutor slot, exactly as before this change.
Credits redeem self-serve, are cap-free (the cap was charged when the credit was granted, not when it is spent), and expire at the end of the granting term.
At the cap, or when a notice gate fails, self-serve closes and the existing "Message the office" link takes over; admin-initiated cancels/reschedules (the one-off tool at `/admin/users/[id]/reschedule/[lessonId]`) remain uncapped and are never counted.

### Actions and UI

- `submitReschedule` in `src/app/_actions/reschedule.ts` was reworked to the 7-day/cap model and now executes a passing reschedule directly (no approval step).
  It guards against rescheduling a lesson that was already cancelled.
- `grantRescheduleCredit` (new, same file) grants a `reschedule_no_slot` credit when the notice and cap gates pass but no same-tutor slot exists.
- `src/app/_actions/credits.ts` adds `cancelLesson`, `redeemCredit`, and `loadCreditRedemption`.
- Student UI: `src/app/student/timetable/page.tsx` and `src/app/student/_components/interactive-timetable.tsx` show Cancel and Reschedule actions labelled with the remaining allowance (for example "2 of 3 left"), a "Get a class credit instead" action in the no-slot state, and office-routing when a gate fails or the cap is hit.
- Parent UI: `src/app/parent/classes/reschedule/[lessonId]/page.tsx` and `src/components/reschedule/reschedule-form.tsx` mirror the same flow per linked child; `src/app/parent/classes/page.tsx` hosts the entry points and the child switcher.
- Shared redemption: `src/components/reschedule/credit-panel.tsx`, mounted on both `/student/timetable` and `/parent/classes`, lists active credits and redeems one into a same-tutor slot.
- Admin: `src/app/admin/reschedules/page.tsx` plus `getCreditsOverview` in `src/app/admin/_lib/queries.ts` add a read-only "Class credits" and "This term's usage" view; the credit list surfaces a "300+" label instead of silently truncating once a student passes the internal display cap.

## Retired: the self-serve reschedule approval queue

Before this change, a self-serve reschedule either moved directly (group lessons, at least 24 hours ahead) or created a pending request that a tutor or admin had to approve (one-on-one lessons always, group lessons under 24 hours, or any second reschedule).
Under the new rules, a self-serve reschedule either passes its gates (7-day notice, under the cap, and a slot exists) and executes directly, or it fails a gate and routes to "Message the office."
No self-serve reschedule produces a pending approval request any more.

We deliberately did not delete the approval-queue *logic* (surgical-changes rule; this is a routing change, not a removal of a subsystem).
`reschedulePath`, `hasPriorReschedule`, `createRescheduleRequest`, `listPendingRequests`, `approveRescheduleRequest`, `rejectRescheduleRequest`, and `RescheduleRequestList` stay exported but are now dormant - nothing calls `createRescheduleRequest`, so no code path ever writes a `status: 'pending'` row again.

Correction (2026-07-31, found during browser QA): an earlier draft of this section claimed the admin one-off reschedule "keeps feeding" the approval queue. That is wrong.
The admin one-off tool (`src/app/admin/_lib/actions-reschedule.ts`) books the make-up **directly** - it inserts a `makeup` lesson, the two attendance rows, and a notification, and never touches `reschedule_requests`.
So with self-serve executing directly and the admin one-off executing directly, **nothing** creates a pending request, and the approval queue is permanently empty.
Because of that, the now-dead `/tutor/reschedules` page and its nav item (tutor shell + shared portal shell) were removed on 2026-07-31.
The `/admin/reschedules` page stays - it also hosts the read-only Class-credits and This-term's-usage views - but no longer renders the always-empty pending list and is retitled "Reschedule credits".
The office-mediated escape hatch for a gated or capped student is the admin one-off reschedule tool plus the existing messages thread, not an approval queue.

## Lazy expiry, no scheduler

A credit's stored `status` can lag reality: `deriveCreditStatus(stored, expiresAt, today)` treats a credit as `expired` the moment `today > expiresAt`, regardless of what is written in the row, and treats `redeemed` as terminal.
Every read path (the redemption list, the admin overview) applies this derivation, so correctness never depends on a background job having run.
The stored `status` column is updated opportunistically wherever credits are loaded, purely to keep future queries and reporting cheap, but no scheduled job exists and none is required.
This mirrors the existing `deriveTrialStatus` pattern used for free-trial students.

## Browser-QA checklist

The backend flows and the data that drives every UI state are verified autonomously (2026-07-30): a headless harness drove the real cancel, redeem, per-term-cap, and double-benefit-guard code against the database and asserted every outcome (credit granted, absent marked, cancellation recorded, cap decremented, make-up booked, credit burned, second-credit and double-redeem blocked, cross-student access blocked).
Everything else above this section is machine-verified (tests, typecheck, build, `db:check-rls`).
The items below are the remaining visual and interaction gate - what only a real browser render confirms.
Tick each box after clicking through it as the signed-in role.

### Student menu interaction (`student_unrestricted`, `/student/timetable`)

- [x] Click any lesson - past, current, or future - and confirm the action menu opens (a past lesson opens it the same as an upcoming one). (owner-verified 2026-07-30)
- [x] On a lesson you cannot act on, confirm Reschedule and Cancel show greyed-out with a short reason ("Passed", "Needs 7 days notice", "Needs 24 hours notice", "Already moved", "No reschedules left this term"), rather than being hidden. (owner-verified 2026-07-30)
- [x] Confirm the menu closes when you click anywhere outside it and when you press Escape, not only via the Close button. (owner-verified 2026-07-30)

### Student flows (navigate to the month holding the upcoming test lessons)

- [x] Reschedule a lesson at least 7 days out into an available slot and confirm the chip moves with no approval or pending state, and the Reschedule label reads "N of 3 left" and decrements. (owner-verified 2026-07-30)
- [x] Cancel a lesson at least 24 hours out and confirm the chip turns red with the time and subject struck through and a single "Cancelled" tag, and that opening its menu shows one red "Cancelled" line - not "Reschedule - Cancelled" plus "Cancel - Cancelled". (owner-verified 2026-07-30)
- [x] Reschedule a lesson with no available slot (ask the builder to clear the tutor's availability) and confirm the "Get a class credit instead" action appears. (owner-verified 2026-07-31; Aug 8 lesson -> "Get a class credit instead" granted a reschedule_no_slot credit, chip went grey + struck "Converted to class credit"; tutor availability cleared for the test then restored)
- [x] Open the credit panel, redeem an active credit into a slot, and confirm it books the make-up and the credit leaves the active list. (owner-verified 2026-07-31; redeemed a cancellation-derived credit into the Aug 6 slot - makeup booked, credit flipped active -> redeemed, "Make-up: booked with credits" label)
- [x] Reach the cancel cap (3 in a term) and the reschedule cap (3 in a term) and confirm each action then closes to "Message the office". (owner-verified 2026-07-31; reschedule cap exercised: usage 3/3 -> menu showed greyed "Reschedule - No reschedules left this term" + "Message the office" link. Cancel-to-cap not exercised in data (usage stayed 1/3), but the cancel row renders through the identical office-routing code path - `showOfficeLink` fires when either action is unavailable.)

### Parent (`/parent/classes`, per linked child)

- [x] Repeat the cancel, reschedule, no-slot-credit, and redeem visual checks for one linked child, and confirm the allowance labels read correctly. (owner-verified 2026-07-31; Pat's child Sarah - cancel + reschedule + redeem all worked, labels read correctly)
- [x] On a parent with two or more children, switch children and confirm each child's allowances, credits, and cancelled/greyed states are independent with no cross-child bleed. (owner-verified 2026-07-31; Sarah had 1 cancel/1 reschedule/1 redeemed credit while Noah stayed 0/0/0 - no cross-child bleed)

### Tutor (`/tutor/reschedules`)

- [x] Confirm no new self-serve entries appear in the reschedule queue after a student self-serve reschedule or cancel. (verified in data 2026-07-31; self-serve writes `approved` reschedule rows / no row for cancels, and `listPendingRequests` is pending-only - 2 approved self-serve reschedules exist, 0 pending, so the queue is empty of self-serve entries)
- [x] Confirm an admin-initiated one-off reschedule still appears in the queue. (resolved 2026-07-31 - premise was wrong: the admin one-off books the make-up directly (inserts a `makeup` lesson + attendance + notification, no `reschedule_requests` row), and `createRescheduleRequest` (the only writer of `status: 'pending'`) has zero callers. So nothing creates pending requests anymore and the approval queue is permanently empty. Owner decision: removed the dead `/tutor/reschedules` page + its nav item (tutor + portal shells); the `/admin/reschedules` page keeps its Class-credits and This-term's-usage views but no longer renders the always-empty pending list, and is retitled "Reschedule credits".)

### Admin (`/admin/reschedules`)

- [x] Confirm the "Class credits" section lists granted, redeemed, and expired credits with reason and source or target lesson. (owner-verified 2026-07-31)
- [x] Confirm the "This term's usage" table shows each student's per-term cancellation and reschedule counts. (owner-verified 2026-07-31)
- [x] Confirm the admin one-off reschedule tool (`/admin/users/[id]/reschedule/[lessonId]`) still works uncapped and is not counted in the student's self-serve totals. (owner-verified 2026-07-31)

## Session follow-ups and QA state (2026-07-31)

Branch `feat/reschedule-credits` is HELD (not merged) pending owner browser QA and the deferred fixes below.
Migrations 0031 and 0032 are applied to the live DB.

Browser-QA passed (owner-verified): M1-M3 (menu opens on any lesson; greyed-with-reason; click-outside/Escape dismiss), F1-F2 (reschedule into a slot; cancel goes red + struck "Cancelled"), F3 (no-slot -> "Get a class credit instead" -> grey struck "Converted to class credit"), F4 (redeem a credit via the calendar overlay - makeup booked, credit consumed, "booked with credits" label), A1-A4 (admin Class-credits view, This-term's-usage, one-off reschedule uncapped/uncounted).
Browser-QA passed (cont.): F5 (reschedule cap -> office routing; cancel-cap shares the code path, not separately exercised in data), P1-P2 (parent flow on Sarah + Sarah/Noah independence), T1 (verified in data - self-serve never creates pending rows).
Browser-QA resolved (not a browser check): T2 - the approval queue is now permanently empty (nothing creates pending requests), so the dead tutor queue page + nav were removed and the admin page's empty pending list was dropped. See the "Retired" section correction.
Browser-QA passed (cont. 2026-08-01): AC1-AC6 (admin grant credit / grant +reschedule / grant +cancellation / activity list / undo reschedule / undo cancellation incl. the redeemed-block, and the full redemption -> cancellation undo chain via the new "Undo redemption"). All browser QA groups (M/F/P/T/A/AC) now owner-verified.

Built during QA (2026-08-01): admin "Undo redemption".
The blocked-cancellation message ("undo the redemption first") was previously a dead-end - the make-up a redeemed credit paid for was not shown anywhere and there was no action to undo it.
`getStudentActivity` now resolves the redemption make-up (via `class_credits.redeemed_on_lesson_id`) and attaches it to the cancellation as `redemption`, and a new `undoRedemption(creditId)` server action (in `src/lib/admin-credits.ts` + `actions-credits.ts`) reverses exactly what `redeemCreditIntoSlot` created: it flips the credit back to active (guarded on it still being redeemed onto that same make-up), pulls the student's attendance off the make-up, and deletes the make-up lesson only when no other student is on it.
The admin profile's activity card now renders the redemption grouped under the blocked cancellation with an "Undo redemption" button; undoing it frees the credit, after which the cancellation's own Undo enables.
This closes the AC6 chain end-to-end. `tsc` clean; data path verified read-only against the live DB (not mutated, so the owner can still click through AC6).

Bug fixed during QA (2026-07-31): `/parent/classes` 500'd - the parent page passed `homeworkHref={() => ...}` (a function) into the client `InteractiveTimetable`, which RSC cannot serialize (the student route never passed it, so the crash only surfaced on the parent route after the timetable port). Fixed by making the homework link serializable data: `TimetableHw` gained a precomputed `href` field (student `/student/homework/{id}`, parent `/parent/homework?child={childId}`), and the `homeworkHref` function prop was removed. tsc clean.

UI adjustments shipped during QA: full-page menu on any lesson with greyed-out-with-reason unavailable actions; dismiss on outside-click/Escape; cancelled lessons red + struck "Cancelled"; no-slot-credit lessons grey + struck "Converted to class credit"; allowance labels show "N left" (no "of X" denominator); redeem credits via the same calendar overlay as reschedule; make-up labels "Make-up: from ..." vs "Make-up: booked with credits"; notifications inbox full-width for all four roles; admin one-off reschedule fixed (HH:MM:SS slot parse + double-booking guard + Taken-slot greying + full-width); admin upcoming-lessons excludes past + rescheduled-out lessons; parent timetable/reschedule now uses the shared student InteractiveTimetable per child; already-booked slots shown "Taken" (greyed/struck) in student/parent/admin pickers.

Done 2026-08-01: audit-log coverage on the admin credit/reschedule actions.
The trigger-based audit (migration 0006) covers profiles/enrollments/invoices/etc but not lessons/credits/cancellations/reschedule_requests/allowance_adjustments, so the admin undo + grant actions were writing no audit trail.
`src/lib/admin-credits.ts` now writes one explicit `audit_logs` row per action via a `logAdminAudit` helper: `admin_undo_reschedule`, `admin_undo_cancellation`, `admin_undo_redemption` (each inside the action's transaction, so it rolls back with the action), plus `admin_grant_credit` and `admin_grant_allowance` (after the write). Each row carries the admin `actorId`, `actorRole: "admin"`, and the relevant old/new ids. No migration - `audit_logs` already existed; verified the app connection can insert (RLS does not block server-side writes). tsc clean, 55 tests pass.

Deferred pre-merge follow-ups (none block QA):
- undoReschedule: add a FOR UPDATE lock on the make-up lesson's attendee check (narrow race; group-switch is dormant).
- undoCancellation: a concurrent double-undo shows "already used" instead of "not found" (cosmetic).
- Dormant parent per-lesson reschedule page (/parent/classes/reschedule/[lessonId] + reschedule-form.tsx) still shows hardcoded "of 3" cap strings (unlinked after the parent-timetable port; the live parent timetable is fixed).
- Admin-granted credit (null origin lesson) redemption resolves tutors from the student's active same-subject enrolment - needs QA on a multi-tutor subject.
- No-slot reschedule credits (grantRescheduleCredit) are intentionally not in the undo surface.
- Reviewer architectural note: relocate the shared InteractiveTimetable out of the student portal's _components into a shared location (src/components/timetable/) - the parent currently imports across portals.
- Group-session capacity booking for reschedule is out of scope (self-serve reschedule is tutor-time-slot based).

Other held sibling branches awaiting QA/merge: feat/term-test, feat/free-trials, feat/curriculum-restyle, feat/operational-reports. Security-checklist row numbering (A14/A15) will collide across branches at merge - renumber then.
