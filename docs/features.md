# Feature Reference

A comprehensive, deploy-ready reference of every feature shipped in `tayio_portal`,
organized by role. Each feature documents three things:

1. **What it is** - plain-language summary.
2. **How it works** - routes, key files, `schema.ts` tables, server actions, guards.
3. **Rationale** - the reason behind a design choice, cited to an artifact
   (commit, spec, code comment, checklist, security-checklist, or memory note).
   Where no artifact documents the "why", it is marked **`Rationale: not documented`** -
   the motivation was not invented.

Backbone inventory: `docs/checklist.md` (last audit 2026-07-22). Status ticks from
that file are not repeated here; only shipped features are documented, with a
"Planned / not yet built" list per role for the rest.

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
3. **Rationale:** Subject-colour map renders Maths as red, which reads like a "cancelled" state; the interactive timetable deliberately sidesteps this with a brand tint (per memory `project_role_tiers_spec1_2026_07_10.md`).

### Homework (view + submit)
1. **What it is** - List of assigned homework with due dates; per-assignment detail with file/text submission, tutor feedback, and (for flagged tests) an anonymous rank.
2. **How it works** - `/student/homework`, `/student/homework/[id]`. Submission uploads to Supabase Storage via the API route `src/app/api/student/homework/[id]/submit/`. Tables: `homework`, `homeworkAssignments` (`submissionUrl`, `submissionText`, `score`, `feedback`, `status`). Test rank query `getStudentTestRank` uses a `RANK()` window over `homework.is_test` submissions. Guard: `requireRole("student")` + assignment ownership (`studentId = user.id`).
3. **Rationale:** Homework attachments are stored as a storage **path** (not a persisted public URL) and served through short-lived signed URLs (1h TTL); this keeps the `homework-attachments` bucket private so submissions aren't world-readable (per security-checklist E4/E5). Test ranking exposes *rank only* - no peer scores or names (per `docs/checklist.md` Student "Grade page").

### Progress / grades
1. **What it is** - Per-subject mastery, per-topic breakdown, and a detail page listing every submitted task's grade + tutor feedback, plus an overall anonymous per-subject rank.
2. **How it works** - `/student/progress`, `/student/progress/[id]`. Tables: `progressTopics` (mastery bands), `homeworkAssignments` (scores/feedback), `subjectTopics`. Overall rank via `getStudentOverallSubjectRank` (`RANK()` window). Guard: `requireRole("student")`.
3. **Rationale:** Ranking surfaces position only, never peer scores/names - avoids exposing classmates' academic data while still giving competitive signal (per `docs/checklist.md` Student "Grade page"). Note: the free-text `progress_topics` table is scheduled to be replaced by computed mastery in curriculum "Part 3" (per `docs/superpowers/specs/2026-06-30-curriculum-topics-design.md`).

### Subject deep-dive (curriculum)
1. **What it is** - Per-subject, week-by-week curriculum: recorded video, booklet, homework due that week, and completion progress, grouped by topic.
2. **How it works** - `/student/subjects/[id]` (`_queries.ts`, `_components/`, `_actions.ts`). Tables: `subjects`, `subjectTopics`, `subjectWeeks`, `studentWeekProgress`, `tutorWeekSections`/`tutorWeekAttachments` (the "From your tutor" block), `terms`. `markVideoWatched` / `markBookletOpened` server actions write `studentWeekProgress` and mint signed URLs. Guard: `requireRole("student")`; access scoped by an `enrollments` join. Permission failure returns `notFound()`.
3. **Rationale:** Permission failure returns `notFound()` rather than 403 so the portal does not leak the existence of subjects the student isn't enrolled in (per `docs/superpowers/specs/2026-05-30-subject-curriculum-design.md` §Permissions). Students see the locked admin base plus only *their enrolled class's tutor's* section - a student never sees another tutor's supplementary material (per `docs/superpowers/specs/2026-07-01-tutor-sections-design.md`).

### Lesson recap viewer
1. **What it is** - Read-only view of the parent-visible tutor note for a past lesson.
2. **How it works** - `/student/lessons/[id]`. Reads through the `lesson_notes_safe` view (migration 0003), never `lesson_notes.internal_note`. Guard: `requireRole("student")` + attendance/enrolment scope.
3. **Rationale:** Students read via the `lesson_notes_safe` view, which strips `internal_note`; internal tutor notes must never reach students or parents (per security-checklist A3 / migration 0003). Migration 0018 widened the view's admin predicate from `= 'admin'` to `like 'admin%'` so both admin tiers still bypass it (per role-tiers spec §3.1).

### Resources
1. **What it is** - Lists the student's recorded lessons pulled from real lesson data.
2. **How it works** - `/student/resources`, `/student/resources/[id]`. Sources recorded-lesson data from curriculum (`subjectWeeks.videoUrl`).
3. **Rationale:** `Rationale: not documented.` (This is a partial feature - there is no `resources` library table for booklets/past papers/uploaded videos; see "Planned / not yet built".)

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
2. **How it works** - `/student/messages`, `/student/messages/[threadId]`, `/student/messages/with/[userId]`. Tables: `dmThreads`, `dmMessages`, `dmReads`. Actions in `src/app/_actions/dm.ts`. Permission via `canDM` in `src/lib/dm-permissions.ts`. Guard: `requireRole("student")` + `canDM`.
3. **Rationale:** `student_restricted ↔ admin` is blocked symmetrically - a young student's admin contact is their parent - while `student_unrestricted ↔ admin` is allowed; this is the one tier-sensitive rule in `canDM` (per code comment in `src/lib/dm-permissions.ts` and role-tiers spec §5.2). Threads persist one-per-pair with canonical `userAId < userBId` ordering so pair lookup is a single equality (per `docs/superpowers/specs/2026-05-27-direct-messaging-design.md`).

