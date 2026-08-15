# Tutor portal - information-architecture redesign

Date: 2026-08-01.
Status: design, pending owner approval.

## Goal

Make the tutor portal traversable by a first-time, non-technical user with zero training.
Collapse redundant tabs, put each task in one obvious home, and separate glanceable summary surfaces from working surfaces.
This applies the new "Intuitive navigation & information architecture" rule in CLAUDE.md.

## Problem (current state)

The tutor nav has 12 items and scatters single workflows across tabs.

- "Today's lessons" appear in three places: `Today`, `Classes`, and `Attendance`.
- There is no `Lessons` tab; an individual lesson (where attendance is marked) lives at `/tutor/lessons/[id]` and is only reachable from `Today` or `Attendance`.
- `Quizzes` is effectively a notification inbox for admin quiz requests plus the editor; it is a whole tab for something that is only occasionally actionable.
- `Notes` is a standalone list, separate from the lesson the note belongs to.

## Navigation: 8 main tabs -> 5

Main section after redesign: **Today, Classes, Students, Marking, Resources**.
Schedule (`Timetable`) and Comms (`Discussions`, `Messages`, `Notifications`) are unchanged.

Removed nav items: `Attendance`, `Quizzes`, `Notes`.
Their underlying functionality is not deleted - it is relocated (below).

Kept as distinct working surfaces (judgment call): `Students` (cross-class people view + search) and `Marking` (cross-class homework queue).
`Today` only *summarises* these; the tabs are where the work is done - this is the intended summary-vs-working-surface split, not duplication.

## Today = summary launcher

`Today` (`src/app/tutor/page.tsx`) stays a dashboard of glanceable tiles that each link out; nothing is edited on `Today` itself.
It already renders: This week, Submissions to mark, Students to bump, Lessons missing a note, Recent notes.

Change: today's class(es) get a prominent **"View class ->"** action that opens that lesson's page (`/tutor/lessons/[id]`) for marking attendance and writing notes.
This is the one-tap, in-context access to in-class duties on the day of a class.
Before the lesson's day it can read "Upcoming class"; on the day it reads "View class" and the lesson page is where attendance is marked.

## Classes = working hub

`Classes` (`src/app/tutor/classes/page.tsx`) keeps its "All classes" subject blocks, but each block now leads into a real **class page** at `/tutor/classes/[id]` (this index route does not exist today; blocks currently dead-end into `/curriculum` and `/students`).

The class page is **one scrollable page with stacked sections** (owner-approved shape):

1. **Header** - class name, subject, schedule chip, enrolled count.
2. **This lesson** - the current or next lesson for this class as an attendance callout; tapping it opens `/tutor/lessons/[id]` to mark attendance + notes. On a class day this is the primary action.
3. **Curriculum** - entry to the curriculum editor for this class's subject, including the quiz (see below).
4. **Students** - this class's roster, each linking to the student profile.
5. **Homework** - homework for this class (create + the marking entry for this class).

So the flow "today's class -> into the class -> mark attendance" is one continuous path, not split across `Attendance` + `Today`.

## Quiz -> curriculum + notification

Remove the `Quizzes` tab.
Quiz editing moves into the curriculum page, scoped to the week the quiz belongs to.

- On the curriculum page, each week shows an **"Edit quiz"** control.
- It is **locked/greyed** unless an admin has requested a quiz for that week - i.e. a quiz exists for that subject-week with `status` of `requested` or `changes_requested` assigned to this tutor.
- When an admin requests a quiz, the tutor receives a **notification** (this already fires in `requestQuiz`, `src/app/_actions/quizzes.ts`); its link opens that curriculum week with the quiz editor unlocked.
- The tutor builds in the shared quiz maker (reused in place) and submits for review, exactly as today - only the entry point changes from the `Quizzes` tab to the curriculum week.

Approved common quizzes that currently also surface in the curriculum week stay as they are.

## Removed pages' fates

- `/tutor/attendance` (list) - nav entry removed; attendance marking still happens on `/tutor/lessons/[id]`, now reached from Today's "View class" and the class page's "This lesson" callout. The list page may be retired or left unlinked.
- `/tutor/quizzes` and `/tutor/quizzes/[id]` - nav entry removed; the maker is reused inside curriculum. The standalone route may be retired or left unlinked.
- `/tutor/notes` - nav entry removed; notes are written inside the lesson page (`/tutor/lessons/[id]`, which already has parent-visible + internal note fields). Today still surfaces "Lessons missing a note" and "Recent notes" as summaries that link to the relevant lesson.

Retired-but-unlinked pages follow the repo's surgical-changes convention (kept dormant, not deleted, unless the owner asks to delete).

## Non-goals / out of scope

- No change to the student, parent, or admin portals in this pass (the CLAUDE.md principle applies to them going forward, but this spec only implements the tutor redesign).
- No change to what data attendance/quiz/notes capture; only where they are reached from.
- No new database schema.

## Likely files touched

- `src/components/tutor/shell.tsx` - nav items.
- `src/app/tutor/page.tsx` - "View class" action on today's classes.
- `src/app/tutor/classes/page.tsx` - blocks link to the new class page.
- `src/app/tutor/classes/[id]/page.tsx` - NEW one-page class hub.
- `src/app/tutor/classes/[id]/curriculum/...` - "Edit quiz" control, locked until requested; embed the quiz maker.
- `src/lib/quiz-queries.ts` / `src/app/_actions/quizzes.ts` - resolve "is a quiz requested for this week" for the lock state (mostly read-side; request/notify already exist).
- `docs/checklist.md` - update the tutor rows (Quizzes, attendance, notes) to the new IA.

## Success criteria

- Tutor main nav shows 5 items; `Attendance`, `Quizzes`, `Notes` are gone.
- From `Today`, a class on its day reaches attendance marking in one tap.
- From `Classes`, a class opens a single page from which curriculum, students, attendance, and homework are all reachable without leaving that context.
- An admin quiz request produces a notification; the tutor edits the quiz from the curriculum week; no `Quizzes` tab exists; the "Edit quiz" control is locked when no quiz is requested for that week.
- `npm run typecheck`, `npm test`, and `npm run build` pass.
- Owner browser QA confirms the flows read as intuitive.
