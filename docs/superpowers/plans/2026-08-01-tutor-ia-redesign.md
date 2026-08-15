# Tutor IA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the tutor portal from 8 main tabs to 5, put attendance/quiz/notes into the surfaces where the task already lives, and make traversal obvious to an untrained user.

**Architecture:** Nav trim in the tutor shell; `Today` stays a summary launcher with a new one-tap "View class" into the lesson; `Classes` blocks lead into a NEW single-page class hub (`/tutor/classes/[id]`) that stacks this-lesson attendance + curriculum + students + homework; quiz editing moves onto the curriculum week, locked until an admin requests one (request already emits a notification).

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle, Tailwind v4, tutor UI kit (`@/components/student/card`, `@/components/student/pill`, `@/components/student/page-head`).

## Global Constraints

- No em dash "—" anywhere; use "-".
- No co-author line in commits.
- One full sentence per line in Markdown edits.
- Every task ends green: `npm run typecheck` clean and `npm run build` compiles; run `npm test` when logic changes.
- Follow the new CLAUDE.md "Intuitive navigation & information architecture" rule.
- Surgical changes: relocate, don't delete. Removed nav entries leave their underlying routes dormant (unlinked), not deleted, unless the owner asks.
- No new DB schema.

---

### Task 1: Trim the tutor navigation

**Files:**
- Modify: `src/components/tutor/shell.tsx` (the `SECTIONS` nav array)

**Interfaces:**
- Produces: a 5-item main nav (Today, Classes, Students, Marking, Resources); `Attendance`, `Quizzes`, `Notes` removed. No new exports.

