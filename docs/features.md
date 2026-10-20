# Feature Reference

Last reconciled with the current codebase: **10 October 2026** (sections touched by the 18 to 20 October 2026 consistency audit were updated then).

A comprehensive, deploy-ready reference of every feature shipped in `tayio_portal`,
organized by role. Each feature documents three things:

1. **What it is** - plain-language summary.
2. **How it works** - routes, key files, `schema.ts` tables, server actions, guards.
3. **Rationale** - the reason behind a design choice, cited to an artifact
   (commit, spec, code comment, checklist, security-checklist, or memory note).
   Where no artifact documents the "why", it is marked **`Rationale: not documented`** -
   the motivation was not invented.

The historical backbone inventory is `docs/checklist.md`; the active production
acceptance backlog is `checklist_beta_fix.md`. Status ticks are not repeated
here. Features described below are present in code, but any unchecked browser or
live-delivery item in the beta checklist remains unaccepted.

Conventions referenced throughout:
- **Guards** live in `src/lib/auth.ts` (`requireRole`, `requireAdmin`, `requireStudent`,
  `requireUnrestrictedStudent`) and `src/lib/roles.ts` (`coarseRole`, `studentTier`,
  `ADMIN_TIERS`, `STUDENT_TIERS`).
- **Security model:** app-layer `requireRole` + ownership checks are the *primary*
  access control; the server-side Drizzle client (`src/db/client.ts`) connects as the
  `postgres` role and bypasses RLS, so RLS is defense-in-depth (per security-checklist C6).

---

## Student

### Dashboard
1. **What it is** - Landing page showing next class, due homework, mastery snapshot, recent grades, announcements, and (for unrestricted students) an outstanding-balance tile.
2. **How it works** - `/student` (`src/app/student/page.tsx`), `_lib/queries.ts`. Reads `lessons`, `homework`/`homeworkAssignments`, `progressTopics`, `announcements`, `invoices`. Guard: `requireRole("student")` (expands to both student tiers). Balance tile rendered only when `studentTier(role) === "unrestricted"`.
3. **Rationale:** The outstanding-balance tile is tier-gated because only `student_unrestricted` students self-manage payments; restricted students' billing is owned by their parent (per role-tiers spec §5.1, `docs/superpowers/specs/2026-07-09-student-role-tiers-design.md`).

### Timetable
1. **What it is** - Month/week calendar of the student's upcoming (and past) lessons.
2. **How it works** - `/student/timetable` (`src/app/student/timetable/`). Reads `lessons` joined via `enrollments` → `classes`. For `student_unrestricted`, the timetable is interactive (reschedule) via `interactive-timetable.tsx`. Guard: `requireRole("student")`.
   The permanent weekly class-move request is a connected glass footer below the calendar rather than a separate panel above it.
3. **Rationale:** Subject-colour map renders Maths as red, which reads like a "cancelled" state; the interactive timetable deliberately sidesteps this with a brand tint (per memory `project_role_tiers_spec1_2026_07_10.md`).

### Homework (view + submit)
1. **What it is** - List of assigned homework with due dates; per-assignment detail with file/text submission, tutor feedback, a due-date-gated solution, and (for flagged tests) an anonymous rank.
2. **How it works** - `/student/homework`, `/student/homework/[id]`.
   Submission uploads to Supabase Storage via the API route `src/app/api/student/homework/[id]/submit/`.
   PDFs, images, and browser-supported videos open in an in-portal viewer; formats the browser cannot reliably render use an Open file fallback.
   Tables: `homework` (`attachmentUrl`, `solutionUrl`, `createdById`), `homeworkAssignments` (`submissionUrl`, `submissionText`, `score`, `feedback`, `status`).
   Test rank query `getStudentTestRank` uses a `RANK()` window over `homework.is_test` submissions.
   Guard: `requireRole("student")` + assignment ownership (`studentId = user.id`).
3. **Rationale:** Homework worksheets and solutions are stored as private storage paths and served through short-lived signed URLs.
   The student page does not sign or render a solution until the homework due date, preventing early answer exposure.
   Test ranking exposes *rank only* - no peer scores or names (per `docs/checklist.md` Student "Grade page").

### Progress / grades
1. **What it is** - Per-subject mastery, per-topic breakdown, and a detail page listing every submitted task's grade + tutor feedback, plus an overall anonymous per-subject rank.
2. **How it works** - `/student/progress`, `/student/progress/[id]`. Tables: `progressTopics` (mastery bands), `homeworkAssignments` (scores/feedback), `subjectTopics`. Overall rank via `getStudentOverallSubjectRank` (`RANK()` window). Guard: `requireRole("student")`.
3. **Rationale:** Ranking surfaces position only, never peer scores/names - avoids exposing classmates' academic data while still giving competitive signal (per `docs/checklist.md` Student "Grade page"). Note: the free-text `progress_topics` table is scheduled to be replaced by computed mastery in curriculum "Part 3" (per `docs/superpowers/specs/2026-06-30-curriculum-topics-design.md`).

### Subject deep-dive (curriculum)
1. **What it is** - Per-subject, week-by-week curriculum: recorded video, booklet, homework due that week, and completion progress, grouped by topic.
2. **How it works** - `/student/subjects/[id]` (`_queries.ts`, `_components/`, `_actions.ts`). Tables: `subjects`, `subjectTopics`, `subjectWeeks`, `studentWeekProgress`, `studentCurriculumTermGrants`, `tutorWeekSections`/`tutorWeekAttachments`, and `terms`. `src/lib/curriculum-access.ts` limits a student to started terms from their first subject enrolment onward, plus explicit earlier-term grants, and releases teaching weeks progressively in Melbourne time. The same server guard protects videos, booklets, quizzes, and progress writes; the UI lock is not trusted. Guard: `requireRole("student")`; subject access remains scoped by active enrolment.
3. **Rationale:** Permission failure returns `notFound()` rather than 403 so the portal does not leak the existence of subjects the student isn't enrolled in. Students see the locked admin base plus only *their enrolled class's tutor's* section, never another tutor's supplementary material. Progressive release avoids exposing future answers/material; the admin override on the student record handles legitimate access to an earlier term.

### Lesson recap viewer
1. **What it is** - Read-only view of the parent-visible tutor note for a past lesson.
2. **How it works** - `/student/lessons/[id]`. Reads through the `lesson_notes_safe` view (migration 0003), never `lesson_notes.internal_note`. Guard: `requireRole("student")` + attendance/enrolment scope.
3. **Rationale:** Students read via the `lesson_notes_safe` view, which strips `internal_note`; internal tutor notes must never reach students or parents (per security-checklist A3 / migration 0003). Migration 0018 widened the view's admin predicate from `= 'admin'` to `like 'admin%'` so both admin tiers still bypass it (per role-tiers spec §3.1).

### Resources
1. **What it is** - Lists the student's recorded lessons pulled from real lesson data.
2. **How it works** - `/student/resources`, `/student/resources/[id]`. Sources recorded-lesson data from curriculum (`subjectWeeks.videoUrl`).
3. **Rationale:** Recorded lessons remain a separate tab from the broader Resource Library so a learner can distinguish class recordings from tutor-published booklets, worksheets, past papers, and videos.

