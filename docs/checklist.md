# Implementation Checklist

Cross-references the role spec against the actual codebase.
Last audit: 2026-07-22.

> ## ⚠️ Maintenance protocol — READ BEFORE YOU CLOSE ANY TASK
>
> This checklist is only useful while it's true. A stale ✅ makes the next agent
> rebuild finished work; a stale ⬜ makes them waste time re-scoping something
> already shipped. **Updating this file is part of finishing a task, not a
> follow-up.**
>
> When you complete (or partly complete) any feature:
> 1. Find the matching row — or **add one** if it's new / an extra.
> 2. Set the `FE` and `BE` ticks honestly: ✅ done · 🔶 partial · ⬜ not built.
>    Don't mark ✅ before it's verified end-to-end with real data (see CLAUDE.md).
> 3. Rewrite the **Notes** cell to name the route/file and the date.
> 4. If the work belongs to a spec section (e.g. **Role Tiering**), update that
>    section's status line too — not just the table row.
> 5. Do all of this **in the same change/commit** as the code. If you're opening
>    a PR, the checklist edit goes in the PR.
>
> Only bump **"Last audit"** above when you've re-verified rows against the
> codebase wholesale — not for a single-row edit.

**Tick legend** (the `FE` and `BE` columns):

- ✅ done — wired end-to-end, real data, usable
- 🔶 partial — UI exists but stub, OR backend exists but no UI, OR feature works for one case but not the spec'd full case
- ⬜ not built

Things marked **(extra)** are implemented in the portal but weren't in the original role spec — keeping them visible so you don't accidentally retire them.

---

## Pending manual verification (2026-07-25 session)

Everything below is code-complete with typecheck + unit tests green, but NOT yet clicked through in a browser with real data. Per the success-claim rule, these stay 🔶 (not ✅) until the browser checks are ticked. Run the dev server and tick each box as you confirm it.

**Operational reports** — `/admin/reports`
- [x] Typecheck clean
- [x] Unit tests pass (metrics + CSV serializer, 28/28)
- [x] Whole-branch code review: ready to merge
- [ ] Opens as admin, defaults to current term, 3 tiles + per-class table render
- [ ] One class's attendance % matches its marked lessons by hand
- [ ] A class with no marked lessons / no homework / no tests shows "—", not 0% or a crash
- [ ] Switching term updates figures + the `?term=` URL, while "Class fill (now)" stays constant
- [ ] Download CSV opens with the same numbers as the table

**Tutor "Mark as test" checkbox** — homework create form
- [x] Typecheck clean
- [ ] Create a homework with "Mark as test" checked, then confirm it appears in a student's per-test ranking

**Student DM entry** — dashboard + `/student/messages`
- [x] Typecheck clean
- [ ] Restricted student sees tutors only (no admin office); "Message" opens/creates a thread
- [ ] Unrestricted student sees tutors + admin office
- [ ] Contact block renders cleanly at 375px mobile width

**Primary-contact toggle** — `/admin/users/[id]`
- [x] Typecheck clean
- [ ] Mark a parent primary → badge moves; a second parent for the same student cannot also be primary

**Per-student delivery mode** — `/admin/classes/[id]`
- [x] Typecheck clean
- [ ] Set one student to Online → persists on reload; classmates unaffected

**Quiz delivery and shared notifications** - quiz routes + all notification routes
- [x] Typecheck clean
- [x] Unit tests pass
- [x] Production build passes
- [x] Migration 0026 applied to the connected Supabase database
- [x] RLS audit passes for all 37 public tables
- [x] Existing Year 9 English Term 2 Week 1 quiz resolves to one eligible tutor and two eligible students in the connected data
- [ ] Admin creates, renames, attaches a file to, and approves a quiz in the browser
- [ ] Tutor opens an approved common quiz from the curriculum page
- [ ] Student opens the approved quiz, answers it, and checks the practice result
- [ ] Admin, tutor, student, and parent notification routes render the same grouped inbox at desktop and mobile widths

---

## Admin

