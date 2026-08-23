# Admin user detail: tabbed layout + inline lesson rescheduling

Date: 2026-08-23
Route: `/admin/users/[id]`
Status: design approved, not yet implemented

## Why

Two problems with the page today, both raised by the owner while testing the production beta.

The layout does not hold up.
Everything is a single stack of cards, so a student's profile, their lessons, their credit history and their term reports all compete for the same vertical space, and the page reads as a pile rather than a record.
There is no persistent summary, so the answer to "who am I looking at" scrolls away.

Rescheduling is a detour.
An admin sees a flat list of the next three weeks of lessons and has to leave the page entirely to move one, landing on `/admin/users/[id]/reschedule/[lessonId]`.
Students get a month calendar they can act on directly.
That is the same feature behaving differently per role, which the cross-role consistency rule in `CLAUDE.md` forbids.

## Scope

Two phases, one page.
Phase 1 can ship on its own and is worth shipping first, since the tab shell is where the calendar has to live.

**Phase 1 - page shell.**
Tab bar, persistent right rail, reworked header.
Pure layout. No schema change, no new server action.

**Phase 2 - calendar and inline rescheduling.**
Replaces the lesson list inside the Lessons & leave tab.

### Out of scope

Deliberately excluded, and each has a reason rather than being an oversight.

- **Admin-initiated cancellation.**
  No admin cancel action exists anywhere today; only student self-serve cancel and admin undo of a cancellation.
  Adding one raises policy questions (does it grant a credit, does it count against the cap, who is notified) that are decisions for the owner rather than code.
- **Permanent tutor reassignment.**
  Moving a student to a different tutor for a whole class is an enrolment change, not a lesson change, and affects the tutor's roster.
- **A general tutor-visible note on a student.**
  Related to the free-trial note but a separate feature.

## Phase 1: page shell

### Tabs

Four tabs, in this order: Profile, Lessons & leave, Credits & activity, Term reports.

Driven by a `?tab=` search param, not client state.
Three reasons: the tab survives the back button, an admin can link a colleague straight to a student's credit history, and Phase 2 needs `?month=` to coexist with the tab without a server round trip resetting it.

Non-student roles (tutor, parent, admin) have no lessons, credits or term reports.
For them the tab bar does not render at all and the page shows the Profile content directly.
Gating on `isStudent` already happens in the current page for those sections, so this is a relocation of existing logic rather than new branching.

### Header

Avatar initials tile, full name, status pill, and a `role · email` sub line.
Actions sit right-aligned: Message on every tab, Save changes only on Profile.

Save changes appears only where something is editable.
Every other tab acts immediately (Set trial, Link parent, Add leave, Reschedule), so a Save button there is inert, and an inert Save teaches people to distrust whether their change stuck.
A disabled-but-present button was rejected for the same reason: people click disabled buttons.

### Right rail

Persistent across all four tabs, two cards.

**At a glance** - Status, Role, Year level, School, Phone, Free trial.
Read-only. Every field is already loaded by the page.

**Parents** - linked parents plus the existing add-parent control.
This is the current `FamilyLinksManager`, moved rather than rewritten.

The rail is intentionally present even on Term reports, where the main column is nearly empty.
It costs nothing (the data is already fetched) and keeps the answer to "who am I looking at" on screen at all times.

### Layout

Two columns at `lg` and above: main content and a rail of fixed width.
Below `lg` the rail stacks under the main content, so the primary work is never pushed below the fold on a narrow screen.

## Phase 2: calendar and inline rescheduling

### The shared grid

The student portal already has a month grid at `src/app/student/_components/month-calendar.tsx`.
The admin needs the same grid with different actions on it.

Extract the presentational grid to `src/components/calendar/month-grid.tsx` and have both portals use it.
Each portal keeps its own interaction layer on top.

The alternative, an admin-only calendar, was rejected: two month grids drift, and the resulting mismatch is exactly what the cross-role rule exists to prevent.

Timing makes this unusually safe.
The current beta is admin and tutor only, so no student is using `month-calendar.tsx` right now.
Refactoring it today carries far less risk than it will once families are live.

`MonthGrid` takes days, chips and shaded ranges.
It performs no data fetching and owns no actions.

### Components

- **`src/components/calendar/month-grid.tsx`** - presentational month grid, shared by student and admin.
- **`AdminLessonCalendar`** (client, `src/app/admin/users/[id]/_components/`) - wraps the grid, owns month navigation via `?month=YYYY-MM`, opens the panel when a chip is clicked.
- **`ReschedulePanel`** (client, same directory) - the existing `src/components/ui/side-panel.tsx` slide-over, containing the slot picker.

A popover was rejected.
The slot picker lists availability across four weeks under two tutor scopes, which does not fit an anchored popover, and the slide-over is already the admin portal's convention for this kind of task.

### Server actions

**`loadAdminRescheduleOptions(studentId, lessonId)`** - new, `requireAdmin` guarded.
Mirrors the student's existing `loadRescheduleOptions`.
Wraps `getEligibleTutors`, `getAllTutors`, `expandAvailability` and `markTakenSlots`, all of which already exist in `src/lib/availability.ts` and are already used by the page being deleted.
Returns same-subject slots and all-tutor slots separately, preserving the admin's existing ability to move a lesson to any tutor, which students cannot do.

**`rescheduleStudentLesson`** - changed, not new.
It currently calls `redirect()` on every validation failure, pointing at `/admin/users/[id]/reschedule/[lessonId]?error=...`.
A slide-over cannot follow a redirect, and the target route is being deleted, so those become `{ ok: false, error }` returns.
The success path keeps its `revalidatePath` and closes the panel.
The lesson-creation logic (make-up lesson, absent marking on the original, notifications) is unchanged.

### Leave on the grid

Leave periods render as shaded days behind the lesson chips.
When a selected slot falls inside one, the panel warns before submitting rather than blocking, since an admin may have a good reason to override.

No new logic is needed for this.
`isOnLeave(dateISO, periods)` already exists in `src/lib/student-leave.ts` and is already unit tested across the inclusive boundaries, inside a range, just outside a range, single-day periods, and the empty case.
Both the shading and the panel warning call it, so the rule is defined once and cannot disagree between the two.

### Deleting the old route

`/admin/users/[id]/reschedule/[lessonId]` and its `_components/slot-picker.tsx` are removed once the panel works.

Only one inbound link exists, the Reschedule button in the lesson list being replaced, so nothing else needs repointing.
Verified by grep across `src/`.

Keeping it as a fallback was rejected: two implementations of one flow is the drift the consistency rule exists to prevent, and a bug fixed in one would silently persist in the other.

## Data

No schema change.
No migration.

The page already loads leave periods and the student's lessons.
The lesson query changes from "next three weeks" to a month window driven by `?month=`, so navigating back through history works.

## Testing

- Leave overlap needs no new tests: `isOnLeave` is already covered in `src/lib/student-leave.test.ts`.
- `rescheduleStudentLesson` error returns - the four existing failure paths (invalid slot, lesson in the past, slot taken, malformed input) now return rather than redirect, so each needs a case.
- Manual, in the browser, across roles: the extracted `MonthGrid` must be verified on the student timetable as well as the admin page, since the whole point of extracting it is that both use it.

## Risks

**The grid extraction touches the student portal.**
Mitigated by timing (no student is using it during this beta) and by the manual cross-role check above.
If the student timetable regresses, the extraction is the first place to look.

**`rescheduleStudentLesson` is money- and entitlement-adjacent.**
It creates a make-up lesson and marks attendance.
The change here is strictly to its error-reporting mechanism; the transaction body is not touched.