### Payments (unrestricted only)
1. **What it is** - Read-only view of the student's own invoices and statuses.
2. **How it works** - `/student/payments` (`src/app/student/`). Reads `invoices WHERE student_id = me` via `getInvoicesForStudent`; balance via `getOutstandingBalanceForStudent`. Guard: `requireUnrestrictedStudent()` (`src/lib/auth.ts`, redirects `student_restricted`).
3. **Rationale:** Gated to `student_unrestricted` because only independently-enrolled/older students self-manage billing; restricted students' invoices are owned by the linked parent (per role-tiers spec §5.1). View-only: no payment processor is wired anywhere (same spec, "Note").

### Reschedule (unrestricted only)
1. **What it is** - Self-serve rescheduling of an upcoming lesson via the interactive timetable, routed to either a direct switch or a tutor/admin approval queue.
2. **How it works** - Initiated on `/student/timetable` (`interactive-timetable.tsx`); `submitReschedule` server action in `src/lib/reschedule.ts` + student `_actions`. Tables: `rescheduleRequests`, `lessons` (status `makeup`/`rescheduled`), `attendance` (`makeup_attended`). Slots come from `tutorAvailability` via `getAvailableSlots` (`src/lib/availability.ts`). Guard: `requireUnrestrictedStudent()` + lesson ownership.
3. **Rationale:** The model unified on **tutor-availability slots** (every reschedule is a per-student make-up at a tutor-free time); the original "switch to another group session" model was dropped after user testing (per memory `project_role_tiers_spec1_2026_07_10.md`, migration 0019, commit `30b6a37`). Routing: 1-on-1 always + group `<24h` need approval; group `≥24h` executes directly. A **second** reschedule of the same lesson always needs approval and supersedes the prior make-up (same memory note). `executeSessionSwitch`/`getGroupSwitchTargets` remain in the codebase but are now dead code (kept, unused).

### Math game ("Math Sprint" / "Math Blitz")
1. **What it is** - A Zetamac-style 60-second mental-math speed drill with five difficulty tiers, per-difficulty leaderboards, and a pick-your-sound reward.
2. **How it works** - `/student/math-game` (`page.tsx`, `_queries.ts`, `_actions.ts`, `_components/`). Table: `mathGameScores` (append-only; enum `mathGameDifficultyEnum` = sprint/easy/medium/hard/genius). `submitScore` validates with Zod + a per-tier plausibility cap. Leaderboard = `max(score)` per student per difficulty, name shown as first name + last initial. Question generator is unit-tested (vitest). Guard: `requireRole("student")` (both tiers).
3. **Rationale:** Available to *all* students, not gated by tier - it's an engagement feature with no academic weight (per `docs/superpowers/specs/2026-07-12-student-math-game-design.md` §Access). Sound plays via the Web Audio API (decoded buffers), not an `<audio>` element, because HTML audio lags too much for rapid-fire play (same spec §Sound). The plausibility cap is explicitly "a guardrail, not a guarantee" - full server-authoritative anti-cheat would require per-answer round-trips that latency-kill a reflex game (same spec). Purple arcade gradient is a deliberate identity break from the portal's cornflower theme (same spec §Visual identity).

### Notifications inbox
1. **What it is** - In-app inbox of notifications (DMs, discussion replies, reschedule updates).
2. **How it works** - `/student/notifications` (`NotificationsInbox` component). Table: `notifications`. Guard: `requireRole("student")` + `userId = me`.
3. **Rationale:** In-app only; no email transport is wired (per `docs/checklist.md` Cross-cutting "Email delivery").

### Planned / not yet built (student)
- **Online payment** - no processor wired (checklist ⬜).
- **DM entry point on the student dashboard** - inbox works but no dashboard contact card to *initiate* from (memory `project_pending_student_dm_entry`).

---

## Parent

### Dashboard
1. **What it is** - Overview of a child's attendance, homework, latest tutor feedback, payment status, and outstanding balance, with a contact block.
2. **How it works** - `/parent` (`src/app/parent/page.tsx`, `_lib/`). Reads `attendance`, `homeworkAssignments`, `lesson_notes_safe`, `invoices`. Child selection via `family_links`. Guard: `requireRole("parent")`.
3. **Rationale:** Feedback surfaced on the dashboard is parent-visible only (via `lesson_notes_safe`); internal tutor notes are excluded (per security-checklist A3 / migration 0003).

### Child switcher
1. **What it is** - Switch the whole parent view between multiple linked children.
2. **How it works** - Uses `familyLinks` (`parent_id`, `student_id`, `is_primary_contact`). `resolveSelectedChild` scopes queries to the chosen child. Guard: `requireRole("parent")` + `family_links` ownership.
3. **Rationale:** Parent-child linking is a first-class concept enforced by ownership checks so a parent only ever sees their own children's data (per PRD cross-cutting non-negotiables; strict role permissions).