### Resource Library
1. **What it is** - A **Library** tab (alongside the preserved **Recorded lessons** tab) of booklets, past papers, worksheets, and videos scoped to the student's enrolled subjects, with filter by type/topic/title.
2. **How it works** - `/student/resources` (Library tab), `resources` table + `resourceTypeEnum` (migration `0024_resources.sql`). Reads via `listResourcesForSubjects` scoped to `enrolledSubjectIds(studentId)` (`src/lib/resources.ts`); only `isPublished` and non-`removedAt` rows are visible. Opening a file mints a short-lived signed URL (`openResource`, `src/app/_actions/resources.ts`); a link resource opens the validated `externalUrl` directly. Guard: `requireRole("student")` + subject-scope filter, backstopped by RLS on `resources` (migration 0024).
3. **Rationale:** Every read is filtered to subjects the student is actually enrolled in/paying for - both at the app layer and via RLS - to prevent cross-cohort resource leakage (a student never sees another cohort's past papers) (per `docs/superpowers/specs/2026-07-23-resource-library-design.md` §Security). App-layer scoping is primary, RLS is defense-in-depth, consistent with the rest of the portal (security-checklist C6).

### Discussions
1. **What it is** - Per-subject and general "Admin/Tech" Q&A boards where students ask homework questions and read tutor/peer answers.
2. **How it works** - `/student/discussions`, `/student/discussions/[boardId]`, `/student/discussions/[boardId]/[threadId]`. Tables: `discussionThreads`, `discussionReplies`, `discussionAttachments`. Shared actions in `src/app/_actions/discussions.ts` (`createThread`, `postReply`). Board visibility scoped via `enrollments → classes → subjects`. Guard: `requireRole` + board-membership check (`canSeeBoard`).
3. **Rationale:** A "board" is a row in the existing `subjects` table (no separate boards table); the shared "Admin/Tech" board is modeled as `subject_id IS NULL` (sentinel-null) - avoids a redundant table given subjects already encode year level (per `docs/superpowers/specs/2026-05-27-discussions-design.md`). Authors cannot delete their own posts; only admins soft-delete (sets `deletedAt`, renders `[removed by admin]`) - keeps an oversight/safeguarding trail (same spec).

### Direct messaging
1. **What it is** - 1:1 DMs with the student's tutors and (for unrestricted students) the admin office.
2. **How it works** - `/student/messages`, `/student/messages/[threadId]`, `/student/messages/with/[userId]`.
   Tables: `dmThreads`, `dmMessages`, `dmReads`.
   Inbox queries require at least one message, so opening a composer and leaving without sending does not create a visible conversation.
   Actions live in `src/app/_actions/dm.ts`; permission uses `canDM` in `src/lib/dm-permissions.ts`.
   Guard: `requireRole("student")` + `canDM`.
3. **Rationale:** `student_restricted ↔ admin` is blocked symmetrically - a young student's admin contact is their parent - while `student_unrestricted ↔ admin` is allowed; this is the one tier-sensitive rule in `canDM` (per code comment in `src/lib/dm-permissions.ts` and role-tiers spec §5.2). Threads persist one-per-pair with canonical `userAId < userBId` ordering so pair lookup is a single equality (per `docs/superpowers/specs/2026-05-27-direct-messaging-design.md`).

### Payments (unrestricted only)
1. **What it is** - Read-only view of the student's own invoices and statuses.
2. **How it works** - `/student/payments` (`src/app/student/`). Reads `invoices WHERE student_id = me` via `getInvoicesForStudent`; balance via `getOutstandingBalanceForStudent`. Guard: `requireUnrestrictedStudent()` (`src/lib/auth.ts`, redirects `student_restricted`).
3. **Rationale:** Gated to `student_unrestricted` because only independently-enrolled/older students self-manage billing; restricted students' invoices are owned by the linked parent (per role-tiers spec §5.1). View-only: no payment processor is wired anywhere (same spec, "Note").

### Reschedule (unrestricted only)
1. **What it is** - Self-serve rescheduling of an upcoming lesson via the interactive timetable, routed to either a direct switch or a tutor/admin approval queue.
2. **How it works** - Initiated on `/student/timetable` (`interactive-timetable.tsx`); `submitReschedule` server action in `src/lib/reschedule.ts` + student `_actions`. Tables: `rescheduleRequests`, `lessons` (status `makeup`/`rescheduled`), `attendance` (`makeup_attended`). Slots come from `tutorAvailability` via `getAvailableSlots` (`src/lib/availability.ts`). Guard: `requireUnrestrictedStudent()` + lesson ownership.
3. **Rationale:** The model unified on **tutor-availability slots** (every reschedule is a per-student make-up at a tutor-free time). The active flow keeps the assigned tutor and original class. The retained group-switch compatibility primitive also revalidates matching subject/year on the server. Allowance usage counts distinct original lessons, so changing one lesson's make-up destination remains one use even if legacy history contains multiple approved rows.

### Taiyo Blitz
1. **What it is** - A mental-math speed drill with a 30-second Sprint and four 60-second levels, profile-icon leaderboards, and optional sound/reward effects.
2. **How it works** - `/student/math-game` (`page.tsx`, `_queries.ts`, `_actions.ts`, `_components/`). Table: `mathGameScores` (append-only; enum `mathGameDifficultyEnum` = sprint/easy/medium/hard/genius). `submitScore` validates with Zod + a per-tier plausibility cap. Leaderboards use each student's personal best per difficulty and switch between year-level and all-Taiyo scope; inactive accounts are excluded and rows show the selected profile icon or initials. Guard: `requireRole("student")` (both tiers).
3. **Rationale:** Available to *all* students, not gated by tier - it's an engagement feature with no academic weight. Sound plays through the Web Audio API for rapid feedback and includes a persistent Mute choice. Correct answers trigger a short accessible `+1 Correct!` burst and score pop; `prefers-reduced-motion` disables the animations. The plausibility cap remains a guardrail rather than server-authoritative per-answer checking, which would add reflex-game latency.

### Notifications inbox
1. **What it is** - In-app inbox of notifications (DMs, discussion replies, reschedule updates).
2. **How it works** - `/student/notifications` (`NotificationsInbox` component). Table: `notifications`. Guard: `requireRole("student")` + `userId = me`.
3. **Rationale:** The inbox is the authoritative notification channel. Email is reserved for urgent targeted announcements when the Resend transport is configured; ordinary workflow events stay in-app to avoid notification noise.

### Profile and security
1. **What it is** - A profile-icon picker and authenticated password-change form reached from the top-right profile avatar.
2. **How it works** - `/student/profile`; `setMyProfileAvatar` accepts only keys from the controlled icon library. `changeMyPassword` rate-limits attempts, verifies the current password through Supabase Auth, requires a different 8+ character password and matching confirmation, then updates the signed-in user. The shared student shell and Taiyo Blitz leaderboard render the selected icon with initials as fallback.
3. **Rationale:** Requiring the current password protects an already-open session from silently changing credentials. A controlled icon set avoids unsafe arbitrary uploads while giving students visible identity in the portal.

### Planned / not yet built (student)
- **Online payment** - no processor wired (checklist ⬜).
- **DM entry point on the student dashboard** - inbox works but no dashboard contact card to *initiate* from (memory `project_pending_student_dm_entry`).

---

## Parent

### Dashboard
1. **What it is** - The child's Overview: attendance, homework handed in, mastery and outstanding balance tiles; the next lesson with "Can't make it?"; overdue and due-this-week homework; recent tutor recaps; payments; announcements; contacts.
2. **How it works** - `/parent` (`src/app/parent/page.tsx`). Attendance uses `attendanceSummary` (moved lessons are not absences), homework `homework-rules`, mastery `getSubjectMastery` (`src/lib/topic-mastery-data.ts`), the next lesson `nextAttendingLesson` over `buildTimetableChips`, recaps the shared lesson recap. Guard: `requireRole("parent")`.
3. **Rationale:** The Overview summarises and routes; each block links to the page that does the work (consistency audit, 18 October 2026). Recaps come only from family-visible note fields (`src/lib/lesson-recap.ts`); internal notes never leave the database.

### Child switcher
1. **What it is** - Switch the whole parent view between linked children; the choice is remembered.
2. **How it works** - `ChildPicker` in the glass portal shell. `resolveSelectedChild` reads `?child=` or the `taiyo_parent_child` cookie (`src/lib/parent-child.ts`) and only accepts a linked child. Parent notification links carry `?child=`. Guard: `requireRole("parent")` + `family_links` ownership.
3. **Rationale:** A parent with several children used to land on the first child from the menu and from notifications (consistency audit item 10).

### Classes (calendar + attendance + reschedule)
1. **What it is** - The child's Timetable: the shared calendar with the reschedule and cancel entry points.
2. **How it works** - `/parent/timetable` renders the student's `InteractiveTimetable` for the selected child (`?lesson=` opens on a lesson; past lessons link to their recap). `/parent/classes` redirects here with its query; `/parent/classes/[classId]` redirects to the subject page. Tables: `lessons`, `attendance`, `rescheduleRequests`. Guard: `requireRole("parent")` + child ownership.
3. **Rationale:** One shared timetable for student, parent and admin (consistency audit items 13 and 27); "Timetable" is the students' word for it.

### Reschedule a class
1. **What it is** - A parent can move an eligible upcoming lesson for a linked child into an available slot with the same tutor.
2. **How it works** - The shared timetable calls `submitReschedule` in `src/app/_actions/reschedule.ts`. The server enforces linked-child ownership, a seven-day notice period, the term allowance, an unused live slot, and the same tutor before it creates the isolated make-up lesson. The move executes directly; the old tutor approval queue is retired. Tables: `rescheduleRequests`, `lessons`, `attendance`. Guard: `requireRole(["student_unrestricted", "parent"])` plus linked-child ownership for a parent.
3. **Rationale:** Student and parent self-service share one implementation so eligibility, allowance, attendance isolation, and notifications cannot drift between portals. Office intervention remains available when no eligible slot exists or a gate fails.

### Homework view (read-only)
1. **What it is** - The child's homework board and a read-only page per task.
2. **How it works** - `/parent/homework` is the student's board (`src/components/homework/homework-board.tsx`); `/parent/homework/[id]` shows the submission, mark, rank and full feedback through the shared `homework-detail.tsx` (linked children only). Status follows `src/lib/homework-rules.ts`: a late hand-in is handed in; overdue means not handed in after the due day. Guard: `requireRole("parent")` + child ownership.
3. **Rationale:** One homework rule and one view for every role (consistency audit item 3).

### Tutor feedback feed
1. **What it is** - The child's lesson recaps.
2. **How it works** - `/parent/feedback` lists recaps and `/parent/feedback/[lessonId]` opens one, through the shared `LessonRecap` (`src/components/lessons/lesson-recap.tsx`) and `src/lib/lesson-recap.ts`, which selects only the family fields of `src/lib/lesson-note-fields.ts` (Topic covered, Performance, Strengths, Struggled with, Next lesson focus, Comment). A note counts as a recap when any of those is filled. Guard: `requireRole("parent")`.
3. **Rationale:** The same recap the student sees, in the tutor editor's words; before, parents saw only notes with a comment (consistency audit item 11). `internal_note` is never selected.

### Progress page
1. **What it is** - The student's Progress view for the selected child: term picker, average score, recent marks, test rank, topic mastery and term reports.
2. **How it works** - `/parent/progress` and `/parent/progress/[id]` reuse the student progress panes. Mastery comes from marks (`src/lib/topic-mastery.ts`: average of marked homework and latest quiz attempts in each topic's weeks; "No marks yet" otherwise); `progress_topics` is no longer read. Guard: `requireRole("parent")` + child ownership.
3. **Rationale:** Parents are the ones told "Term report ready"; the parent page was a thinner copy (consistency audit items 5 and 14).

### Subject deep-dive (curriculum, read-only)
1. **What it is** - One page per subject: the student's subject page (read-only) plus the child's attendance and tutor recaps for that class.
2. **How it works** - `/parent/subjects/[id]` (`/parent/subjects` opens the first subject; Subjects is in the parent menu). The parent can open materials without ticking them off for the child. Guard: `requireRole("parent")` + child-enrolment scope; `notFound()` on failure.
3. **Rationale:** One home per subject instead of three pages (consistency audit item 27). `notFound()` (not 403) avoids leaking subject existence (per `docs/superpowers/specs/2026-05-30-subject-curriculum-design.md`).

### Payments
1. **What it is** - The family's invoices (read-only), the same view students with billing access get.
2. **How it works** - `/parent/payments` renders `FamilyInvoices` (`src/components/invoices/family-invoices.tsx`) with `summarizeInvoices` (`src/lib/invoice-rules.ts`): an open invoice past its due date is overdue without anyone setting it; dates are Melbourne days (`src/lib/invoice-dates.ts`); "Message the office" opens the office conversation (`src/lib/office-contact.ts`, active admins only). Guard: `requireRole("parent")`.
3. **Rationale:** Families saw "Overdue 0" while admins saw overdue invoices (consistency audit item 2). Read-only - no processor wired (checklist ⬜ "Online payment").

### Direct messaging
1. **What it is** - 1:1 DMs with the child's tutors and the admin office.
2. **How it works** - `/parent/messages` (+ `[threadId]`, `with/[userId]`).
   Tables `dmThreads`/`dmMessages`/`dmReads`; inbox queries exclude threads with no messages.
   Parent↔Tutor is allowed only when the tutor teaches a class the child is enrolled in (`family_links → enrollments → classes.tutorId`).
   Guard: `requireRole("parent")` + `canDM`.
3. **Rationale:** DM replaces scattered SMS/email/WhatsApp with a centralized channel; parent↔tutor requires a live shared-class relationship, but an existing thread stays readable if the relationship later lapses (humane, no surprise data loss) (per `docs/superpowers/specs/2026-05-27-direct-messaging-design.md`).

### Notifications inbox
1. **What it is** - In-app notification inbox.
2. **How it works** - `/parent/notifications` (`NotificationsInbox`). Table `notifications`. Guard: `requireRole("parent")`.
3. **Rationale:** The inbox is the authoritative channel. A parent receives email only when included in an urgent targeted announcement and the Resend transport is configured.

### Resource Library (read-only mirror)
1. **What it is** - Read-only mirror of the student resource library, scoped to the selected child's enrolled subjects.
2. **How it works** - `/parent/resources`. Reads via `listResourcesForSubjects` scoped to `childSubjectIds(parentId)` (`src/lib/resources.ts`). Opening a file mints a short-lived signed URL via `openResourceForParent` (`src/app/_actions/resources.ts`); links open the validated `externalUrl` directly. Guard: `requireRole("parent")` + child-enrolment scope, backstopped by RLS on `resources`.
3. **Rationale:** Same subject-scoping rationale as the student view - a parent only ever sees resources for subjects their linked child is actually enrolled in, never another family's materials (per `docs/superpowers/specs/2026-07-23-resource-library-design.md` §Security, and PRD cross-cutting non-negotiable that parents see only their children's data).

### Planned / not yet built (parent)
- **Online self-service credit purchase** - reschedule allowances and class credits exist, but there is no payment flow for purchasing extra credit.
- **Online payment** - stub link only, no processor (checklist ⬜).

---

## Tutor

### Class timetable
1. **What it is** - Dashboard plus a monthly grid of the tutor's classes, recurring availability, and absence/leave requests.
2. **How it works** - `/tutor` dashboard, `/tutor/classes` (weekly snapshot), `/tutor/timetable` (schedule, availability, and absence hub). Tables: `classes`, `lessons`, `tutorAvailability`. Guard: `requireRole("tutor")`.
3. **Rationale:** Consolidated 2026-06-03 - previously split across `/tutor/schedule` + `/tutor/availability` (per `docs/checklist.md` Tutor "Class timetable").

### Tutor availability
1. **What it is** - One scheduling hub for recurring weekly hours, class absences, and extended leave.
2. **How it works** - `/tutor/timetable` uses a wide slide-over with full day/time fields rather than hour pills. Weekly windows are stored as hourly `tutorAvailability` rows (`weekday`). The same page posts an assigned-class absence or submits extended leave through a second wide slide-over. Admin reads and may edit the same rows at `/admin/tutors/availability` or on the tutor's user profile; the Classes page links to this board for cross-checking before class creation. `getAvailableSlots` (`src/lib/availability.ts`) consumes the saved availability for make-up/reschedule slots. Guard: `requireRole("tutor")` + `tutor_id = me`.
3. **Rationale:** The tutor-facing one-date/isolation control was removed because an actual inability to teach belongs in the absence/leave workflow, where admin receives notification. Class creation currently does not automatically reject a tutor outside these recurring hours, so admin reviews the shared availability board before choosing the tutor; automatic allocation guidance remains a separate scheduling feature.

### Tutor leave & cover board
1. **What it is** - Tutors post one class they cannot teach or request multi-day leave, with a private reason and an optional handover note. Extended leave needs admin approval; approval publishes each affected class to a board where any active, non-conflicting tutor can claim it.
2. **How it works** - "Request time away" on `/tutor/timetable` (`?panel=leave` opens it); the page's Time away list (`#time-away`) is the one home for the tutor's own leave and posted classes, with Cancel request on pending leave and unclaimed single classes (`cancelTutorCoverRequest`, which tells admins; a cancelled lesson can be posted again, reusing its row). `/tutor/cover` lists other tutors' requests and the ones you are covering, showing only "From <name>: <handover note>" (migration 0071). The tutor badge and Today count only covers this tutor can take (`fitsFor`). Admins work it on Cover & leave.
3. **Rationale:** The leave reason ("surgery") used to be copied onto every cover request and shown to all tutors (consistency audit item 7). Multi-day leave is an approval envelope while each lesson is independently claimable and auditable.

### Weekly check-in and payroll
1. **What it is** - A weekly record of scheduled work that tutors approve or dispute, with owner-only correction and pay reconciliation.
2. **How it works** - `/tutor/checkin` opens on the oldest week still to confirm (`pendingCheckinWeeks`, tested), with a nav badge and a Today row pointing there; it creates one `tutorWeeklyCheckins` row per tutor/week and synchronizes lesson-backed `tutorCheckinEntries` until approval. `/admin/tutor-checkins` is owner-only and filters by week, tutor, and class.
3. **Rationale:** Payroll uses an auditable snapshot rather than recalculating already approved pay from mutable schedules or rates. The page used to open on the current week, so missed weeks went unnoticed (consistency audit item 26).

### Homework marking
1. **What it is** - Create homework, upload worksheets and solutions, mark submissions, record scores/feedback, and request resubmission.
2. **How it works** - Tutors create class homework inside `/tutor/classes/[id]/curriculum` and manage it at `/tutor/homework/[id]`.
   Access follows the class's current tutor (`tutorHomeworkFilter`, `src/app/tutor/_lib/homework-access.ts`, and RLS from migration 0070), so a class handed to another tutor brings its homework with it; homework without a class stays with its author.
   The To mark queue is grouped by class with counts; class cards and Week plan rail weeks show "N to mark".
   Homework attachments, solutions, and supported student submission files open in the shared in-portal viewer.
   Marking writes `homeworkAssignments` (`score`, `feedback`, `status`, `markedBy`).
   The tutor dashboard's `Students to bump` action reloads current overdue tasks server-side and writes a task-specific DM plus one unread inbox notification.
   Guard: `requireRole("tutor")`, class-tutor scope, current-enrolment scope, DM relationship checks, and a per-tutor rate limit.
3. **Rationale:** A tutor change used to strand homework with the old tutor (the new one got a 404; consistency audit item 6). Migration 0070 also fixed RLS recursion that made the homework tables unreadable through the API for every non-admin.

### Lesson notes (parent-visible + internal split)
1. **What it is** - Per-student lesson notes with a strict split between a parent-visible comment and an internal-only note.
2. **How it works** - `/tutor/notes`, `/tutor/lessons/[id]`. Table: `lessonNotes` (`parentVisibleComment` vs `internalNote`, plus `topicCovered`/`strengths`/`struggles`/`nextLessonFocus`). Students/parents read via the `lesson_notes_safe` view. Guard: `requireRole("tutor")`.
3. **Rationale:** The parent-visible/internal split is enforced at the database layer: the `lesson_notes_safe` view (migration 0003) omits `internal_note`, so students/parents structurally cannot read it (per security-checklist A3). Lesson-notes split is a PRD cross-cutting non-negotiable.

### Attendance marking
1. **What it is** - Mark per-lesson presence/late/absent/left-early with a staff-only note.
2. **How it works** - `/tutor/lessons/[id]`. Table: `attendance` (`attendanceStatusEnum`, `markedBy`). Guard: `requireRole("tutor")` + lesson ownership; the roll and the students a save may touch come from `getLessonRoll` / `lessonRollIds`, as for admin. `attendance.note` is read only for tutors and admins; migration 0065 also withholds the column from the `authenticated` role, so a student or parent cannot read it through the public API.
3. **Rationale:** `Rationale: not documented.`

### Student profile
1. **What it is** - Per-student history for students the tutor teaches: one Lessons timeline, homework and quizzes.
2. **How it works** - `/tutor/students/[id]`. The Lessons tab (`?tab=attendance` and `?tab=notes` still work) lists each lesson with its mark ("Moved" for moves), the roll note, every note field under the editor's two labels from `src/lib/lesson-note-fields.ts`, "Written by", and Edit or Add note. Notes are scoped to the tutor's current classes plus their own; another tutor's internal note is never sent. Guard: `requireRole("tutor")` + shared-class scope.
3. **Rationale:** The profile used to show only the comment and internal note (consistency audit item 15). The admin student profile has its own History tab (`src/components/student-history`); unifying the two is recorded as an open parity item.

### Curriculum sections (per-tutor additive)
1. **What it is** - A tutor can add a note + file attachments to any week of a subject they teach, layered on top of the locked admin base, visible only to their own students.
2. **How it works** - `/tutor/classes/[id]/curriculum` mirrors the learner hierarchy with a subject-coloured Overview, separate lesson materials, tutor notes, quiz, and homework.
   Tutor note editing is opt-in and the shared new-homework form remains collapsed until requested.
   Tutors can add a separately stored solution from the homework marking page.
   Tables: `tutorWeekSections` (unique `(tutorId, subjectWeekId)`), `tutorWeekAttachments` (`kind` = file/link, migration 0015), and `homework`.
   Guard: `requireRole("tutor")` + class/homework ownership.
3. **Rationale:** Scoped per-`(tutor, subject-week)` (shared across all that tutor's classes of the subject, separate from other tutors) so additions are *additive* and never mutate the admin's locked base curriculum; this replaced the retired `class_week_overrides` "replace the base" model, which contradicted "base is locked" (per `docs/superpowers/specs/2026-07-01-tutor-sections-design.md`). Reads are scoped to the tutor's own students/parents at the query layer (commit `ed02764`).

### Discussions
1. **What it is** - Per-subject Q&A boards for subjects the tutor teaches, plus the Admin/Tech board.
2. **How it works** - `/tutor/discussions` (+ `[boardId]`, `[boardId]/[threadId]`). Tables: `discussionThreads`, `discussionReplies`. Board visibility scoped via `classes.tutorId = me`. A reply writes a `discussion_reply` notification to the thread author. Guard: `requireRole` + board membership.
3. **Rationale:** `lastActivityAt` is a denormalized column on the thread so boards sort by recent activity via an indexed read instead of subquerying each thread's newest reply on every load - standard forum pattern (per `docs/superpowers/specs/2026-05-27-discussions-design.md`). One unread ping per thread (not per reply) to avoid noise (same spec).

### Direct messaging
1. **What it is** - 1:1 DMs with admin, the tutor's students, and parents of taught students.
2. **How it works** - `/tutor/messages` (+ `[threadId]`, `with/[userId]`).
   `canDM` allows tutor↔student and tutor↔parent only on a shared class.
   Inbox queries exclude threads with no messages, so an unopened draft never appears as a conversation.
   Guard: `requireRole("tutor")` + `canDM`.
3. **Rationale:** Relationship clauses reuse existing joins (`classes.tutorId → enrollments`, `→ family_links`); same-role pairs are always denied (no tutor↔tutor) (per `docs/superpowers/specs/2026-05-27-direct-messaging-design.md`).

### Notifications inbox
1. **What it is** - In-app inbox.
2. **How it works** - `/tutor/notifications` (`NotificationsInbox`). Table `notifications`.
3. **Rationale:** The inbox is authoritative; only urgent targeted announcements use the optional email transport.

### Profile photo and icon
1. **What it is** - Tutors can upload a profile photo or choose a controlled icon from the profile page reached through the top-right profile chip.
2. **How it works** - `/tutor/profile` uses `ProfilePhotoUploader` and `ProfileIconPicker`.
   Photos are validated as JPEG, PNG, or WebP up to 5 MB, stored in the private `profile-photos` bucket, and rendered through a short-lived signed URL.
   Uploading a photo clears the icon choice; choosing an icon removes the stored photo.
   The shared tutor shell renders the photo first, then the selected icon or initials as fallback.
3. **Rationale:** Staff can use a recognisable photo while private storage, server-side role checks, strict image validation, and replacement cleanup prevent public or abandoned uploads.

### Resource Library (author + promote)
1. **What it is** - Add a resource (booklet, past paper, worksheet, video) to the subject-wide library by direct file upload or link, plus a "promote" toggle that publishes an existing weekly curriculum attachment straight into the library.
2. **How it works** - `/tutor/resources`; promote toggle lives on the weekly curriculum section editor (`/tutor/classes/[id]/curriculum`). `addResource` uploads to the private `resource-library` bucket (`uploadResourceFile`, `src/lib/resources-storage.ts`, validated by `RESOURCE_POLICY` in `src/lib/upload-validation.ts`) or validates a link via `httpHref` (`src/lib/safe-url.ts`); `promoteAttachment` creates a `resources` row referencing the existing `tutorWeekAttachments` object (`sourceAttachmentId`) rather than re-uploading it. Both actions are in `src/app/_actions/resources.ts`, scoped to `taughtSubjectIds(tutorId)` via `assertCanAuthor`. Guard: `requireRole(["tutor","admin"])` + taught-subject check for tutors (admins pass unconditionally).
3. **Rationale:** Promoted resources reference the source attachment instead of copying it, so `removeTutorWeekAttachment` (`src/app/tutor/_actions.ts`) blocks deleting a weekly attachment that's been promoted to the library - otherwise the published resource would silently 404 (per `docs/superpowers/specs/2026-07-23-resource-library-design.md` §Add / promote flow, "File-lifecycle rule"). Instant-publish (no pre-approval queue) was chosen over gating every tutor upload behind admin sign-off, trading a moderation step for tutor velocity - admin oversight happens after the fact via unpublish/remove (same spec §Decisions).

### Planned / not yet built (tutor)
- **Forward-looking lesson plan** - only retroactive `lesson_notes.nextLessonFocus` exists (checklist ⬜).
- **Class-recording auto-upload pipeline** - no upload pipeline or Storage bucket for automatically capturing class recordings; resource library video entries are added manually (checklist ⬜ "Upload videos").

---

## Admin

### Operations dashboard
1. **What it is** - The admin home: one To do row per live queue, the weekly calendar, students to watch, recent activity and announcements.
2. **How it works** - `/admin` (`src/app/admin/page.tsx`, `_lib/dashboard-queries.ts`, `_lib/admin-queues.ts`). To do rows: cover requests (with how many start within 48 hours), attendance to mark and notes missing (`getQueueBacklog`, the Attendance queue's own predicates, no cutoff), tutor leave, class moves, quizzes to review, tutor announcements, overdue invoices (by due date), and the owner's check-ins. The sidebar badge uses the same queue function. "Students to watch" reads `watch-signals.ts` and links to the student's History tab.
3. **Rationale:** The dashboard counted a retired approval flow, missed cover, leave, quizzes and class moves, and disagreed with the Attendance queue (20 vs 39 vs a real 163; consistency audit items 4, 16 and 19).

### User management + account creation
1. **What it is** - Search, create, edit, deactivate, reset, and permanently delete accounts, including optional same-step linked-parent creation for a student.
2. **How it works** - `/admin/users`, `/admin/users/[id]`. Actions in `src/app/admin/_lib/actions-users.ts` keep `profiles.email` and `auth.users.email` synchronized through the server-only Supabase admin client. The directory exposes subject/delivery/status badges, linked family, admin-only quick notes, configurable subject aliases, and owner-protected destructive actions. The global `Command/Ctrl+K` or `/` search opens portal destinations and routes user/class/subject queries into the permission-filtered directory. Guard: `requireAdmin()` with separate owner checks for privileged roles, admin accounts, payroll data, and permanent deletion.
3. **Rationale:** `createAdminClient()` (service-role) is used *only* here for `auth.users` CRUD, where RLS-bypass is genuinely required, and is `server-only`-guarded. Reception can manage operational student/parent/tutor records, but cannot create privileged accounts, change roles, or edit/reset/deactivate any admin account. Those boundaries are repeated inside server actions; hidden or disabled controls are not treated as authorization.

### Family links editor
1. **What it is** - Editor for parent↔child relationships on the user detail page.
2. **How it works** - On `/admin/users/[id]`. Table: `familyLinks` (`is_primary_contact`). Guard: `requireAdmin()`.
3. **Rationale:** Parent-child account linking is a first-class concept per the PRDs. The family-link manager can mark one linked parent as the student's primary contact; setting one clears any previous primary link.

### Class management
1. **What it is** - Create, edit, and delete class slots (subject, tutor, capacity, type, room, recurrence).
2. **How it works** - New class on `/admin/classes`; editing on each subject's edit page `/admin/subjects/[id]/edit` (`/admin/classes/[id]` redirects to the class's card there). Table: `classes` (`classTypeEnum` group/one_on_one); the room is `classes.location`, and an online class is one whose room is "Online". Both forms pick the room with `RoomPicker`: a list of the rooms in use, then "Online" and "Other…" (a text box); a room another weekly class uses at an overlapping time reads "· taken" and cannot be picked (`roomChoices` and `roomTaken` in `src/app/admin/classes/_lib/rooms.ts`). A class stays in the subject it was created in. A one-on-one class has exactly one place and one student (`src/lib/class-capacity.ts`, constraint `classes_one_on_one_capacity` from migration 0066); a group's capacity is a warning on the card and a hard limit for make-ups and class moves. Guard: `requireAdmin()`.
   Every class edit goes through `applyClassEdit` (`src/app/admin/_lib/class-writes.ts`) and carries the change to the upcoming lessons (`planClassScheduleChange` in `src/lib/class-schedule-change.ts`, tested), under the same advisory lock as the lesson sweep.
   Each lesson moves to the new day in its own Monday-first week at the new time; one that would land in the past is removed unless something points at it. A week holding two weekly lessons keeps one, so lessons doubled by an edit before 16 October 2026 clean up on the next save. Tutor and room follow the class unless a lesson has its own (a cover tutor).
   A class named "<Subject> · <Day> AM|PM" is renamed when its day or time moves; custom names are kept.
   A new day, time or room tells the tutor, the enrolled students and their parents ("Year 9 Maths moves to Room 3 from Thu 22 Oct."); a new tutor tells both tutors. Name or colour changes send nothing.
   Delete (`delete-class-button.tsx`, `deleteClass`) always confirms. While any lesson has attendance, notes or marks the class is blocked ("This class has history"); "Review N lessons" opens `/admin/attendance?class=<id>&view=marked`, where each lesson that has started can be deleted from its page ("Delete lesson", `deleteLesson`). Once none are left the normal "Delete this class?" dialog appears. The rule is enforced in the server action too.
3. **Rationale:** `classType` is an explicit enum column, *not* inferred from capacity, because the reschedule routing depends on it (1-on-1 always needs approval; group depends on timing) (per role-tiers spec §8 / reschedule spec). Edits move existing lessons rather than regenerating them, so bookings, covers, and cancellations stay attached. Classes with a record cannot be deleted in one step so attendance is never lost by accident (admin edit handoff, 16 October 2026).

### Subject management
1. **What it is** - Add, rename, recolour, re-level and delete subjects, and edit all of a subject's classes in one place.
2. **How it works** - Classes → Subjects: "Add subject" opens a side panel (`subject-panel.tsx`); each subject's pencil opens `/admin/subjects/[id]/edit` (`subject-edit-form.tsx`, actions in `src/app/admin/_lib/actions-subjects.ts`).
   The edit page (handoff `taiyo-admin-classes-edit-2.zip`, 18 October 2026) has the subject in one row (name, level from a fixed list that keeps any older custom value, colour, Open curriculum), then the classes with one open at a time (`class-editor.tsx`): the open class has its name as an editable title, Day, Time as one field of two dropdowns (`time-range-field.tsx` with `TimeSelect`, 15-minute steps; typed time boxes lost their value in Safari), Tutor (ranked, amber when not free), Room, Type, Capacity, Students (an Add a student search, `student-search.tsx`, and one line per student with Withdraw on hover, always shown on touch screens) and the change notice; every other class is a one-line row that opens it. Delete subject is a red link under the classes. One "Save changes" saves everything in one transaction (`saveSubjectPage`), and a class with an error opens. Subject names may repeat (17 October 2026), so the handoff's "name is taken" error does not apply.
   The colour is one of ten palette keys stored in `subjects.color` (migration 0063: teal, violet, blue, rose, amber, red, green, cyan, navy, slate); `subjectTone(name, color)` in `src/lib/subject-tone.ts` is the only colour source for every role, and a subject with no stored key takes one from its name.
   Delete subject works even when its classes have run, behind a dialog listing the classes and lessons with attendance, curriculum weeks, homework and marks, and students whose progress is lost, with the name typed to confirm (checked on the server too). Invoices are kept: they reference only people.
3. **Rationale:** A fixed palette rather than a free colour picker keeps every pairing readable (each key's text and fills are contrast-tested). Stored files (booklets, videos, resource files) are not removed from storage when a subject is deleted, matching the other deletes; the same path can be shared by several rows.

### Enrolment management
1. **What it is** - Onboard/move/withdraw students into classes.
2. **How it works** - Each class card on `/admin/subjects/[id]/edit` adds and withdraws students (`class-students.tsx`), staged until Save changes. Permanent class moves are handled from the student's `/admin/users/[id]` lesson panel. Table: `enrollments` (`withdrawnAt`). Guard: `requireAdmin()`.
3. **Rationale:** Operational notes (`T3INV`, `MOVE CLASS BY NW`, holiday markers) live in the account's internal note (`profiles.adminNotes`, migration 0053), which follows the student between classes. The per-enrolment note and the per-student delivery mode were removed on 18 October 2026 (owner decision, migration 0065): the note duplicated the account note, and the delivery mode only drew a pill on the tutor's roll.

### Attendance (admin)
1. **What it is** - Admin view to mark/inspect per-lesson attendance.
2. **How it works** - `/admin/attendance`, `/admin/attendance/[lessonId]`. Table: `attendance`. Guard: `requireAdmin()`. The roll is built by `getLessonRoll` (`src/lib/lesson-roll.ts`) and drawn by `src/components/attendance/attendance-row.tsx`, both shared with the tutor lesson page. Who is on a roll, and who either save action accepts, is `lessonRollIds`: the class's current students (never on a make-up lesson, which is a private booking), anyone rescheduled into the lesson, and anyone with attendance on it (a credit make-up, or a student who has since left).
3. **Rationale:** `Rationale: not documented.` The attendance note is staff-only (owner decision, 18 October 2026): parents see each lesson's status, not the note.

### Payment management
1. **What it is** - Create and manually edit invoices, including linked family, amount/currency, due date, description, status, and payment date.
2. **How it works** - `/admin/payments` (`_components/`). Parent selection constrains the student choices to linked children; paid/refunded states preserve an explicit payment date. Invoice mutations run with actor attribution into the audit log. Table: `invoices` (`invoiceStatusEnum`, `paidAt`). Guard: `requireAdmin()`. **Not** behind the PIN wall.
3. **Rationale:** Individual invoice/payment status is deliberately *not* PIN-walled - daily ops (reception marking cash) need it; the wall covers only revenue aggregates (per `docs/superpowers/specs/2026-07-12-admin-pin-wall-design.md` §Scope). Payment model is free-trial → payment; no refunds/discounts (same spec).

### Revenue (PIN-walled)
1. **What it is** - A dedicated page showing this/last-month cash received and overdue outstanding, gated behind a separate admin PIN (step-up auth).
2. **How it works** - `/admin/revenue` (`src/app/admin/revenue/page.tsx`, nav Insight → Revenue). Server component returns the PIN prompt *before* any query if `!isAdminUnlocked()`. Queries `getRevenueSummary` (cash bucketed by `paidAt`) + `getRecentPayments` (`admin/_lib/queries.ts`). Table: `admin_settings` (`pin_hash`, `failed_attempts`, `locked_until`; migrations 0020/0021). Lock logic in `src/lib/admin-lock.ts` (scrypt hash + HMAC-signed httpOnly `admin_unlock` cookie, ~30 min, user-bound). Actions in `actions-security.ts` (`setAdminPin`, `unlockAdmin`). PIN set/changed at `/admin/settings`. Guard: `requireAdmin()` + PIN unlock.
3. **Rationale:** The PIN wall gates financial figures on `/admin/revenue`: the owner bypasses it and reception must unlock it. Separate role-tier controls protect account security-reception cannot create privileged users, change roles, manage admin accounts, or change the shared PIN. Revenue values are never queried or rendered before the viewer passes the relevant gate. Lockout remains 5 misses followed by 15 minutes.

### Admin settings (PIN)
1. **What it is** - Set or change the admin PIN.
2. **How it works** - `/admin/settings` (`_components/`). `setAdminPin({ current?, next })` scrypt-hashes into `admin_settings.pin_hash`. Both the page and mutation use `requireUnrestrictedAdmin()`.
3. **Rationale:** The wall stays *open* until a PIN is set (no accidental lockout on first deploy) (commit `1744333`). PIN is 6–8 digits (commit `53a6aad`).

### Announcements
1. **What it is** - Announcements with combinable role, subject, year, class, and tutor audiences, plus approval of tutor-authored class announcements.
2. **How it works** - `/admin/announcements` resolves exact recipients through `src/lib/announcement-targeting.ts`. Tutor submissions originate from the class curriculum, remain `pending`, and notify all active admins; approval publishes only to the class students and optionally their linked parents, while rejection records a reason for the tutor. Urgent published announcements queue one email delivery row per resolved recipient and use `src/lib/announcement-email.ts` with retry/idempotency safeguards when Resend is configured. Guard: `requireAdmin()`; tutor creation is ownership-scoped.
3. **Rationale:** Combinable filters avoid maintaining a long ambiguous audience dropdown. Recipient rows are resolved once and deduped so in-app and urgent-email delivery target the same audience without broad role leakage.

### Reschedules & tutor cover (admin)
1. **What it is** - "Cover & leave" in the menu: tutor leave approval, open/claimed class cover, family class-move requests, and read-only credits and term usage.
2. **How it works** - `/admin/reschedules` (URL unchanged) with tabs Cover, Leave, Class moves (approve/decline with the card the student profile also uses), Credits (each credit's type, and for a "No slot available" credit the family's own reason, `class_credits.request_reason`, migration 0076) and Term usage (names open the student's Credits tab). Admin cover cards show the tutor's private reason and the handover note. Moving a lesson or granting a credit happens on the student's profile.
3. **Rationale:** The old "Reschedules" label promised something the page did not hold, and family class-move requests had no queue (consistency audit items 16 and 18).

### Curriculum & terms management
1. **What it is** - Define terms, subject topics, the canonical week-by-week curriculum, quizzes, and class homework.
2. **How it works** - `/admin/terms`, reached from Classes via `Manage terms`, includes a direct `Back to classes` link.
   `/admin/subjects/[id]/curriculum` contains the subject curriculum.
   Admin may save homework as subject-only curriculum material before any class exists.
   Selecting a class assigns active students and keeps the class tutor responsible for marking, while `homework.createdById` records the admin creator.
   Admin can upload or replace a separate solution from the week, using the same shared solution editor as tutors.
   Admin can open supported homework files in the portal and can edit existing quizzes in every status, including approved quizzes.
   Curriculum quiz actions use the single label `Edit quiz` rather than presenting approved quizzes as preview-only.
   Existing weeks open in a learner-style reading view with a subject-coloured Overview and clear material cards.
   `Edit week` and `Manage topics` open focused side panels; a new-week route keeps the creation form visible until the first save.
   Tables: `terms`, `subjects`, `subjectTopics`, `subjectWeeks`, `homework`, and `homeworkAssignments`.
   Guard: `requireAdmin()`.
3. **Rationale:** `subjectWeeks.topicId` is nullable with `onDelete: set null` so adding topics is non-destructive (existing weeks stay valid) and deleting a topic never deletes curriculum content - weeks fall back to "unassigned" (per `docs/superpowers/specs/2026-06-30-curriculum-topics-design.md`). Topics are subject-level (not term-level) because a topic like "Algebra" spans weeks across any term (same spec).

### Discussions oversight
1. **What it is** - View every subject board and soft-delete any thread/reply.
2. **How it works** - `/admin/discussions` (+ `[boardId]`, `[boardId]/[threadId]`). Actions `softDeleteThread`/`softDeleteReply` set `deletedAt`. Guard: `requireAdmin()`.
3. **Rationale:** Only admins can soft-delete (authors cannot delete their own posts); soft-deleted content renders as `[removed by admin]` keeping the original author visible - an oversight/safeguarding surface (per `docs/superpowers/specs/2026-05-27-discussions-design.md`).

### Direct messaging (admin)
1. **What it is** - 1:1 DMs with anyone via a categorized directory.
2. **How it works** - `/admin/messages` (+ `[threadId]`, `with/[userId]`).
   The directory categorizes parents, tutors, and students; `/admin/users/[id]` provides the Message action.
   Inbox queries exclude empty threads until the first message is sent.
   `canDM` returns true for any admin↔non-admin pair.
   Guard: `requireAdmin()`.
3. **Rationale:** `getThreadForMe` scopes the admin messages UI to threads the admin *participates* in; RLS (migration 0012) permits admin read of all DMs, but no UI surfaces non-participant conversations - a safeguarding-oversight view would need an audit READ row + reason gate before exposing them (per security-checklist G3).

### Discontinued students
1. **What it is** - A directory status for deactivated accounts and students whose enrolments have all been withdrawn.
2. **How it works** - `/admin/users?status=discontinued` uses the Status filter on the single user directory. `directoryStatus` in `src/app/admin/_lib/queries.ts` derives the value from `profiles.isActive` and `enrollments.withdrawnAt`. Guard: `requireAdmin()`.
3. **Rationale:** The former standalone leaving page and separate directory tab were consolidated so admins search and manage every account in one place.

### Notifications inbox (admin)
1. **What it is** - In-app operational inbox with an urgent filter and visually prominent urgent rows.
2. **How it works** - `/admin/notifications` (`NotificationsInbox`). Table `notifications`; titles prefixed `URGENT:` drive the urgent presentation and bell state. Cover reminders deep-link to `/admin/reschedules#tutor-cover`. The secured daily cron also creates same-day free-trial notices for admin/assigned tutors and one post-trial admin follow-up. Migration 0044 adds a per-recipient dedupe key.
3. **Rationale:** Scheduled notifications are event notifications rather than passive state. Database uniqueness on `(user_id, dedupe_key)` makes cron retries and admin-triggered reconciliation safe without hiding legitimate alerts for a different lesson or later trial period.

### Reporting
1. **What it is** - Term-selectable operational reporting, CSV export, and term reports.
2. **How it works** - `/admin/reports` (Classes view) aggregates attendance (moved lessons are not absences; left early counts as attended), homework completion, average test result, enrolment and fill; `/admin/reports/export?term=…` emits the same rows as CSV. The Term reports view sends reports a class at a time with Sent / Not sent / No family linked per student (`term_report_issues`, migration 0068; `issueTermReport`, recipients by `src/lib/term-report-rules.ts`). Guard: `requireAdmin()`.
3. **Rationale:** Reports used to go out one student at a time with no record of who had one (consistency audit item 21).

### Resource Library (moderation)
1. **What it is** - Admin-wide moderation view of every resource across every subject, including unpublished and removed ones, with unpublish/republish/remove(with reason)/restore.
2. **How it works** - `/admin/resources`. Reads via `listAllResourcesForAdmin` (`src/lib/resources.ts`), unfiltered by subject scope. Actions `setResourcePublished`, `removeResource`, `restoreResource` (`src/app/_actions/resources.ts`) - all wrapped in `withActor` so mutations land in `audit_logs`. Guard: `requireAdmin()`.
3. **Rationale:** The model is **instant-publish + admin moderation**, not a pre-approval queue - tutors publish immediately and admin reviews/acts after the fact (unpublish, remove with a reason, restore), trading a moderation step for tutor velocity while keeping oversight (per `docs/superpowers/specs/2026-07-23-resource-library-design.md` §Decisions). Every moderation action is audited via `withActor`, consistent with the portal's audit-log non-negotiable (security-checklist G1).

### Planned / not yet built (admin)
- **Automatic subject/skill matching for replacement tutors** - the cover board intentionally permits any active tutor and blocks timetable clashes, but does not rank tutors by subject expertise.

---

## Cross-cutting

### Responsive portal layout
1. **What it is** - Phone-compatible navigation and content layouts across the admin, tutor, student, and parent portals without changing the established desktop presentation.
2. **How it works** - `src/components/portal/mobile-nav.tsx` provides a shared expandable phone menu while the existing role sidebars remain active at the desktop breakpoint.
   Shared shell spacing narrows only below the `sm` and `lg` breakpoints.
   Curriculum pages collapse the weeks rail behind `Choose a week` on phones.
   Seven-day calendars and wide data tables use local horizontal scroll regions, and file viewers use the full phone viewport while retaining their desktop modal dimensions.
3. **Rationale:** Dense portal navigation, seven-column calendars, and operational tables cannot remain readable when compressed into a narrow viewport.
   Local overflow and mobile-only disclosure preserve access to every control without changing desktop information density or hierarchy.

### Authentication
1. **What it is** - Supabase-backed login, password reset, and session handling.
2. **How it works** - `/(auth)/login`, `/(auth)/forgot-password`, `/(auth)/reset-password`, `/auth/callback`. `@supabase/ssr`; `getCurrentUser`/`requireRole` in `src/lib/auth.ts`. Post-login routing lands on the coarse-role home.
3. **Rationale:** Login routes to the *coarse-role* home (`/student`, `/admin`, …), not the raw tiered role - otherwise a `student_restricted` user was sent to a nonexistent `/student_restricted` and 404'd. The callback and login redirects are guarded against open redirects. Password setup/reset is implemented, but custom-SMTP delivery to a normal external inbox remains an acceptance item.

### Role model & tiered roles
1. **What it is** - Six-tier role enum (2 admin tiers, 2 student tiers, plus `tutor`/`parent`) with coarse-role bridging.
2. **How it works** - `userRoleEnum` in `schema.ts` (migrations 0017 add values, 0018 migrate rows + `app_metadata` + `is_admin()`). `src/lib/roles.ts`: `coarseRole`, `studentTier`, `ADMIN_TIERS`, `STUDENT_TIERS`. `requireRole` accepts a role *or a set*, and expands coarse "admin"/"student" to their tier families.
3. **Rationale:** The enum keeps all eight values so ~40 existing coarse comparisons and 81 `requireRole` call sites were untouched - coarse values survive as announcement audience targets + DM/discussion display prefixes (per `src/lib/roles.ts` comment / memory `project_role_tiers_spec1`). `student_restricted` is the **safe default**: only the explicit `student_unrestricted` value unlocks payments/reschedule/DM-admin, so the legacy `student` and `student_restricted` both mean parent-dependent (per `studentTier` comment in `src/lib/roles.ts`). The `is_admin()` SQL predicate changed from `= 'admin'` to `like 'admin%'`; this was flagged as the high-risk migration bit since a mistake breaks all admin access (role-tiers spec §3.1 / memory).

### Role-based routing & authorization
1. **What it is** - Middleware + per-layout guards enforcing which portal each role can reach.
2. **How it works** - `src/middleware.ts` + `src/lib/supabase/middleware.ts` gate `/admin/*` to any `admin_*`, `/student/*` to any `student_*`, etc. Per-page loaders and every server action call `requireRole`/ownership guards.
3. **Rationale:** The app layer is the real boundary - the Drizzle `db` connects as `postgres` and bypasses RLS, so `requireRole` + ownership checks are the primary control (verified present on every server action in the K3 review); RLS is defense-in-depth (per security-checklist C6/K3). Role is read from `app_metadata.role` **only** - never `user_metadata` - because `user_metadata` is user-mutable via `supabase.auth.updateUser()` and trusting it (even as a fallback) was a privilege-escalation path (per security-checklist B1/B2, migration 0002, commit `c16ddde`).

### Notifications
1. **What it is** - In-app notification inbox and unread badge for all four roles, with urgent presentation and optional urgent-announcement email.
2. **How it works** - `notifications` table; shared `NotificationsInbox`; `/{role}/notifications`; red unread counts in desktop/mobile shells. Opening a notification records it read. Workflow writers use recipient-specific dedupe keys where retry is possible. Published urgent announcements queue `announcementEmailDeliveries`; the Resend worker claims, retries, and records delivery attempts.
3. **Rationale:** The in-app inbox is authoritative and available even when external mail is unavailable. Email is limited to urgent targeted announcements; Supabase separately owns account/password Auth emails. DNS and Vercel variables are present, but custom-SMTP/real-inbox delivery remains unverified as of 6 October 2026.

### Row-Level Security (RLS)
1. **What it is** - RLS enabled on every public table as defense-in-depth.
2. **How it works** - Enabled via migrations 0004/0005/0012, policies through 0016. Deny-by-default (no client policies) on server-only tables (`reschedule_requests`, `math_game_scores`, `admin_settings`, `rate_limits`).
3. **Rationale:** RLS is *defense-in-depth*, not the primary control (that's app-layer `requireRole`) (per security-checklist C6). **Hazard:** `drizzle-kit push` disables RLS + drops every policy and the `lesson_notes_safe` view - migrations 0003–0016 must be re-applied after any push (per memory `reference_schema_apply_dbpush` and `docs/checklist.md`). This is why all RLS/view migrations are hand-written raw SQL and `db:generate`/`db:push` are avoided.

### Audit logs
1. **What it is** - Append-only audit trail of changes to admin-managed tables.
2. **How it works** - `auditLogs` table; DB triggers on `profiles`, `family_links`, `classes`, `enrollments`, `invoices`, `announcements` (migration 0006). Actor captured via `withActor()` (`src/lib/with-actor.ts`), which sets `request.jwt.claims` transaction-locally for the SECURITY DEFINER trigger. Never written by application code.
3. **Rationale:** Trigger-only (not app-written) so no mutation path can skip the log (per schema comment + security-checklist G1). `withActor` was added to attribute the acting admin - without it the trigger recorded a NULL actor; note `createUser`'s initial profile INSERT still logs NULL because it runs in the auth-trigger context (per security-checklist G1).

### Rate limiting
1. **What it is** - Backend rate limiting on login + write endpoints.
2. **How it works** - `rateLimits` table + `check_rate_limit()` function (migration 0014); read/written server-side only, RLS-locked with no policies (not queried via ORM).
3. **Rationale:** Added to harden login + write endpoints (per security-checklist B3/C4, commit `e56dd5f`). RLS-locked with no policies = deny-by-default for anon/authenticated (schema comment).

### Storage & file uploads
1. **What it is** - Private Supabase Storage for homework attachments/submissions, curriculum media, discussion attachments, and the resource library.
2. **How it works** - Buckets `homework-attachments`, `homework-submissions`, `curriculum`, `discussion-attachments`, and `resource-library`. Permission-checked server actions mint short-lived signed URLs. Upload validation lives in the storage/direct-upload helpers; database rows store object paths rather than public URLs. Supported PDFs, images, and videos render through in-portal viewers with an Open separately fallback.
3. **Rationale:** Private objects plus short-lived signed URLs keep student work and teaching material from becoming world-readable. Every replacement environment must create all five private buckets before runtime QA.

---

### Shared rules (one definition per number)
1. **What it is** - Every role computes these the same way, from one module each (consistency audit, 18 to 20 October 2026).
2. **How it works** -
   - Attendance: `src/lib/attendance-rules.ts` (`attendanceSummary`, `attendanceLabel`) with `attendanceMovedSql` (`src/lib/attendance-moved.ts`). Present, late, left early and make-up attended count as attending; an absence written by an approved reschedule or a credit cancellation is a move, left out of every rate and labelled "Moved".
   - Invoices: `src/lib/invoice-rules.ts`. Overdue means money owed and the due date passed; nothing has to set the status.
   - Homework: `src/lib/homework-rules.ts`. Handed in means submitted (on time or late), marked or returned; overdue means not handed in after the due day.
   - Lessons: `src/lib/lesson-progress.ts` (`describeLesson`) and `src/lib/lesson-progress-sql.ts` (`lessonRanSql`, `unmarkedOnRollSql`, `notesMissingSql`, `lessonCountFields`) for "ran", "to mark", "notes missing" and "needs finishing". `src/lib/lesson-roll.ts` decides who is on a lesson's roll for both rolls and both save actions, and shows a move's reason from its record.
   - Lesson notes: `src/lib/lesson-note-fields.ts` holds each field, its label and who sees it; the editor, the tutor timeline and the family recap read it.
   - Mastery: `src/lib/topic-mastery.ts` from quiz and homework marks.
   - Time: lesson starts are Melbourne wall times (`lessonStartInstant`), never `new Date(\`${date}T${time}\`)`, which reads the server's time zone (production runs in UTC); `formatDueDate` and `formatDateLong` of a moment format the Melbourne day; `?month=` uses `src/lib/month-param.ts`. Class times are picked with `TimeSelect` (`src/components/ui/time-select.tsx`), not typed time boxes, which lose their value in Safari.
3. **Rationale:** Each of these used to be computed two to four ways, so the same lesson, invoice or task read differently depending on who looked.

## Sources

- `checklist_beta_fix.md` (current production acceptance backlog)
- `docs/checklist.md` (historical/full inventory; last wholesale audit 2026-07-22)
- `docs/PRD_{Student,Parent,Tutor,Admin}_Portal.md`
- `docs/security-checklist.md`, `docs/SECURITY.md`
- `docs/superpowers/specs/`: role-tiers (2026-07-09), reschedule (2026-07-10), admin PIN wall (2026-07-12), math game (2026-07-12), direct messaging (2026-05-27), discussions (2026-05-27), subject curriculum (2026-05-30), curriculum topics (2026-06-30), tutor sections (2026-07-01)
- `src/db/schema.ts`, `src/lib/{auth,roles,dm-permissions,admin-lock,reschedule,availability,with-actor}.ts`
- git history + memory notes under `~/.claude/projects/.../memory/`
