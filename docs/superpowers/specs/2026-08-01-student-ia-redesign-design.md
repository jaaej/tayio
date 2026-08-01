# Student portal - information-architecture redesign

Date: 2026-08-01.
Status: design + conservative implementation.

## Goal

Apply the "Intuitive navigation & information architecture" rule in CLAUDE.md to the student portal.
The bar: a first-time, non-technical student can find and finish any task without training.
This pass is deliberately conservative - it fixes only defects that are obvious and undeniable, and flags every opinionated or behaviour-changing idea for the owner instead of implementing it.
The tutor redesign (`2026-08-01-tutor-ia-redesign-design.md`) is the reference for the lens; the student portal is a different shape and needs far less surgery.

## Current student IA

Nav lives in `src/components/student/shell.tsx`:

- **Learning:** Dashboard (`/student`), My subjects (`/student/subjects`), Timetable (`/student/timetable`), Progress (`/student/progress`), Discussions (`/student/discussions`).
- **Inbox:** Messages (`/student/messages`), Notifications (`/student/notifications`), and Payments (`/student/payments`, unrestricted students only).
- **Sidebar promo:** Math Blitz card linking to `/student/math-game`.

Routes that exist under `src/app/student/` but are **not** in the nav:

- `/student/homework` - a full, dedicated homework list (Overdue / Due this week / Submitted / Marked / Coming up). Reachable today only from one card ("Marked -> All homework ->") on the subjects page.
- `/student/resources` - a real working surface: the approved resource **Library** plus **Recorded lessons**. It has **no entry in the student nav at all**. Its only inbound links are the legacy shared shell (`src/components/portal/shell.tsx`, not used by the current student shell) and a local `week-calendar.tsx` that is itself dead (not imported anywhere; the earlier apparent import was a substring match on `mini-week-calendar`).
- `/student/quizzes/[id]` - a quiz, reached in-context from the relevant subject week (`subjects/[id]` week content). No standalone index. This is already correct ("gate, don't dangle" - a quiz surfaces where the week lives, not as a top tab).
- `/student/math-game` - reached from the sidebar promo card.

### Observed problems

1. **Resources is undiscoverable.** A fully built, useful surface has zero front door in the current shell, yet the top-bar search placeholder literally advertises "Search homework, lessons, resources". A first-time student is told resources exist and given no way to browse them. This is a plain discoverability defect (violates "Optimise for zero-training discoverability").

2. **A dashboard action link lies about its destination.** On `/student` the "Your quests" block (a list of open homework) has an action labelled **"All homework ->"** whose `href` is `/student/subjects`, not a homework page. Meanwhile the subjects page's "Marked" card has an **"All homework ->"** action that correctly points to `/student/homework`. So the same label points to two different places, and one of them does not go to homework at all (violates "Match labels to the user's mental model" and the consistency guideline).

3. **Homework has two full homes** (`/student/subjects` carries a homework calendar + overdue + marked; `/student/homework` is a second full homework list). This is a genuine overlap, but resolving it means picking a canonical page, renaming the "My subjects" tab, and/or restyling - all opinionated and behaviour-changing. Flagged, not done (see below).

## Changes this pass WILL make (conservative, undeniable)

### Change 1 - Give Resources a front door in the nav

Add a **Resources** item (`/student/resources`) to the "Learning" section of `StudentShell`, between Progress and Discussions.

- CLAUDE.md bullet: **"Optimise for zero-training discoverability"** (and the inverse of "gate, don't dangle" - here a built surface is dangling with no entrance).
- Why it is safe and not opinionated: the page already exists and enforces `requireRole("student")`; the legacy shared shell already listed it, so its absence from the bespoke student shell reads as a restyle oversight, not a deliberate gate. Adding the item restores prior discoverability and changes no data access.
- UI: icon + text label (lucide `Library`) at the shared `IC` size, matching the existing icon family and the section's pattern - passes `nav-label-icon`, `icon-style-consistent`, and keeps `nav-hierarchy` intact. Mobile nav inherits the same `sections`, so one edit covers both.
- Scope: `src/components/student/shell.tsx` only.

### Change 2 - Make the dashboard "All homework ->" link honest

On `/student` change the "Your quests" section action `href` from `/student/subjects` to `/student/homework`.

- CLAUDE.md bullet: **"Match labels to the user's mental model"** (a link labelled "All homework" must lead to homework), plus the consistency guideline (it then agrees with the subjects page's existing "All homework ->" link, which already points to `/student/homework`).
- Why it is safe and not opinionated: this aligns to the destination the app already uses elsewhere for the identical label; it does not invent a new canonical page or take a side on the deeper homework-consolidation question (that stays flagged). It also gives the otherwise-orphaned homework list a truthful door.
- Scope: `src/app/student/page.tsx` only (one attribute).

## Flagged for owner (deliberately NOT done)

These are real IA improvements, but each is opinionated, changes what a student sees or can do, or would require touching shared files - so they are surfaced for a decision rather than shipped.

1. **Consolidate the two homework homes.** `/student/subjects` and `/student/homework` are both full homework surfaces. Options: fold the homework list into the subjects page and retire `/student/homework`; or keep `/student/homework` as the canonical list and slim the subjects page to a summary. Either way needs a canonical choice, a probable rename of the "My subjects" tab, and a visual reconcile (the two pages are in different visual styles). Opinionated - owner should pick the direction.

2. **Rename "My subjects".** The tab labelled "My subjects" is really a subjects-plus-homework hybrid (it leads with the subject grid but its largest section is a homework due-date calendar). A first-time student reading "My subjects" would not expect their homework calendar there. Renaming touches the mental model and is tied to the consolidation decision above.

3. **Resources placement: top tab vs in-context.** Change 1 restores a top-level nav item (the minimal, clearly-correct fix). An alternative is to surface the Library/recorded lessons inside the subject or lesson context instead of (or as well as) a top tab. That is a judgment call about where resources "belong" and is left to the owner.

4. **Progress vs My subjects overlap.** Progress is a standalone tab; the subjects page also shows per-subject mastery and a "View progress ->" link, and subject cards show mastery. This is a defensible summary-to-detail split, so it is left alone - but if the owner wants fewer destinations, progress could be merged into the subject view.

5. **Dead local component.** `src/app/student/_components/week-calendar.tsx` is not imported anywhere. Per the surgical-changes rule it is left in place, not deleted; flagged so the owner can remove it deliberately.

6. **Search box is non-functional.** The top-bar search ("Search homework, lessons, resources...", with a Cmd+K hint) is presentational only - it has no handler. For zero-training discoverability a working search would matter, but wiring it is a feature, not an IA cleanup. Flagged.

7. **Legacy shared shell still references student routes.** `src/components/portal/shell.tsx` (a shared component, out of this task's scope) still links `/student/resources` and others. If it is truly dead it should be retired centrally; noted for the owner because it sits in `src/components/portal/**`.

## Non-goals / out of scope

- No change to tutor, parent, or admin portals, or to any shared component (`src/components/portal/**`, `ui/**`, `data/**`, `notifications/**`), shared `src/lib/**`, or the DB schema.
- No page deletions - removed or relocated routes stay dormant, not deleted.
- No change to what data any surface captures; only discoverability and one link destination change.

## Success criteria

- Student nav shows a **Resources** item that opens the resource Library; a first-time student can reach resources without being told where to look.
- The dashboard "All homework ->" action lands on the homework list, consistent with the subjects page's identical link.
- `npm run typecheck` and `npm run build` pass; `npm test` unaffected (no logic/query touched).