### Classes (calendar + attendance + reschedule)
1. **What it is** - Combined per-child calendar, attendance log, and the reschedule entry point.
2. **How it works** - `/parent/classes` (attendance + bookings combined 2026-05-26); reschedule at `/parent/classes/reschedule/[lessonId]`. Tables: `lessons`, `attendance`, `rescheduleRequests`. Guard: `requireRole("parent")` + child ownership.
3. **Rationale:** `Rationale: not documented` for the combine-into-one-page decision (checklist notes the date but no "why").

### Reschedule a class
1. **What it is** - Parent picks a child's upcoming lesson, picks a slot from same-subject tutors, adds an optional reason; routed direct or to approval.
2. **How it works** - `submitReschedule` (`src/lib/reschedule.ts`), slots via `getAvailableSlots`. Tables: `rescheduleRequests`, `lessons`, `attendance`. Approvals surface to the tutor (`/tutor/reschedules`) and admin (`/admin/reschedules`). Guard: `requireRole("parent")` + linked-child check.
3. **Rationale:** Shares the exact same execution primitives and availability query as the student self-serve flow (unified on tutor-availability slots); notifications on reschedule go to tutor + linked parents + admin (per `docs/superpowers/specs/2026-07-10-reschedule-design.md`). Pending requests are deduped per student+lesson - only the latest survives (per memory `project_role_tiers_spec1_2026_07_10.md`).

### Homework view (read-only)
1. **What it is** - Track a child's homework completion, scores, and feedback.
2. **How it works** - `/parent/homework`. Reads `homework`/`homeworkAssignments` scoped through `family_links`. Guard: `requireRole("parent")` + child ownership.
3. **Rationale:** `Rationale: not documented.`

### Tutor feedback feed
1. **What it is** - Chronological feed of parent-visible tutor comments, with read/unread tracking.
2. **How it works** - `/parent/feedback` + "From the tutor" dashboard block. Reads `lesson_notes_safe` (`parentVisibleComment`). Read/unread stored in `localStorage`. Guard: `requireRole("parent")`.
3. **Rationale:** Only `parentVisibleComment` is fed through - `internalNote` is stripped by the `lesson_notes_safe` view (per security-checklist A3 / migration 0003). Deep-link to per-class detail is a known TODO - `/parent/classes/[classId]` doesn't exist yet (memory `project_pending_feedback_to_class_link`).

### Progress page
1. **What it is** - Per-child, per-subject mastery, topics, attendance, and homework summary.
2. **How it works** - `/parent/progress` (added 2026-05-26). Reads `progressTopics`, `subjectTopics`, `attendance`, `homeworkAssignments`. Guard: `requireRole("parent")` + child ownership.
3. **Rationale:** `Rationale: not documented.`

### Subject deep-dive (curriculum, read-only)
1. **What it is** - Read-only mirror of the student curriculum view, scoped to the selected child.
2. **How it works** - `/parent/subjects/[id]` (`_queries.ts`, `_components/`). Same tables as student subject view; parent cannot trigger watch/open tracking. Guard: `requireRole("parent")` + child-enrolment scope; `notFound()` on failure.
3. **Rationale:** Parent mirrors the child's *enrolled class's tutor's* section only (per `docs/superpowers/specs/2026-07-01-tutor-sections-design.md`); `notFound()` (not 403) avoids leaking subject existence (per `docs/superpowers/specs/2026-05-30-subject-curriculum-design.md`).

### Payments
1. **What it is** - View invoices and statuses (read-only).
2. **How it works** - `/parent/payments`. Reads `invoices WHERE parent_id = me`. Statuses use the fixed `invoiceStatusEnum` (unpaid/paid/overdue/partially_paid/refunded/cancelled). Guard: `requireRole("parent")`.
3. **Rationale:** Payment statuses are a fixed enum per the PRDs' cross-cutting non-negotiables (`invoiceStatusEnum` in `schema.ts`). Read-only - no processor wired (checklist ⬜ "Online payment").

### Direct messaging
1. **What it is** - 1:1 DMs with the child's tutors and the admin office.
2. **How it works** - `/parent/messages` (+ `[threadId]`, `with/[userId]`). Tables `dmThreads`/`dmMessages`/`dmReads`; `canDM` gate. Parent↔Tutor allowed only when the tutor teaches a class the child is enrolled in (`family_links → enrollments → classes.tutorId`). Guard: `requireRole("parent")` + `canDM`.
3. **Rationale:** DM replaces scattered SMS/email/WhatsApp with a centralized channel; parent↔tutor requires a live shared-class relationship, but an existing thread stays readable if the relationship later lapses (humane, no surprise data loss) (per `docs/superpowers/specs/2026-05-27-direct-messaging-design.md`).

### Notifications inbox
1. **What it is** - In-app notification inbox.
2. **How it works** - `/parent/notifications` (`NotificationsInbox`). Table `notifications`. Guard: `requireRole("parent")`.
3. **Rationale:** In-app only (no email transport wired).