| Feature | Function | FE | BE | Notes |
|---|---|---|---|---|
| Attendance marking | UI to mark presence/late/absent | ✅ | ✅ | **Built since last audit** — `/admin/attendance` + `/admin/attendance/[lessonId]`. Tutors also mark at `/tutor/lessons/[id]`. |
| Class management | Create class slots | ✅ | ✅ | `/admin/classes` + `/admin/classes/[id]` |
| Enrolment management | Onboard students | ✅ | ✅ | `/admin/enrolments` |
| Payment management | Manage payments | ✅ | ✅ | `/admin/payments` (manual mark-as-paid; no Stripe yet) |
| Announcements | Portal-wide announcements with audience scoping | ✅ | ✅ | `/admin/announcements` |
| Reporting to parents/tutors | Attendance + payment reports | 🔶 | 🔶 | **Operational reports SHIPPED 2026-07-25** (branch feat/operational-reports): `/admin/reports` now renders live term-scoped attendance %, homework completion %, class fill %, and per-class avg test result, with a term selector and CSV export. Pure metrics + CSV serializer unit-tested (vitest, 28 pass); queries + page + `export/route.ts` typecheck clean; CSV is formula-injection-safe. Files: `reports-metrics.ts`, `reports-csv.ts`, `reports-queries.ts`, `reports/page.tsx` + `_components/term-select.tsx`, `reports/export/route.ts`. **Pending runtime click-through** (dev-server verify). **Still unbuilt:** (2) **Financial** (revenue/overdue) - must reuse the `/admin/revenue` PIN gate (`getAdminSecurityState`); (3) **Student reports** - automated term-based per-student from **quiz + test scores**, BLOCKED (quizzes do not exist + metrics TBD). Deploy follow-up: pin `TZ=UTC` so read-path term bounds agree with `createHomework` due-date parsing. Overall stays 🔶 until all three land + runtime-verified. |
| Resource control | Manage uploaded resources, approval workflow | ✅ | ✅ | **Built + runtime-verified (2026-07-23).** `/admin/resources` — lists ALL resources (incl. unpublished/removed) across every subject; unpublish/republish/remove(with reason)/restore via `setResourcePublished`/`removeResource`/`restoreResource` (`src/app/_actions/resources.ts`), all audited via `withActor`. Model is instant-publish + admin moderation, not a pre-approval queue. |
| Quiz management | Request, build, approve quizzes | 🔶 | ✅ | **Expanded 2026-07-27.** `/admin/quizzes` now labels targets with subject, year, term, and week; hides weeks that already have a quiz; permits title changes during creation and by an admin after approval; accepts validated private file/image attachments; and places the admin-only Approve action in the maker's primary action slot. Migration 0026 adds database-enforced one-quiz-per-concrete-subject-week uniqueness, attachment RLS, and approved-quiz delivery access. The connected database, existing Year 9 English quiz, migration, build, tests, and 37-table RLS audit are verified. FE remains partial pending browser click-through. Quiz ranking and attempt analytics remain unbuilt. See `docs/changes/2026-07-27-quiz-delivery-notifications.md`. **Maker v2 built 2026-07-27** (`docs/changes/2026-07-27-quiz-maker-v2.md`): shared `src/components/quiz/quiz-maker.tsx` now switches to two columns at the `lg` breakpoint instead of `xl` so it fills the width at real laptop sizes and 125% zoom; the admin/tutor detail pages drop their 1400px cap; `quiz.note` moved into a collapsible bottom strip (`src/components/quiz/quiz-instruction-strip.tsx`) instead of a full-width block above the maker; a new "Context set" question type (`addQuestion({ type: 'context', parentId })`, migration `0027_quiz_context_attachments.sql` adding the enum value + `quiz_questions.parent_id`) lets a passage question hold nested multiple-choice/true-false sub-questions; attachments (`uploadQuizAttachments`) now scope to a specific question or context block via `quiz_attachments.question_id` instead of only the quiz as a whole; and questions can be reordered via drag-and-drop or up/down arrow buttons (`reorderQuestions({ quizId, parentId, orderedIds })` in `src/app/_actions/quizzes.ts`), scoped per sibling group. All server actions, the migration, `quiz-validation` context grading/validation, typecheck, the full test suite (45/45 across 8 files), the production build, and `db:check-rls` (37/37 tables, no new policies needed since nested rows are still keyed on `quiz_id`) are verified. **Pending owner browser verification 2026-07-27**: no one has clicked through building a context set, reordering questions, or attaching a file to a single question in a real browser yet, so FE stays 🔶. |
| Create accounts | Role-specific account creation | ✅ | ✅ | `/admin/users` + `/admin/users/[id]` |
| Tutor management — availability | View / coordinate tutor availability | 🔶 | ✅ | Tutors set their own availability at `/tutor/timetable` ("Manage availability" toggle on the monthly grid). Backend: `tutor_weekly_availability` table + `getAvailableSlots` query, already consumed by the parent reschedule flow + admin one-off reschedule UI. **Gap:** admin has no UI to view/edit *other* tutors' availability across the roster — needs a `/admin/tutors/availability` board so reception can spot gaps + coordinate cover. |
| Tutor management — auto-find replacements | Auto-message + replacement on tutor leave | ⬜ | ⬜ | Not built. Would need messaging layer + matching logic. |
| `admin_restricted` (reception) | Lower-tier admin with no access to sensitive financials | 🔶 | 🔶 | Enum values exist (migrations 0017/0018), but **both admin tiers can currently reach every admin action.** Financial exposure was descoped to a PIN wall on `/admin/revenue` only (migrations 0020/0021 — 6–8 digit PIN, 5-miss/15-min lockout, managed at `/admin/settings`). The full per-feature matrix below is **not** implemented. |
| `admin_unrestricted` (owner) | Full admin with all access | 🔶 | 🔶 | Same enum; no per-feature tier gating beyond the revenue PIN wall. See [Role Tiering](#role-tiering-student--admin). |
| **(extra) Operations dashboard** | Stat tiles, alerts, recent activity | ✅ | ✅ | `/admin` |
| **(extra) Family links UI** | Parent ↔ child relationship editor | ✅ | ✅ | On user detail page |
| **(extra) Direct messaging** | 1:1 DMs with anyone via directory | ✅ | ✅ | `/admin/messages` — categorized directory (parents/tutors/students) + "Message" button on `/admin/users/[id]` (shipped 2026-05-27) |
| **(extra) Discussions oversight** | View + soft-delete on every subject board | ✅ | ✅ | `/admin/discussions` (shipped 2026-05-27) |
| **(extra) Term management** | Define terms / term dates | ✅ | ✅ | `/admin/terms` (built since last audit) |
| **(extra) Reschedule approvals** | Approve / reject parent + student reschedule requests | ✅ | ✅ | `/admin/reschedules`; one-off from `/admin/users/[id]/reschedule/[lessonId]` |
| **(extra) Notifications inbox** | Read in-app notifications | 🔶 | ✅ | **Unified 2026-07-27.** `/admin/notifications` uses the same shared grouped inbox as tutor, student, and parent. Messages and action-needed items are separated ahead of announcements and general updates. Grouping logic is unit-tested; browser visual verification remains pending. |

---

## Tutor

| Feature | Function | FE | BE | Notes |
|---|---|---|---|---|
| Class timetable | Show enrolled class times | ✅ | ✅ | `/tutor` dashboard + `/tutor/classes` (weekly snapshot) + `/tutor/timetable` (monthly grid: classes as amber pills, availability as green pills, "Manage availability" toggle for edit mode). Consolidated 2026-06-03 — previously split across `/tutor/schedule` + `/tutor/availability`. |
| Student discussion page | Answer post-class questions | ✅ | ✅ | `/tutor/discussions` — per-subject Q&A boards (shipped 2026-05-27) |
| Lesson plan | Update what's *going* to be covered | ⬜ | ⬜ | `lesson_notes.nextLessonFocus` exists (per-lesson, *retroactive* — "what to focus on next time"). No forward-looking class-level plan field. |
| Class test / booklet mark | Update marks for parents/students to see | 🔶 | ✅ | Homework marking (with `score`, `feedback`) covers most of this. A homework can now be flagged `is_test` (migration 0008) to drive student ranking. **is_test UI added 2026-07-25** - "Mark as test" checkbox on the homework create form (`section-editor.tsx`); `createHomework` (`src/app/tutor/_actions.ts`) reads it. Typecheck + pattern-parity verified, runtime click-through still pending. No edit toggle for existing homework (there is no homework-edit flow in the app). |
| Resource page | Upload booklets for students/parents | ✅ | ✅ | **Built + runtime-verified (2026-07-23).** `/tutor/resources` — add a resource by direct file upload or link (`addResource`, `src/app/_actions/resources.ts`), scoped to taught subjects. Plus a "promote" toggle on the weekly curriculum section editor to publish an existing weekly attachment straight into the subject-wide library (`promoteAttachment`) — file attachments are referenced, not copied, so deleting a promoted attachment is blocked. |
| Create quizzes | Build quizzes from admin requests | 🔶 | ✅ | **Expanded 2026-07-27.** `/tutor/quizzes` includes assigned work plus approved common quizzes for subjects the tutor teaches. The full-width shared maker supports title edits in tutor-editable states, attachments, a denser tool rail, clearer question hierarchy, readiness feedback, and the tutor-only Submit for review action. Approved quizzes also appear in each matching tutor curriculum week. Server permissions, migration 0026, tests, build, and connected-data visibility are verified; browser click-through remains pending. **Maker v2 built 2026-07-27** (`docs/changes/2026-07-27-quiz-maker-v2.md`): the tutor detail page (`src/app/tutor/quizzes/[id]/page.tsx`) shares the same wider maker, bottom-docked instruction strip labelled "Instructions from admin" / "Changes requested", context-set question type, per-question attachments, and drag/arrow reordering as the admin maker. `/tutor/quizzes/page.tsx` also now splits the Done section into per-subject sub-tables (To do and Submitted stay flat lists). Migration 0027, server actions, typecheck, the 45/45 test suite, the production build, and `db:check-rls` are verified. **Pending owner browser verification 2026-07-27**: building/reordering a context set, scoping an attachment to one question, and confirming Done groups by subject in the browser are still unchecked, so FE stays 🔶. |
| Homework marking | Mark submissions, leave feedback, request resubmission | ✅ | ✅ | `/tutor/homework`, `/tutor/homework/[id]` |
| Upload videos | Class recordings auto-uploaded | ⬜ | ⬜ | No upload pipeline, no Storage bucket for videos. |
| Discussion page (separate row in your spec) | Homework-help inbox | ✅ | ✅ | Covered by `/tutor/discussions` (shipped 2026-05-27) |
| Tutor → student announcements | Mass-message own students | ⬜ | ⬜ | Only admins can post announcements; no per-tutor channel. |
| **(extra) Attendance marking** | Mark per-lesson attendance + notes | ✅ | ✅ | `/tutor/lessons/[id]` |
| **(extra) Lesson notes** | Parent-visible + internal split | ✅ | ✅ | `/tutor/notes`, `/tutor/lessons/[id]`. Strict separation enforced in queries. |
| **(extra) Student profile** | Attendance / homework / lesson-note history per student | ✅ | ✅ | `/tutor/students/[id]` |
| **(extra) Tutor availability** | Weekly recurring slot picker, used by parent reschedule flow | ✅ | ✅ | `/tutor/timetable` "Manage availability" toggle. Sync verified: same rows feed parent reschedule + admin one-off reschedule (`src/lib/availability.ts` → `getAvailableSlots`). Per-day "isolate" button on each cell detaches that specific date from the recurring weekly rules — once isolated, the day's pills edit a date-specific availability set that doesn't ripple back to other weeks, and weekly rule changes won't reach the isolated date until it's re-linked. Both states (recurring + per-date) surface identically to admins/parents via the same query. |
| **(extra) Direct messaging** | 1:1 DMs with admin + students + parents of taught students | ✅ | ✅ | `/tutor/messages` (shipped 2026-05-27). Entry: "Message student" on `/tutor/students/[id]`. |

---

## Student

| Feature | Function | FE | BE | Notes |
|---|---|---|---|---|
| Upcoming classes | Timetable view | ✅ | ✅ | `/student/timetable` + dashboard "This week" calendar |
| Homework upload | Submit due homework | ✅ | ✅ | `/student/homework`, `/student/homework/[id]` with file submission to Supabase Storage |
| Grade page | Track score, compare between students | ✅ | ✅ | `/student/progress` shows mastery + per-subject + per-topic. Clickable subject → `/student/progress/[id]` detail page lists **every submitted task's grade + tutor feedback** + submitted/pending/average-score stats. **Ranking (shipped 2026-06-03):** anonymous per-test rank on `/student/homework/[id]` (when flagged `is_test` + marked) and overall per-subject rank on the progress detail hero — rank only, no peer scores/names exposed. Backed by `RANK()` window queries (`getStudentTestRank`, `getStudentOverallSubjectRank`) + `homework.is_test` column (migration 0008, applied to live DB). Tutors flag a homework as a test via the "Mark as test" checkbox on the homework create form (added 2026-07-25). |
| Resources page | Booklets, recorded videos, past papers | ✅ | ✅ | **Built + runtime-verified (2026-07-23).** `/student/resources` now has a **Library** tab (real `resources` table, subject-scoped to enrolled subjects, filter by type/topic/title, open via short-lived signed URL for files or direct link) alongside the preserved **Recorded lessons** tab. |
| Discussion page | Ask homework questions | ✅ | ✅ | `/student/discussions` — per-subject + general help board (shipped 2026-05-27) |
| Take quizzes | Complete assigned quizzes | 🔶 | 🔶 | **Unranked practice delivery added 2026-07-27.** Approved quizzes appear in enrolled curriculum weeks and open at `/student/quizzes/[id]`. The server verifies enrolment, strips answer keys from the initial payload, grades submitted option IDs server-side, and returns feedback only after checking. Attachments use short-lived signed URLs. This is intentionally non-persistent practice: attempt history, saved scores, rankings, and admin/tutor analytics remain unbuilt. Build, tests, and connected-data eligibility are verified; browser click-through remains pending. **Maker v2 built 2026-07-27** (`docs/changes/2026-07-27-quiz-maker-v2.md`): `src/components/quiz/student-practice-quiz.tsx` now renders a context block's passage (and its own attachment) above its nested sub-questions, and `gradeQuizAnswers`/`validateQuizForSubmit` skip context containers so only leaf questions are graded. No new RLS was needed since sub-questions and per-question attachments are still keyed on `quiz_id`. Typecheck, the 45/45 test suite, and the production build are verified; **pending owner browser verification 2026-07-27** for actually taking a quiz containing a context set. |
| `student_restricted` (parent-dependent) | Younger students — parent owns payments, reschedules, admin contact | ✅ | ✅ | **Built (Spec 1, migrations 0017/0018).** Restricted is the safe default; no payments / reschedule / admin-DM. Gating via `studentTier` + `requireUnrestrictedStudent` (`src/lib/roles.ts`, `src/lib/auth.ts`). |
| `student_unrestricted` (self-managed) | Older / independently enrolled — gets parent-style features on own account | ✅ | ✅ | **Built.** Gets `/student/payments` (own invoices, gated to this tier), self-serve reschedule (interactive timetable → `submitReschedule`), and DM. Online payment still ⬜ (no processor wired). |
| **(extra) Student dashboard** | Next class, due homework, mastery, recent grades, announcements | ✅ | ✅ | `/student` |
| **(extra) Lesson recap viewer** | Read parent-visible tutor note for a past lesson | ✅ | ✅ | `/student/lessons/[id]` |
| **(extra) Subject deep-dive** | Per-subject mastery + topic list | ✅ | ✅ | `/student/subjects/[id]` |
| **(extra) Direct messaging** | 1:1 DMs with tutors + admin | 🔶 | ✅ | `/student/messages` (shipped 2026-05-27). **Entry point added 2026-07-25:** reusable `StudentContacts` (`src/components/student/contacts.tsx`) lists the student's tutors (+ admin office for `student_unrestricted`, per the `canDM` safeguarding rule) with a "Message" action opening `/student/messages/with/[id]`. Mounted on the dashboard right rail AND on the messages inbox (which previously dead-ended with a "start from a contact card" hint but no card). New `getStudentTutors` query. Typecheck-verified; runtime click-through still pending. |
| **(extra) Math game** | Arcade math-drill game with per-difficulty leaderboard | ✅ | ✅ | `/student/math-game` (`math_game_scores` table, migrations 0022/0023). Not in the original role spec. |
 
---

## Parent

You didn't include a parent table — adding it so the picture is complete.

| Feature | Function | FE | BE | Notes |
|---|---|---|---|---|
| Dashboard overview | Child's attendance, homework, latest feedback, payment status | ✅ | ✅ | `/parent` |
| Child switcher | Switch between multiple linked children | ✅ | ✅ | Uses `family_links` |
| Classes view | Calendar + attendance log + reschedule entry point | ✅ | ✅ | `/parent/classes` (combined attendance + bookings on 2026-05-26) |
| Reschedule a class | In-calendar flow: pick lesson → pick slot from same-subject tutors → optional reason | ✅ | ✅ | Submits to admin as in-app notification. No actual lesson-swap automation. Admin can also action a one-off reschedule from `/admin/users/[id]/reschedule/[lessonId]` (shipped 2026-06-03, shared `getAvailableSlots`) and approve/reject requests at `/admin/reschedules`. Student self-serve reschedule now shares this flow (gated to `student_unrestricted`). |
| Class token (makeup credit) | Auto-grant 1 free makeup class when a ≥24h-ahead reschedule has no same-subject slot that week OR the parent declines the offered tutor; redeem self-serve as an extra class in a later week; expires end of term | ⬜ | ⬜ | **Planned (spec'd 2026-06-03).** New `class_tokens` table (status active/spent/expired, grantedFromLessonId, spentOnLessonId, expiresAt). Self-serve booking joins an existing same-subject class with capacity, creates a makeup lesson (reuse `lessons.status='makeup'` + `attendance.status='makeup_attended'`). 24h gate on grant only; tokens stack. **Money implication → admin must see grants + redemptions.** Still unbuilt; the earlier "migration 0010" estimate is stale — 0010 is now `tutor_week_sections_rls`, so this needs a fresh migration number. |
| Homework view (read-only) | Track child's homework completion | ✅ | ✅ | `/parent/homework` |
| Tutor feedback feed | Parent-visible comments only; localStorage read/unread | ✅ | ✅ | `/parent/feedback` + "From the tutor" block on dashboard |
| Progress page | Per-subject mastery + topics + attendance + homework | ✅ | ✅ | `/parent/progress` (added 2026-05-26) |
| Payments | View invoices, statuses | ✅ | ✅ | `/parent/payments` (read-only; no online pay yet) |
| Online payment | Pay invoice via Stripe/etc. | ⬜ | ⬜ | Stub link exists; no payment processor wired. |
| Direct message tutor / admin | Per PRD §11 — message categories routed to right person | ✅ | ✅ | `/parent/messages` — 1:1 DMs with kids' tutors + admin (shipped 2026-05-27). Entry points on parent dashboard contact block. Student dashboard contact card still pending (memory: project_pending_student_dm_entry) |
| **(extra) Outstanding-balance stat** | Surfaced on dashboard | ✅ | ✅ | |
| **(extra) Resources mirror** | Read-only resource library for child's subjects | ✅ | ✅ | **Built + runtime-verified (2026-07-23).** `/parent/resources` — same library as student view, scoped via child's enrolled subjects (`childSubjectIds`); open via `openResourceForParent`. |

---

## Cross-cutting (not in your role spec, worth tracking)

| Feature | FE | BE | Notes |
|---|---|---|---|
| Auth (Supabase) | ✅ | ✅ | Login, password reset, role-gated middleware |
| Role-based routing | ✅ | ✅ | `middleware.ts` + `requireRole` per layout |
| Notifications inbox | 🔶 | ✅ | **Unified 2026-07-27.** All four routes use `src/components/notifications/inbox-page.tsx`. The shared grouping layer puts Messages and Action needed before Learning updates, Announcements, and Other updates, with visible section dividers and unit-tested classification. Browser visual verification across roles remains pending. |
| Email delivery | ⬜ | ⬜ | No Resend/SES wired. Notifications stay in-app only. |
| RLS policies | — | ✅ | **Built.** RLS enabled on every public table (migrations 0004/0005/0012) + policies through 0016. See `docs/security-checklist.md` A1 (✓) and `docs/SECURITY.md`. ⚠️ `db:push` wipes all of this — re-apply migrations after any push. |
| Audit logs | — | ✅ | **Built.** `audit_logs` + triggers on the six watched tables (migration 0006); actor capture via `withActor` (`src/lib/with-actor.ts`). See security-checklist G1. |

---

## From the 2026-05-26 Excel-vs-portal audit

These are operational admin gaps where the admin still relies on the spreadsheet. Roughly in priority order.

| Gap | FE | BE | Notes |
|---|---|---|---|
| Per-enrolment admin notes (`T3INV`, `MOVE CLASS BY NW`, `HOLS 03/07 - 10/07`) | ⬜ | 🔶 | **Correction 2026-07-25: previously marked Built, but it was not.** `enrollments.admin_notes` column exists (`src/db/schema.ts:193`) but is used NOWHERE - no UI, no action, no query. Same per-enrolment editing plumbing as delivery mode (now built), so a notes field in `enrollments-manager.tsx` + a `setAdminNotes` action is a ~15 min follow-up. |
| `school` field on student profiles | ✅ | ✅ | **Built.** `profiles.school` column + create / edit-user forms + surfaced in `/admin/users` list. |
| Students Leaving admin view | ✅ | ✅ | `/admin/leaving` list view built. |
| Primary-contact toggle on `family_links` | 🔶 | 🔶 | **Built 2026-07-25, pending runtime verify.** "Make primary" button + "Primary" text badge on each row of the family-links editor (`family-links-manager.tsx`); `setPrimaryContact` action (`actions-users.ts`) enforces one primary per student (clears others in the same txn) and audits via `withActor`. `is_primary_contact` threaded through `/admin/users/[id]`. **Not yet consumed** by billing / notification routing - that read is a separate follow-up. |
| Per-student delivery mode within shared class (online/in-person) | 🔶 | 🔶 | **Built 2026-07-25, pending runtime verify.** Per-row Default / In person / Online select in the enrolments manager (`enrollments-manager.tsx`) with optimistic feedback; `setDeliveryMode` action (`actions-enrollments.ts`, audited). `delivery_mode` threaded through `/admin/classes/[id]`. **Not yet surfaced to tutors** on attendance / lesson views - follow-up. |
| Per-student leave/holiday tracking | ⬜ | ⬜ | Excel encodes as `HOLS 03/07 - 10/07 + 10/08`. Without it tutors mark absent every day during a known holiday. |

---

## Backlog - 2026-07-28 owner braindump

Captured from the owner so nothing is lost.
All items are ⬜ not built unless a real partial already exists.
Tags: [DECISION] needs an owner answer before it can be planned; [INFRA] needs a scheduling/automation mechanism the app lacks today (Next.js has no cron - time-based jobs need Supabase scheduled functions or an external scheduler); [PII] introduces sensitive fields that need an access decision.

### Reports (refines the Admin "Reporting" row)

| Item | FE | BE | Notes |
|---|---|---|---|
| Operational report - on-page, term-searchable | 🔶 | 🔶 | Already built at `/admin/reports` (attendance %, class average, homework completion %, class fill). Owner confirms it stays an on-page report you can search across terms, NOT a download. Verify the term switch/search UX matches this intent. |
| Financial report - PDF download | ⬜ | ⬜ | Revenue/overdue as a downloadable PDF (not CSV). Must sit behind the `/admin/revenue` PIN gate. |
| Student report - PDF + notification | ⬜ | ⬜ | Automated per-student term report (e.g. "Term 4 report") delivered as a PDF with an in-app notification. [DECISION] letter-grade scheme is undefined ("B+ means ..."). [DECISION] the AI helper that drafts the report notes from the tutor's rough notes needs its input source, model, and guardrails defined. |
| Student report visibility gate | ⬜ | ⬜ | `student_restricted` cannot view student reports; only `student_unrestricted` (and parents) can. |
| Download format decision | - | - | PDF for financial + student reports; operational stays on-page. Supersedes the earlier CSV-export direction for these two. |

### Assessments (refines the quiz/exam direction)

| Item | FE | BE | Notes |
|---|---|---|---|
| Weekly quiz | 🔶 | ✅ | Built as unranked practice. |
| End-of-term term test + separate leaderboard | ⬜ | ⬜ | A ranked term test whose leaderboard is SEPARATE from the weekly quizzes. |
| Half-term major-topic exam (sat outside portal) | ⬜ | ⬜ | Big mid-semester-style exam sat outside the portal; no leaderboard; portal may only record the result. |

### Payments (Admin + Parent)

| Item | FE | BE | Notes |
|---|---|---|---|
| In-portal payment linked to admin | ⬜ | ⬜ | [DECISION] processor: owner asked "use third party?" - Stripe vs manual-only needs deciding; this gates the whole cluster. |
| Per-term / per-month payment model | ⬜ | ⬜ | Support both billing cadences. |
| Cash option + admin-editable status | ⬜ | 🔶 | Parent contacts admin to pay cash; admin edits the payment status. Manual mark-as-paid already exists at `/admin/payments`; still needs the cash/contact flow + per-term/month structure. |

### Enrolment, trials, and class visibility (Admin + Tutor + Parent)

| Item | FE | BE | Notes |
|---|---|---|---|
| No cancel-with-refund after term starts | ⬜ | ⬜ | Once a term begins, a class cannot be quit for a refund. Enforced in the cancel/refund flow, which itself is not built. |
| Hide other-term classes from enrolled parents | ⬜ | ⬜ | Parents only see the current term's classes; previous/next term classes are hidden while enrolled. |
| Free-trial tracking | ⬜ | ⬜ | Record a trial start + end date. Tutor can see if a student is on a free trial. [INFRA] automated notification if a free-trial student misses a class. When a trial ends, a notification prompts the admin to manually send the follow-up (the message itself is not automated). |
| Discontinued-students tab (admin users) | ⬜ | 🔶 | A separate tab on the admin users view for discontinued students. `/admin/leaving` already lists leaving students; this may be a tab/filter on `/admin/users`. |

### Reschedule and class credits (Parent + Admin)

| Item | FE | BE | Notes |
|---|---|---|---|
| Cancellation -> class credit | ⬜ | ⬜ | Cancelling a class grants a class credit. |
| Reschedule -> class credit when no slot | ⬜ | ⬜ | If there is no class to reschedule into, grant a class credit instead. |
| Reschedule/cancellation limits | ⬜ | ⬜ | Cancellation: 24h prior, max 3 per term. Reschedule: 1 week prior, max 3 per term (counted separately from cancellations). Group classes: reschedule 7 days prior. Makeup/reschedule only within a 7-day window. [DECISION] confirm exact window interpretation at planning time. |
| "Contact admin" routes to messages -> admin | ⬜ | 🔶 | When no reschedule slot works in the parent's favour, a "contact admin" option ALWAYS routes to the messages page addressed to admin, never a separate contact page. Reschedule flow + messaging both exist; this is the routing rule. |

### Notifications (cross-cutting)

| Item | FE | BE | Notes |
|---|---|---|---|
| Unread red badge + count | ⬜ | 🔶 | Red badge next to the notifications icon showing the number of new/unread items. Notifications backend exists; needs an unread-count query + badge UI. |
| Term-end automated message | ⬜ | ⬜ | [INFRA] ~2 weeks before a term ends, automatically notify parents + `student_unrestricted`. Needs a scheduled job. |

### Admin - tutor management

| Item | FE | BE | Notes |
|---|---|---|---|
| All-tutors admin tab | ⬜ | ⬜ | A dedicated admin tab listing every tutor with BSB/account number, account details, subjects they can tutor, and class schedule. [PII] tutor bank details need a schema + access decision (likely `admin_unrestricted` only). Overlaps the existing "view others' availability" gap. |

### Cross-cutting UI

| Item | FE | BE | Notes |
|---|---|---|---|
| Login page wave effect | ⬜ | - | Animated wave visual on the login page. [DECISION] style reference (SVG wave, gradient, motion) to match the portal. |
| Light / dark mode | ⬜ | - | Full light/dark theming across all four portals. Large cross-cutting effort. The codebase already uses CSS vars + `theme-*` scopes, so this is a semantic-token audit + a toggle, not per-component hardcoding. |

---

## Role Tiering (student & admin)

Drafted 2026-05-27. **Implementation status (updated 2026-07-22):** the `userRoleEnum` now carries all six tiered values (migrations 0017/0018) alongside the legacy coarse values. **Student tiers are fully built** per the matrix below (Spec 1 — payments / reschedule / DM gated to `student_unrestricted`). **Admin tiers are only partially built:** the enum values exist but there is *no* per-feature permission gating — financial exposure was descoped to a single PIN wall on `/admin/revenue` (migrations 0020/0021). The **admin** matrix below therefore remains a *target spec*, not current behaviour. Tutor and parent are unchanged.

Target enum: `admin_unrestricted | admin_restricted | tutor | parent | student_unrestricted | student_restricted`.

### Student tiers

- **`student_restricted`** — younger students still dependent on a parent. Current student-portal scope is correct for this tier (no payments, no rescheduling, no admin contact). Parent owns those flows via their own account.
- **`student_unrestricted`** — older / independently enrolled students (typically VCE or post-secondary) who manage their own account. Gets selected parent-portal features on the student account itself. A linked parent may still exist if the student wants — see "Coexistence with linked parent" below.

| Feature | `student_restricted` | `student_unrestricted` | Source |
|---|---|---|---|
| Homework view + submit | ✅ | ✅ | existing |
| Timetable | ✅ | ✅ | existing |
| Lesson recap viewer | ✅ | ✅ | existing |
| Resources / progress / subject deep-dive | ✅ | ✅ | existing |
| Discussion / homework help | ✅ (when built) | ✅ (when built) | existing |
| **Payments view (own invoices)** | ❌ | ✅ | from parent portal |
| **Online payment** | ❌ | ✅ | from parent portal |
| **Reschedule own lesson** | ❌ | ✅ | currently parent-only |
| **DM admin / tutor** | ❌ | ✅ | from parent portal |
| **Outstanding-balance stat on dashboard** | ❌ | ✅ | from parent portal |
| Tutor feedback feed (parent-visible only) | ✅ | ✅ | already visible to student |
| Switch between other children's profiles | ❌ | ❌ | parent's child-switcher does NOT carry over — students only ever see self |

#### Coexistence with linked parent

A `student_unrestricted` account can still have a parent linked via `family_links` if both parties want. When both exist:

- Both see the same invoices, reschedules, attendance, feedback.
- `family_links.is_primary_contact` (proposed — see gap row above) decides who receives billing notifications and who admin contacts first.
- Either party can act on a reschedule / payment; admin sees who initiated.

If no parent is linked, the student is the de facto primary contact.

### Admin tiers

- **`admin_restricted`** — reception / front-desk / lower-tier admin. Daily operations only; no access to financial controls, role escalation, or audit logs.
- **`admin_unrestricted`** — owner and high-level employees. All access including financials, role management, audit logs.

| Feature | `admin_restricted` (reception) | `admin_unrestricted` (owner) |
|---|---|---|
| Operations dashboard | ✅ but **revenue tile hidden** | ✅ full |
| Create student / parent accounts | ✅ | ✅ |
| Password reset (student / parent / tutor) | ✅ | ✅ |
| Edit `family_links` | ✅ | ✅ |
| **Create / promote admin or tutor accounts** | ❌ | ✅ |
| **Change a user's role** | ❌ | ✅ |
| Class / schedule management | ✅ | ✅ |
| View tutor availability | ✅ | ✅ |
| Attendance views | ✅ | ✅ |
| Enrolment: enrol / move / waitlist / trial | ✅ | ✅ |
| **Withdraw student** (triggers refund logic) | initiate only — flags for review | finalize / approve |
| **Mark cash payment received** (manual mark-as-paid) | ✅ | ✅ |
| **Create invoice** | ❌ | ✅ |
| **Apply discount** | ❌ | ✅ |
| **Process refund** | ❌ | ✅ |
| Payment list view (who has paid) | ✅ read-only | ✅ |
| **Revenue / retention / churn reports** | ❌ | ✅ |
| Attendance / homework / tutor-note reports | ✅ | ✅ |
| Announcements | ✅ | ✅ |
| Make-up class approval | ✅ | ✅ |
| Resource approval | ✅ | ✅ |
| **Audit log access** | ❌ | ✅ |
| **Bulk export of personal data** | ❌ | ✅ |

#### Judgment calls (worth revisiting)

- **Cash payment receipt** is in `admin_restricted` because parents pay at the desk and reception needs to mark it. It is a write to `payments`, but the *amount* is fixed by the invoice — reception can't alter the figure.
- **Withdraw student** is split: reception can initiate (flag the student as leaving), `admin_unrestricted` finalizes (which is what releases any refund). Avoids reception being blocked on common ops while keeping money decisions gated.
- **Payment list view (read-only)** is allowed for reception so they can answer "is this family up to date?" without seeing revenue aggregates.

### Implementation notes (student tiers coded; admin tiers only partially)

- Enum migration: `userRoleEnum` grows to six values. Existing `admin` rows migrate to `admin_unrestricted` (safe default — preserves current capabilities); existing `student` rows migrate to `student_restricted` (safe default — most students are still parent-dependent).
- `requireRole` helper should accept a *set* of acceptable tiers so route guards can express "either admin tier" without enumerating.
- Middleware route gates need per-feature checks, not just per-portal — e.g. `/admin/payments/refund` must reject `admin_restricted` even though `/admin/payments` accepts it.
- `app_metadata.role` flip in Supabase auth (per `security:` commit 124bfb7) needs to handle the new values.
- Dashboard tiles for `admin_restricted` filter out revenue at the data layer, not just hide in UI.
