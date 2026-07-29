# Self-Serve Reschedule - Design

**Date:** 2026-07-10
**Status:** Approved design, building
**Depends on:** role-tiers Spec 1 (2026-07-09) - `student_unrestricted`, `requireUnrestrictedStudent`, `coarseRole`.

Lets `student_unrestricted` students and parents reschedule a lesson themselves, routed by class type and timing through either a direct switch or a tutor/admin approval.

## Routing

| Class type | Timing (now → original lesson start) | Path |
|---|---|---|
| `one_on_one` | any | **Request → approval** (tutor or admin) |
| `group` | ≥ 24h | **Direct** switch, no approval |
| `group` | < 24h | **Request → approval** |

24h is measured from now to `originalLesson.date + startTime` (local, matching the existing admin reschedule convention). Only **upcoming** lessons in the future are reschedulable.

## Target selection

- **1-on-1** → a slot from the **same tutor's** availability (reuse `expandAvailability`, same tutor only; no all-tutors toggle). Execution creates a per-student `makeup` lesson at that slot.
- **Group** → another **same-subject** class session running **that week** with a **spare seat** (non-withdrawn enrolments + existing makeup-attendees on that lesson < class capacity). Execution marks the student absent on the original lesson and `makeup_attended` on the chosen target lesson. No new lesson row is created for group.

Group with no eligible session that week → "No sessions available this week - contact the office." (Make-up credit / class-token fallback is a future spec.)

## Data model

**`classType` enum** (`group` | `one_on_one`) + `classes.classType` column, `NOT NULL default 'group'`. Migration backfills every existing class to `group`. Admin class create/edit forms get a Group / One-on-one selector.

**`reschedule_requests` table:**
- `id` uuid pk
- `originalLessonId` → lessons
- `studentId` → profiles (the student being moved)
- `requestedById` → profiles (the acting student or parent)
- `reason` text (optional)
- `status` enum `pending | approved | rejected | cancelled` default `pending`
- 1-on-1 target: `targetTutorId`, `targetDate`, `targetStartTime`, `targetEndTime` (nullable)
- group target: `targetLessonId` → lessons (nullable)
- `decidedById`, `decidedAt` (nullable)
- `createdAt`

RLS: enable row-level security on the table (all app access is server-side Drizzle as the postgres role, which bypasses RLS); no client policies = deny-by-default for anon/authenticated, consistent with the existing model.

## Execution primitives (shared, server-only)

- `executeMakeupReschedule({ studentId, originalLessonId, tutorId, date, startTime, endTime, reason, actorId })` - create `makeup` lesson (mirrors the existing admin `rescheduleStudentLesson`), mark original `absent`, pre-mark new `makeup_attended`. Re-validates the tutor slot is still free before creating (double-booking guard).
- `executeSessionSwitch({ studentId, originalLessonId, targetLessonId, reason, actorId })` - mark original `absent`, add `makeup_attended` on the target lesson. Re-validates the target still has a spare seat.

Both notify **tutor + linked parents + admin**.

## Actions

- `submitReschedule(formData)` - actor is `student_unrestricted` (own lesson) or parent (their child's lesson). Loads the lesson's class + computes the path. Group ≥24h → run `executeSessionSwitch` directly. Otherwise insert a `reschedule_requests` row (`pending`) and notify the approvers (class tutor + admins).
- `approveReschedule(id)` / `rejectReschedule(id, reason?)` - caller is the class tutor OR any admin. First to act wins (reject if not `pending`). Approve → run the matching execution primitive, set `approved`, notify. Reject → set `rejected`, notify the requester.

## UI

- **Initiate** - from the student/parent timetable + lesson view, a "Reschedule" affordance on upcoming lessons. `student_unrestricted` and parents only (restricted students never see it). The page shows the correct picker (1-on-1 slot picker vs group session picker) and, for approval paths, submits a request with a "sent for approval" confirmation.
- **Approve** - a "Reschedule requests" queue in the tutor portal (requests for their classes) and admin portal (all pending), each row showing student / from → to / reason, with Accept + Reject.

## Enforcement

Server actions gate on role: `submitReschedule` requires the actor own the lesson (student self, or parent linked to the student); `approve/reject` require the caller be the class tutor or an admin. UI hides affordances; the action is the real gate (server-side Drizzle bypasses RLS, per the existing model).

## Out of scope
- Make-up credits / class tokens (no-session fallback).
- No cap on reschedule count beyond the timing rules.
- Native device push (in-app notifications only).