### Resource Library (read-only mirror)
1. **What it is** - Read-only mirror of the student resource library, scoped to the selected child's enrolled subjects.
2. **How it works** - `/parent/resources`. Reads via `listResourcesForSubjects` scoped to `childSubjectIds(parentId)` (`src/lib/resources.ts`). Opening a file mints a short-lived signed URL via `openResourceForParent` (`src/app/_actions/resources.ts`); links open the validated `externalUrl` directly. Guard: `requireRole("parent")` + child-enrolment scope, backstopped by RLS on `resources`.
3. **Rationale:** Same subject-scoping rationale as the student view - a parent only ever sees resources for subjects their linked child is actually enrolled in, never another family's materials (per `docs/superpowers/specs/2026-07-23-resource-library-design.md` §Security, and PRD cross-cutting non-negotiable that parents see only their children's data).

### Planned / not yet built (parent)
- **Class token / make-up credit** - spec'd 2026-06-03 (new `class_tokens` table) but unbuilt; needs a fresh migration number (checklist ⬜).
- **Online payment** - stub link only, no processor (checklist ⬜).
- **Per-class feedback detail link** - `/parent/classes/[classId]` not built (memory `project_pending_feedback_to_class_link`).

---

## Tutor

### Class timetable
1. **What it is** - Dashboard + monthly grid of the tutor's classes (amber pills) and availability (green pills), with an edit toggle.
2. **How it works** - `/tutor` dashboard, `/tutor/classes` (weekly snapshot), `/tutor/timetable` (monthly grid, "Manage availability" toggle). Tables: `classes`, `lessons`, `tutorAvailability`. Guard: `requireRole("tutor")`.
3. **Rationale:** Consolidated 2026-06-03 - previously split across `/tutor/schedule` + `/tutor/availability` (per `docs/checklist.md` Tutor "Class timetable").

### Tutor availability
1. **What it is** - Weekly recurring slot picker with per-date isolation, feeding both parent and admin reschedule flows.
2. **How it works** - `/tutor/timetable` "Manage availability". Table: `tutorAvailability` (`weekday` for recurring rules, `date` for date-specific rows). Consumed by `getAvailableSlots` (`src/lib/availability.ts`). Guard: `requireRole("tutor")` + `tutor_id = me`.
3. **Rationale:** Sync is deliberate and verified - the *same* `tutor_availability` rows feed parent reschedule + admin one-off reschedule via one shared query, so availability can't drift between surfaces (per `docs/checklist.md` Tutor "(extra) Tutor availability"). Per-day "isolate" detaches a specific date from the recurring weekly rules so a one-off change doesn't ripple to other weeks (same note).

### Homework marking
1. **What it is** - Mark submissions, record scores/feedback, request resubmission.
2. **How it works** - `/tutor/homework`, `/tutor/homework/[id]`. Writes `homeworkAssignments` (`score`, `feedback`, `status`, `markedBy`). `homework.is_test` (migration 0008) drives student ranking. Guard: `requireRole("tutor")` + `assertTeaches*` ownership.
3. **Rationale:** A homework can be flagged `is_test` to drive anonymous student ranking, but there is **no tutor UI to set the flag yet** - currently set via SQL (per `docs/checklist.md` Tutor "Class test / booklet mark").

### Lesson notes (parent-visible + internal split)
1. **What it is** - Per-student lesson notes with a strict split between a parent-visible comment and an internal-only note.
2. **How it works** - `/tutor/notes`, `/tutor/lessons/[id]`. Table: `lessonNotes` (`parentVisibleComment` vs `internalNote`, plus `topicCovered`/`strengths`/`struggles`/`nextLessonFocus`). Students/parents read via the `lesson_notes_safe` view. Guard: `requireRole("tutor")`.
3. **Rationale:** The parent-visible/internal split is enforced at the database layer: the `lesson_notes_safe` view (migration 0003) omits `internal_note`, so students/parents structurally cannot read it (per security-checklist A3). Lesson-notes split is a PRD cross-cutting non-negotiable.

### Attendance marking
1. **What it is** - Mark per-lesson presence/late/absent/left-early with notes.
2. **How it works** - `/tutor/lessons/[id]`. Table: `attendance` (`attendanceStatusEnum`, `markedBy`). Guard: `requireRole("tutor")` + lesson ownership.
3. **Rationale:** `Rationale: not documented.`

### Student profile
1. **What it is** - Per-student history: attendance, homework, and lesson notes for students the tutor teaches.
2. **How it works** - `/tutor/students/[id]`. Reads `attendance`, `homeworkAssignments`, `lessonNotes`. Entry point for "Message student"/"Message parent". Guard: `requireRole("tutor")` + shared-class scope.
3. **Rationale:** Tutor sees only assigned students - enforced by shared-class scoping, matching the PRD's strict tutor permission (tutors see only assigned students).

