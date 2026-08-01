# Parent portal - information-architecture redesign

Date: 2026-08-01.
Status: design, pending owner approval.

## Goal

Make the parent portal traversable by a first-time, non-technical parent with zero training.
Collapse redundant destinations and give each task one obvious home, without changing what a parent can see or do.
This applies the "Intuitive navigation & information architecture" rule in CLAUDE.md and mirrors the tutor redesign (`2026-08-01-tutor-ia-redesign-design.md`).

This pass is deliberately conservative.
Only changes where the redundancy is unambiguous are implemented; every opinionated or capability-changing idea is left in "Flagged for owner" below, not built.

## Current parent IA

The parent portal centers on a child-switcher (rendered whenever the parent has more than one child); every page is scoped to the selected child.
That is first-class and is kept.

Sidebar nav (`src/components/parent/shell.tsx`), 10 items in 3 groups:

- Family: Overview, Classes, Attendance, Homework, Feedback, Progress, Resources.
- Money: Payments.
- Inbox: Messages, Notifications.

Route inventory under `src/app/parent/`:

- `page.tsx` - Overview: a summary dashboard of glanceable tiles + cards that each link out (KPIs for attendance/homework/mastery/outstanding, "From the tutor", recent Homework, recent Payments, Announcements, Contact).
- `classes/page.tsx` - the interactive timetable (calendar, reschedule, cancel) plus a "Lesson Log" section that lists every logged lesson's attendance status via `getAttendance`.
- `attendance/page.tsx` - three stat tiles (rate, absences, lessons logged) plus a table of every logged lesson via the same `getAttendance`.
- `homework/page.tsx` - working surface: stats, subject tabs, full homework table.
- `feedback/page.tsx` - working surface: parent-visible tutor comments per lesson (`getFeedback`).
- `progress/page.tsx` - working surface: topic mastery, and it also surfaces attendance-rate + absences tiles.
- `resources/page.tsx` - resource library browser.
- `payments/page.tsx` - invoices.
- `messages/**`, `notifications/page.tsx` - direct messages and the shared notification inbox.
- `subjects/[id]/page.tsx` - per-subject curriculum, reached in-context from a timetable lesson.

## The redundancy

`getAttendance(child)` is rendered in full in two places:

1. `classes/page.tsx` -> the "Lesson Log" section (date, time, subject, tutor, status, note).
2. `attendance/page.tsx` -> the same rows in a table, plus three summary tiles.

Attendance is therefore a whole top-level tab whose per-lesson list already lives inside Classes, whose summary tiles (rate, absences) are already on both Overview and Progress.
The Classes page even advertises this already: its header reads "Calendar, attendance log and reschedule requests."
This is the exact pattern the tutor redesign removed (a standalone Attendance tab folded into the surface that owns the schedule).

## Changes made (conservative)

### 1. Rename the Classes "Lesson Log" section to "Attendance"; add an `#attendance` anchor

CLAUDE.md bullet: "Match labels to the user's mental model, not the database schema or internal role names."

Once the Attendance tab is gone, a parent looking for attendance must find it inside Classes.
"Lesson Log" is not the word a parent reaches for; "Attendance" is (and the section's content is exactly attendance status per lesson).
The section wrapper also gets `id="attendance"` (with scroll margin) so a deep link can land directly on it.
This establishes the relocated home before the tab is removed, so attendance is never unreachable at any commit.

### 2. Remove the standalone "Attendance" nav tab; re-point the Overview attendance KPI into Classes

CLAUDE.md bullets: "Fewer, clearer destinations beat many overlapping tabs" and "One obvious home per task."

- The "Attendance" item is removed from the sidebar nav (`shell.tsx`), dropping the Family group from 7 items to 6.
- The Overview attendance KPI tile, which linked to `/parent/attendance`, is re-pointed to `/parent/classes?child=<id>#attendance` - the same summary-to-working-surface link, now aimed at the one home for attendance.
- Per "relocate, don't delete", the `/parent/attendance` route file is left in place and dormant (unlinked), so any existing bookmark or deep link still resolves.

No attendance data or capability is lost: the full per-lesson list stays on Classes, and the rate/absences summary stays on Overview and Progress.

## Flagged for owner (deliberately NOT done)

These are either opinionated, would change what a parent can do, or need a shared/cross-portal file.
They are left for an explicit decision.

- **Non-functional top-bar search.**
  The shell's search input ("Search homework, feedback, invoices..." with a "Cmd+K" hint) has no handler - it is a dead control, and the same stub exists in the tutor and admin shells.
  Removing it from the parent shell alone would break cross-portal `consistency`; wiring it up is a real feature.
  This is a cross-portal decision (all three shells), so it is flagged, not touched.

- **Retire the dormant `/parent/attendance` route entirely.**
  Change 2 leaves it dormant per the relocate-don't-delete rule.
  Whether to delete the file (and the unique "lessons logged" tile it carries) is an owner call.

- **Attendance summary on Classes.**
  The standalone Attendance page carried rate/absences/lessons-logged tiles.
  Those summaries still exist on Overview and Progress, but not on Classes itself.
  Adding a compact attendance-rate strip above the Classes "Attendance" section would fully absorb the old page, but it is additive design (and would touch the timetable page another agent is actively editing), so it is flagged.

- **Progress page duplicates attendance tiles.**
  `progress/page.tsx` shows attendance-rate + absences tiles that duplicate Overview.
  Arguably fine as context for a mastery page; removing them is opinionated. Flagged.

- **Feedback vs the Classes lesson notes.**
  Feedback (parent-visible tutor comments) is a distinct dataset from attendance notes, so it is kept as its own tab.
  Whether Feedback should instead live per-lesson (like the tutor redesign) is a larger IA question. Flagged.

- **"Money" group of one.**
  The Money group holds a single item (Payments).
  A one-item group heading is slightly odd but harmless; merging or relabeling is cosmetic and opinionated. Flagged.

## Constraints honoured

- All edits are inside `src/app/parent/**` and `src/components/parent/**`.
- No shared component, shared `lib`, or DB schema is touched.
- The shared notification inbox (`src/components/notifications/inbox-page.tsx`) is untouched.
- No route is deleted; the removed nav item leaves its route dormant.

## Success criteria

- Parent sidebar shows 9 items; the standalone "Attendance" tab is gone.
- The Classes page's attendance section is titled "Attendance" and is reachable at `/parent/classes#attendance`.
- The Overview attendance KPI lands on the Classes attendance section.
- `/parent/attendance` still resolves directly by URL (dormant).
- `npm run typecheck` and `npm run build` pass.
