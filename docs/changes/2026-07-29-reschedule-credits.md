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

We deliberately did not delete the approval-queue code (surgical-changes rule; this is a routing change, not a removal of a subsystem).
`reschedulePath`, `hasPriorReschedule`, and `createRescheduleRequest` stay exported from `src/lib/reschedule.ts` but are now dormant - nothing self-serve calls them.
The tutor and admin queues (`/tutor/reschedules`, `/admin/reschedules`) still exist, still render `RescheduleRequestList`, and still work for the one case that keeps feeding them: an admin-initiated one-off reschedule.
They will simply show zero self-serve entries from now on.
The office-mediated escape hatch for a gated or capped student is the admin one-off reschedule tool plus the existing messages thread, not the approval queue.

## Lazy expiry, no scheduler

A credit's stored `status` can lag reality: `deriveCreditStatus(stored, expiresAt, today)` treats a credit as `expired` the moment `today > expiresAt`, regardless of what is written in the row, and treats `redeemed` as terminal.
Every read path (the redemption list, the admin overview) applies this derivation, so correctness never depends on a background job having run.
The stored `status` column is updated opportunistically wherever credits are loaded, purely to keep future queries and reporting cheap, but no scheduled job exists and none is required.
This mirrors the existing `deriveTrialStatus` pattern used for free-trial students.

## Browser-QA checklist

The items below are the acceptance gate; everything above this section is machine-verified only (tests, typecheck, build, `db:check-rls`).
Tick each box after clicking through it in a real browser session with real data, per the project's success-claim rule.

### Student (`student_unrestricted`)

- [ ] Cancel an eligible lesson (at least 24 hours out, under the cap) and confirm it marks the student absent, grants a credit, and the remaining-allowance label decrements.
- [ ] Attempt to cancel an ineligible lesson (under 24 hours) and confirm the action is replaced by "Message the office," not a silent failure.
- [ ] Reschedule a lesson at least 7 days out into an available same-tutor slot and confirm it moves directly with no approval step or pending state.
- [ ] Attempt to reschedule a lesson under 7 days out and confirm "Message the office" appears instead of a slot picker.
- [ ] Reschedule a lesson at least 7 days out where no same-tutor slot exists and confirm "Get a class credit instead" appears and grants a credit.
- [ ] Redeem an active credit into a same-tutor slot from the credit panel and confirm it books the makeup and marks the credit redeemed.
- [ ] Confirm the allowance labels read "N of 3 left" for both cancel and reschedule, and decrement correctly as actions are taken.
- [ ] Reach the cap on cancellations (3 in a term) and confirm the Cancel action itself closes to "Message the office" rather than showing an error after submission.
- [ ] Reach the cap on reschedules (3 in a term) and confirm the same office-routing behaviour.

### Parent

- [ ] Repeat the cancel, reschedule, no-slot-credit, redeem, and allowance-label checks above for one linked child from `/parent/classes` and `/parent/classes/reschedule/[lessonId]`.
- [ ] On a parent account linked to 2 or more children, switch between children via the child switcher and confirm each child's allowances, credits, and cancellation/reschedule state are independent and correctly scoped (no cross-child bleed).
- [ ] Confirm the ineligibility reason shown (no term / notice / cap) matches the actual reason for at least one gated case per child.

### Tutor

- [ ] Visit `/tutor/reschedules` for a tutor with students who have self-serve rescheduled or cancelled since this change shipped, and confirm no new entries appear in the queue - self-serve actions no longer feed it.
- [ ] If an admin-initiated one-off reschedule exists for one of the tutor's students, confirm it still appears as before (the queue itself is not broken, only no longer fed by self-serve).

### Admin

- [ ] Visit `/admin/reschedules` and confirm the "Class credits" section lists granted, redeemed, and expired credits with reason and source/target lesson.
- [ ] Confirm "This term's usage" shows each student's per-term cancellation and reschedule counts.
- [ ] For a student with more credit rows than the internal display cap, confirm the UI shows a "300+" indicator rather than silently truncating the list with no signal.
- [ ] Confirm the admin one-off reschedule tool (`/admin/users/[id]/reschedule/[lessonId]`) still works uncapped and ungated, and that it is not counted toward the student's self-serve totals.