### Curriculum sections (per-tutor additive)
1. **What it is** - A tutor can add a note + file attachments to any week of a subject they teach, layered on top of the locked admin base, visible only to their own students.
2. **How it works** - `/tutor/classes/[id]/curriculum`. Tables: `tutorWeekSections` (unique `(tutorId, subjectWeekId)`), `tutorWeekAttachments` (`kind` = file/link, migration 0015). Actions `upsertTutorWeekNote`, `addTutorWeekAttachment`, `removeTutorWeekAttachment` in `src/app/tutor/_actions.ts`. Guard: `requireRole("tutor")` + `tutorTeachesSubjectWeek`.
3. **Rationale:** Scoped per-`(tutor, subject-week)` (shared across all that tutor's classes of the subject, separate from other tutors) so additions are *additive* and never mutate the admin's locked base curriculum; this replaced the retired `class_week_overrides` "replace the base" model, which contradicted "base is locked" (per `docs/superpowers/specs/2026-07-01-tutor-sections-design.md`). Reads are scoped to the tutor's own students/parents at the query layer (commit `ed02764`).

### Discussions
1. **What it is** - Per-subject Q&A boards for subjects the tutor teaches, plus the Admin/Tech board.
2. **How it works** - `/tutor/discussions` (+ `[boardId]`, `[boardId]/[threadId]`). Tables: `discussionThreads`, `discussionReplies`. Board visibility scoped via `classes.tutorId = me`. A reply writes a `discussion_reply` notification to the thread author. Guard: `requireRole` + board membership.
3. **Rationale:** `lastActivityAt` is a denormalized column on the thread so boards sort by recent activity via an indexed read instead of subquerying each thread's newest reply on every load - standard forum pattern (per `docs/superpowers/specs/2026-05-27-discussions-design.md`). One unread ping per thread (not per reply) to avoid noise (same spec).

### Direct messaging
1. **What it is** - 1:1 DMs with admin, the tutor's students, and parents of taught students.
2. **How it works** - `/tutor/messages` (+ `[threadId]`, `with/[userId]`). `canDM` allows tutor↔student and tutor↔parent only on a shared class. Guard: `requireRole("tutor")` + `canDM`.
3. **Rationale:** Relationship clauses reuse existing joins (`classes.tutorId → enrollments`, `→ family_links`); same-role pairs are always denied (no tutor↔tutor) (per `docs/superpowers/specs/2026-05-27-direct-messaging-design.md`).

### Reschedule approvals
1. **What it is** - Queue of pending reschedule requests for the tutor's own classes, with accept/reject.
2. **How it works** - `/tutor/reschedules`. `approveReschedule`/`rejectReschedule` (`src/lib/reschedule.ts`) run the matching execution primitive on accept. Table: `rescheduleRequests`. Guard: `requireRole("tutor")` + class-tutor check.
3. **Rationale:** First-to-act wins between tutor and admin (reject if not `pending`); 1-on-1 and group-`<24h` reschedules always land here rather than executing directly (per `docs/superpowers/specs/2026-07-10-reschedule-design.md`).

### Notifications inbox
1. **What it is** - In-app inbox.
2. **How it works** - `/tutor/notifications` (`NotificationsInbox`). Table `notifications`.
3. **Rationale:** In-app only.

### Resource Library (author + promote)
1. **What it is** - Add a resource (booklet, past paper, worksheet, video) to the subject-wide library by direct file upload or link, plus a "promote" toggle that publishes an existing weekly curriculum attachment straight into the library.
2. **How it works** - `/tutor/resources`; promote toggle lives on the weekly curriculum section editor (`/tutor/classes/[id]/curriculum`). `addResource` uploads to the private `resource-library` bucket (`uploadResourceFile`, `src/lib/resources-storage.ts`, validated by `RESOURCE_POLICY` in `src/lib/upload-validation.ts`) or validates a link via `httpHref` (`src/lib/safe-url.ts`); `promoteAttachment` creates a `resources` row referencing the existing `tutorWeekAttachments` object (`sourceAttachmentId`) rather than re-uploading it. Both actions are in `src/app/_actions/resources.ts`, scoped to `taughtSubjectIds(tutorId)` via `assertCanAuthor`. Guard: `requireRole(["tutor","admin"])` + taught-subject check for tutors (admins pass unconditionally).
3. **Rationale:** Promoted resources reference the source attachment instead of copying it, so `removeTutorWeekAttachment` (`src/app/tutor/_actions.ts`) blocks deleting a weekly attachment that's been promoted to the library - otherwise the published resource would silently 404 (per `docs/superpowers/specs/2026-07-23-resource-library-design.md` §Add / promote flow, "File-lifecycle rule"). Instant-publish (no pre-approval queue) was chosen over gating every tutor upload behind admin sign-off, trading a moderation step for tutor velocity - admin oversight happens after the fact via unpublish/remove (same spec §Decisions).

### Planned / not yet built (tutor)
- **Forward-looking lesson plan** - only retroactive `lesson_notes.nextLessonFocus` exists (checklist ⬜).
- **Class-recording auto-upload pipeline** - no upload pipeline or Storage bucket for automatically capturing class recordings; resource library video entries are added manually (checklist ⬜ "Upload videos").
- **`is_test` checkbox in homework create/edit** - flag exists but no tutor UI (checklist 🔶).
- **Tutor → student mass announcements** - only admins post announcements (checklist ⬜).

---

## Admin

### Operations dashboard
1. **What it is** - Stat tiles, alerts, and recent activity for the whole business.
2. **How it works** - `/admin` (`src/app/admin/page.tsx`, `_lib/queries.ts`). Aggregates across `profiles`, `enrollments`, `attendance`, `invoices`. Guard: `requireAdmin()` (either admin tier via middleware).
3. **Rationale:** `Rationale: not documented` for the specific tile set. (Revenue figures were moved off this page - see Revenue below.)

### User management + account creation
1. **What it is** - Create, edit, deactivate, and role-assign accounts across all roles.
2. **How it works** - `/admin/users`, `/admin/users/[id]`. Actions in `src/app/admin/_lib/actions-users.ts` (`createUser`, `updateUser`, `setUserActive`). Auth-user CRUD uses `createAdminClient()` (true service-role). Table: `profiles` (+ `auth.users`). Guard: `requireAdmin()`.
3. **Rationale:** `createAdminClient()` (service-role) is used *only* here for `auth.users` CRUD, where RLS-bypass is genuinely required, and is `server-only`-guarded (per security-checklist C6). New/edited accounts must always carry a *tiered* role (never a bare coarse value) - `ROLE_OPTIONS` in `src/lib/roles.ts` offers only tiered values. `profiles.role` is additionally locked by a BEFORE-UPDATE trigger (migration 0013 / security A8) so it can't be silently changed out of band.

### Family links editor
1. **What it is** - Editor for parent↔child relationships on the user detail page.
2. **How it works** - On `/admin/users/[id]`. Table: `familyLinks` (`is_primary_contact`). Guard: `requireAdmin()`.
3. **Rationale:** Parent-child account linking is a first-class concept per the PRDs; `is_primary_contact` exists in schema but the toggle UI is still a gap (checklist ⬜ "Primary-contact toggle").

### Class management
1. **What it is** - Create/edit class slots (subject, tutor, capacity, type, location, recurrence).
2. **How it works** - `/admin/classes`, `/admin/classes/[id]`. Table: `classes` (`classTypeEnum` group/one_on_one). Enrolments managed inline via `enrollments-manager.tsx`. Guard: `requireAdmin()`.
3. **Rationale:** `classType` is an explicit enum column, *not* inferred from capacity, because the reschedule routing depends on it (1-on-1 always needs approval; group depends on timing) (per role-tiers spec §8 / reschedule spec).

### Enrolment management
1. **What it is** - Onboard/move/withdraw students into classes, with per-enrolment admin notes and delivery mode.
2. **How it works** - `/admin/enrolments`; also `/admin/classes/[id]` enrolments manager. Table: `enrollments` (`withdrawnAt`, `deliveryMode`, `adminNotes`). Guard: `requireAdmin()`.
3. **Rationale:** `enrollments.adminNotes` was added to move operational notes (`T3INV`, `MOVE CLASS BY NW`, holiday markers) out of the admin's spreadsheet and into the portal (per `docs/checklist.md` Excel-vs-portal audit, and memory `project_admin_excel_gap_2026_05_26`).

### Attendance (admin)
1. **What it is** - Admin view to mark/inspect per-lesson attendance.
2. **How it works** - `/admin/attendance`, `/admin/attendance/[lessonId]`. Table: `attendance`. Guard: `requireAdmin()`.
3. **Rationale:** `Rationale: not documented.`

### Payment management
1. **What it is** - Manage invoices and manually mark them paid (cash received at desk).
2. **How it works** - `/admin/payments` (`_components/`). Table: `invoices` (`invoiceStatusEnum`, `paidAt`). Guard: `requireAdmin()`. **Not** behind the PIN wall.
3. **Rationale:** Individual invoice/payment status is deliberately *not* PIN-walled - daily ops (reception marking cash) need it; the wall covers only revenue aggregates (per `docs/superpowers/specs/2026-07-12-admin-pin-wall-design.md` §Scope). Payment model is free-trial → payment; no refunds/discounts (same spec).

### Revenue (PIN-walled)
1. **What it is** - A dedicated page showing this/last-month cash received and overdue outstanding, gated behind a separate admin PIN (step-up auth).
2. **How it works** - `/admin/revenue` (`src/app/admin/revenue/page.tsx`, nav Insight → Revenue). Server component returns the PIN prompt *before* any query if `!isAdminUnlocked()`. Queries `getRevenueSummary` (cash bucketed by `paidAt`) + `getRecentPayments` (`admin/_lib/queries.ts`). Table: `admin_settings` (`pin_hash`, `failed_attempts`, `locked_until`; migrations 0020/0021). Lock logic in `src/lib/admin-lock.ts` (scrypt hash + HMAC-signed httpOnly `admin_unlock` cookie, ~30 min, user-bound). Actions in `actions-security.ts` (`setAdminPin`, `unlockAdmin`). PIN set/changed at `/admin/settings`. Guard: `requireAdmin()` + PIN unlock.
3. **Rationale:** The PIN wall's **final scope gates ONLY `/admin/revenue`** - the earlier reception/owner role split + push-approval was descoped after runtime testing, and creating users / changing roles / deactivating accounts are all *un-walled* (per memory `project_role_tiers_spec1_2026_07_10.md`, commit `6015330`). The revenue figure is never rendered while locked (checked before any query) so it can't be exfiltrated via view-source (per admin-pin spec §E). Lockout: 5 misses → 15-min lock (commit `53a6aad`). Unlock cookie is only marked `Secure` in production so dev/HTTP doesn't silently drop it (commit `51e71eb`). The `admin_restricted`/`admin_unrestricted` enum tiers remain **dormant/unused** (memory note; admin-pin spec §Scope).

### Admin settings (PIN)
1. **What it is** - Set or change the admin PIN.
2. **How it works** - `/admin/settings` (`_components/`). `setAdminPin({ current?, next })` scrypt-hashes into `admin_settings.pin_hash`. Guard: `requireAdmin()`.
3. **Rationale:** The wall stays *open* until a PIN is set (no accidental lockout on first deploy) (commit `1744333`). PIN is 6–8 digits (commit `53a6aad`).

### Announcements
1. **What it is** - Portal-wide announcements with audience scoping by role or class.
2. **How it works** - `/admin/announcements` (`_components/`). Table: `announcements` (`audienceRole` uses `userRoleEnum`, `audienceClassId` → `classes`). Guard: `requireAdmin()`.
3. **Rationale:** The coarse `userRoleEnum` values (student/parent/tutor/admin) survive specifically as announcement audience targets even after every account moved to a tiered role (per `src/lib/roles.ts` comment / role-tiers memory).

### Reschedule approvals (admin)
1. **What it is** - Read-only credits and allowance usage plus admin-initiated one-off reschedules.
2. **How it works** - `/admin/reschedules` is the credits/usage view. An admin opens a student record's Lessons & leave tab and moves a future lesson in its inline panel. The panel loads same-subject or all-tutor slots with `loadAdminRescheduleOptions`; `rescheduleStudentLesson` performs the guarded write. Guard: `requireAdmin()`.
3. **Rationale:** The inline panel keeps the one-off workflow in the lesson context and replaces the former standalone route. It uses the same shared availability expansion and taken-slot checks as the other rescheduling flows.

### Curriculum & terms management
1. **What it is** - Define terms, subject topics, and the canonical week-by-week curriculum per subject.
2. **How it works** - `/admin/terms`, `/admin/subjects/[id]/curriculum`. Tables: `terms`, `subjects`, `subjectTopics`, `subjectWeeks`. Actions in `actions-curriculum.ts` + `actions-topics.ts`. Guard: `requireAdmin()`.
3. **Rationale:** `subjectWeeks.topicId` is nullable with `onDelete: set null` so adding topics is non-destructive (existing weeks stay valid) and deleting a topic never deletes curriculum content - weeks fall back to "unassigned" (per `docs/superpowers/specs/2026-06-30-curriculum-topics-design.md`). Topics are subject-level (not term-level) because a topic like "Algebra" spans weeks across any term (same spec).

### Discussions oversight
1. **What it is** - View every subject board and soft-delete any thread/reply.
2. **How it works** - `/admin/discussions` (+ `[boardId]`, `[boardId]/[threadId]`). Actions `softDeleteThread`/`softDeleteReply` set `deletedAt`. Guard: `requireAdmin()`.
3. **Rationale:** Only admins can soft-delete (authors cannot delete their own posts); soft-deleted content renders as `[removed by admin]` keeping the original author visible - an oversight/safeguarding surface (per `docs/superpowers/specs/2026-05-27-discussions-design.md`).

### Direct messaging (admin)
1. **What it is** - 1:1 DMs with anyone via a categorized directory.
2. **How it works** - `/admin/messages` (+ `[threadId]`, `with/[userId]`). Directory categorized parents/tutors/students; "Message" button on `/admin/users/[id]`. `canDM` returns true for any admin↔non-admin pair. Guard: `requireAdmin()`.
3. **Rationale:** `getThreadForMe` scopes the admin messages UI to threads the admin *participates* in; RLS (migration 0012) permits admin read of all DMs, but no UI surfaces non-participant conversations - a safeguarding-oversight view would need an audit READ row + reason gate before exposing them (per security-checklist G3).

### Students Leaving view
1. **What it is** - List view of students flagged as leaving.
2. **How it works** - `/admin/leaving`. Reads `enrollments.withdrawnAt`. Guard: `requireAdmin()`.
3. **Rationale:** Built to move the "Students Leaving" workflow out of the spreadsheet (per memory `project_admin_excel_gap_2026_05_26`).

### Notifications inbox (admin)
1. **What it is** - In-app inbox.
2. **How it works** - `/admin/notifications` (`NotificationsInbox`). Table `notifications`.
3. **Rationale:** In-app only.

### Reporting
1. **What it is** - Attendance + payment reporting (stub).
2. **How it works** - `/admin/reports` - currently a "Coming in Phase 3" stub; underlying `attendance`/`invoices` data is queryable but nothing aggregates it. Guard: `requireAdmin()`.
3. **Rationale:** Deferred to Phase 3 per the build-order phasing (checklist 🔶 / CLAUDE.md build order).

### Resource Library (moderation)
1. **What it is** - Admin-wide moderation view of every resource across every subject, including unpublished and removed ones, with unpublish/republish/remove(with reason)/restore.
2. **How it works** - `/admin/resources`. Reads via `listAllResourcesForAdmin` (`src/lib/resources.ts`), unfiltered by subject scope. Actions `setResourcePublished`, `removeResource`, `restoreResource` (`src/app/_actions/resources.ts`) - all wrapped in `withActor` so mutations land in `audit_logs`. Guard: `requireAdmin()`.
3. **Rationale:** The model is **instant-publish + admin moderation**, not a pre-approval queue - tutors publish immediately and admin reviews/acts after the fact (unpublish, remove with a reason, restore), trading a moderation step for tutor velocity while keeping oversight (per `docs/superpowers/specs/2026-07-23-resource-library-design.md` §Decisions). Every moderation action is audited via `withActor`, consistent with the portal's audit-log non-negotiable (security-checklist G1).

### Planned / not yet built (admin)
- **Admin board to view other tutors' availability** - `/admin/tutors/availability` not built; admin can't coordinate cover across the roster (checklist 🔶).
- **Auto-find replacements on tutor leave** - needs matching logic (checklist ⬜).
- **Per-feature `admin_restricted` vs `admin_unrestricted` gating** - enum values exist but the only enforced financial gate is the revenue PIN wall; the full reception/owner matrix is a *target spec*, not current behaviour (checklist 🔶, admin-pin spec).
- **Reporting aggregation** - see above.

---

## Cross-cutting

### Authentication
1. **What it is** - Supabase-backed login, password reset, and session handling.
2. **How it works** - `/(auth)/login`, `/(auth)/forgot-password`, `/(auth)/reset-password`, `/auth/callback`. `@supabase/ssr`; `getCurrentUser`/`requireRole` in `src/lib/auth.ts`. Post-login routing lands on the coarse-role home.
3. **Rationale:** Login routes to the *coarse-role* home (`/student`, `/admin`, …), not the raw tiered role - otherwise a `student_restricted` user was sent to a nonexistent `/student_restricted` and 404'd (per commit `9c60a6d`). The `auth/callback` + login redirects are guarded against open redirects (OWASP A01, commit `c16ddde`). Password-reset E2E is untested because seed emails aren't real inboxes (memory `project_password_reset_test_pending`).

### Role model & tiered roles
1. **What it is** - Six-tier role enum (2 admin tiers, 2 student tiers, plus `tutor`/`parent`) with coarse-role bridging.
2. **How it works** - `userRoleEnum` in `schema.ts` (migrations 0017 add values, 0018 migrate rows + `app_metadata` + `is_admin()`). `src/lib/roles.ts`: `coarseRole`, `studentTier`, `ADMIN_TIERS`, `STUDENT_TIERS`. `requireRole` accepts a role *or a set*, and expands coarse "admin"/"student" to their tier families.
3. **Rationale:** The enum keeps all eight values so ~40 existing coarse comparisons and 81 `requireRole` call sites were untouched - coarse values survive as announcement audience targets + DM/discussion display prefixes (per `src/lib/roles.ts` comment / memory `project_role_tiers_spec1`). `student_restricted` is the **safe default**: only the explicit `student_unrestricted` value unlocks payments/reschedule/DM-admin, so the legacy `student` and `student_restricted` both mean parent-dependent (per `studentTier` comment in `src/lib/roles.ts`). The `is_admin()` SQL predicate changed from `= 'admin'` to `like 'admin%'`; this was flagged as the high-risk migration bit since a mistake breaks all admin access (role-tiers spec §3.1 / memory).

### Role-based routing & authorization
1. **What it is** - Middleware + per-layout guards enforcing which portal each role can reach.
2. **How it works** - `src/middleware.ts` + `src/lib/supabase/middleware.ts` gate `/admin/*` to any `admin_*`, `/student/*` to any `student_*`, etc. Per-page loaders and every server action call `requireRole`/ownership guards.
3. **Rationale:** The app layer is the real boundary - the Drizzle `db` connects as `postgres` and bypasses RLS, so `requireRole` + ownership checks are the primary control (verified present on every server action in the K3 review); RLS is defense-in-depth (per security-checklist C6/K3). Role is read from `app_metadata.role` **only** - never `user_metadata` - because `user_metadata` is user-mutable via `supabase.auth.updateUser()` and trusting it (even as a fallback) was a privilege-escalation path (per security-checklist B1/B2, migration 0002, commit `c16ddde`).

### Notifications
1. **What it is** - In-app notification inbox for all four roles.
2. **How it works** - `notifications` table; `NotificationsInbox` component; `/{role}/notifications`. Written by DM/discussion/reschedule flows.
3. **Rationale:** In-app only - no Resend/SES/email transport is wired, so notifications intentionally sit in-app (per `docs/checklist.md` Cross-cutting "Email delivery").

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
1. **What it is** - Private Supabase Storage buckets for homework attachments/submissions, curriculum video/booklets, and discussion/DM attachments.
2. **How it works** - Buckets `homework-attachments`, `curriculum`, `discussion-attachments`. Signed URLs minted server-side (1h TTL) after a permission check. Upload validation in `src/lib/*-storage.ts` (`validateUpload`). Tables reference storage *paths*, not public URLs.
3. **Rationale:** Buckets are private with short-lived signed URLs so student submissions/materials aren't world-readable (per security-checklist E4/E5). **Deploy note:** the `discussion-attachments` bucket exists in dev but must be created (private) in prod at deploy, same as `homework-attachments` (per security-checklist E7 / memory `project_role_tiers_spec1`).

---

## Sources

- `docs/checklist.md` (backbone inventory, last audit 2026-07-22)
- `docs/PRD_{Student,Parent,Tutor,Admin}_Portal.md`
- `docs/security-checklist.md`, `docs/SECURITY.md`
- `docs/superpowers/specs/`: role-tiers (2026-07-09), reschedule (2026-07-10), admin PIN wall (2026-07-12), math game (2026-07-12), direct messaging (2026-05-27), discussions (2026-05-27), subject curriculum (2026-05-30), curriculum topics (2026-06-30), tutor sections (2026-07-01)
- `src/db/schema.ts`, `src/lib/{auth,roles,dm-permissions,admin-lock,reschedule,availability,with-actor}.ts`
- git history + memory notes under `~/.claude/projects/.../memory/`