- [ ] **Step 1:** In `SECTIONS`, remove the three nav item objects whose `href` is `/tutor/attendance`, `/tutor/quizzes`, `/tutor/notes`. Remove now-unused lucide icon imports (`ClipboardCheck`, `ListChecks`, `FileText`) if nothing else uses them in the file.
- [ ] **Step 2:** `npm run typecheck` - clean (catches an unused-import type error only if `noUnusedLocals`; otherwise verify by grep that removed icons aren't referenced elsewhere in the file).
- [ ] **Step 3:** `npm run build` - compiles.
- [ ] **Step 4:** Commit: `refactor(tutor-nav): remove Attendance/Quizzes/Notes tabs (folded into class + curriculum + lesson)`.

---

### Task 2: New single-page class hub

**Files:**
- Create: `src/app/tutor/classes/[id]/page.tsx`
- Modify: `src/app/tutor/classes/page.tsx` (make each "All classes" block link to `/tutor/classes/[id]`)
- Modify (data): `src/app/tutor/_data.ts` - add a `getClassHubForTutor(tutorId, classId)` query returning the class header, its current/next lesson id+date+time, its roster (id/name/deliveryMode), and its subjectId (for the curriculum link). Reuse existing helpers where possible (roster shape mirrors `getLessonForTutor`).

**Interfaces:**
- Consumes: existing `requireTutor()` from `../_data`.
- Produces: `getClassHubForTutor(tutorId: string, classId: string): Promise<{ class: {...}, nextLesson: { id, date, startTime, endTime } | null, roster: {...}[], subjectId: string }>` and the class hub route.

- [ ] **Step 1:** Read `src/app/tutor/classes/page.tsx`, `src/app/tutor/_data.ts` (the `getLessonForTutor` + class-list queries), and `src/app/tutor/classes/[id]/curriculum/page.tsx` + `/students/page.tsx` to learn the data shapes and the tutor UI kit usage.
- [ ] **Step 2:** Add `getClassHubForTutor` to `_data.ts` (verify the tutor owns the class; 404 otherwise). Return the next upcoming (or today's) lesson for the class, the active roster, and the subjectId.
- [ ] **Step 3:** Create `src/app/tutor/classes/[id]/page.tsx` - one scrollable page, stacked sections in this order: (a) header (class name, subject, schedule chip, enrolled count) using the tutor `PageHead`/`Card`; (b) **This lesson** callout - if a today/next lesson exists, a prominent card linking to `/tutor/lessons/[lessonId]` labelled "View class" (today) or "Next lesson" (future) with date+time; (c) **Curriculum** card linking to `/tutor/classes/[id]/curriculum`; (d) **Students** card listing the roster, each row linking to `/tutor/students/[studentId]`; (e) **Homework** card linking to this class's homework (reuse the existing tutor homework route/filter if present, else link to `/tutor/homework`).
- [ ] **Step 4:** In `classes/page.tsx`, change each "All classes" block's primary link/target from the current per-action links to `/tutor/classes/[c.id]` (the hub). Keep subject color styling.
- [ ] **Step 5:** `npm run typecheck` clean; `npm run build` compiles.
- [ ] **Step 6:** Commit: `feat(tutor-classes): single-page class hub (attendance callout + curriculum + students + homework)`.

---

### Task 3: "View class" from Today

**Files:**
- Modify: `src/app/tutor/page.tsx` (today's classes / "This week" section)

**Interfaces:**
- Consumes: today's lessons already loaded on the Today dashboard (`getTutorToday`/`getSubmissionsToMark` context in `page.tsx`).
- Produces: no new exports; a per-today-class "View class ->" action linking to `/tutor/lessons/[lessonId]`.

- [ ] **Step 1:** Read `src/app/tutor/page.tsx` to find where today's lessons are rendered (the "This week" card / next-up hero) and what lesson fields are available (need lesson id + date).
- [ ] **Step 2:** For each lesson dated today, render a prominent "View class ->" link to `/tutor/lessons/[lesson.id]`; for a future lesson keep the existing display (optionally label "Upcoming"). Do not add editing to Today.
- [ ] **Step 3:** `npm run typecheck` clean; `npm run build` compiles.
- [ ] **Step 4:** Commit: `feat(tutor-today): one-tap 'View class' into attendance on the day of a class`.

---

### Task 4: Quiz editing folds into curriculum (locked until requested)

**Files:**
- Modify: `src/app/tutor/classes/[id]/curriculum/page.tsx` (+ its week/section editor component under `_components/`)
- Read/Modify (query): `src/lib/quiz-queries.ts` - a helper to resolve, per subject-week, whether an editable quiz (`status` in `requested` | `changes_requested`) is assigned to this tutor, plus its quiz id.

**Interfaces:**
- Consumes: `getClassHubForTutor` subjectId (Task 2) is not required here; curriculum already resolves the subject/weeks.
- Produces: per-week `{ quizId: string, editable: boolean } | null` used to render the "Edit quiz" control.

- [ ] **Step 1:** Read the curriculum page + section editor and `quiz-queries.ts`/`src/app/_actions/quizzes.ts` to learn how weeks map to `subjectWeekId` and how `listQuizzesForTutor` / status works, and how the shared maker is currently opened from `/tutor/quizzes/[id]`.
- [ ] **Step 2:** Add a query returning, for the subject's weeks, any quiz assigned to this tutor with its `subjectWeekId`, `id`, and `status`.
- [ ] **Step 3:** In the curriculum week UI, add an **"Edit quiz"** control per week: enabled (links to the shared maker for that quiz id) only when a quiz for that week is `requested`/`changes_requested` for this tutor; otherwise render it disabled/greyed with a hint ("No quiz requested"). Approved common quizzes keep their existing surfacing.
- [ ] **Step 4:** Confirm the admin `requestQuiz` notification path is intact (it already calls `notify` to `assignedTutorId` in `src/app/_actions/quizzes.ts`); no change needed unless the link target should point at the curriculum week - update the notification link target if it currently points at `/tutor/quizzes`.
- [ ] **Step 5:** `npm run typecheck` clean; `npm test` (quiz suites) pass; `npm run build` compiles.
- [ ] **Step 6:** Commit: `feat(tutor-quiz): edit quizzes from the curriculum week, locked until admin-requested`.

---

### Task 5: Checklist + final verification

**Files:**
- Modify: `docs/checklist.md` (tutor rows: Quizzes, attendance, notes, class list)

- [ ] **Step 1:** Update the tutor checklist rows to describe the new IA (nav 5 tabs; attendance via class/Today; quiz via curriculum; notes via lesson). Name routes + date 2026-08-01. One sentence per line.
- [ ] **Step 2:** Full gate: `npm run typecheck`, `npm test`, `npm run build` - all green.
- [ ] **Step 3:** Commit: `docs(checklist): tutor IA redesign - 5 tabs, attendance/quiz/notes relocated`.
- [ ] **Step 4:** Produce the owner browser-QA list (nav shows 5; Today "View class" reaches attendance; Classes -> class hub -> curriculum/students/attendance/homework; admin quiz request notifies + unlocks "Edit quiz" in curriculum; no Quizzes tab).

---

## Self-Review

- **Spec coverage:** nav trim (T1), Today launcher + View class (T3), Classes one-page hub with attendance/curriculum/students/homework (T2), quiz into curriculum locked-until-requested + notification (T4), checklist (T5). All spec sections covered.
- **Placeholders:** task steps name exact files and concrete behavior; UI code is written during execution against the real components (inline execution), not pre-stubbed.
- **Ordering:** T1 (nav) is independent; T2 creates the hub the classes list points to; T3 is independent; T4 depends on nothing in T2/T3; T5 last. Safe sequential order.
