# Quiz Delivery and Notification Consistency

Date: 2026-07-27
Branch: `feat/quiz-maker`
Status: Code, migration, automated tests, production build, connected-data checks, and RLS audit complete.
Manual browser verification remains pending because the in-app browser runtime was unavailable in this session.

## Requested outcomes

- Remove the apparent duplicate Week 1 choices.
- Allow quiz title changes during and after creation.
- Allow files and images to be attached to a quiz.
- Replace the admin Submit for review action with Approve in the same primary-action position.
- Make approved quizzes visible to eligible tutors and students.
- Make the quiz maker fuller, clearer, and more engaging without leaving the Tayio visual system.
- Use one notification experience for every role.
- Divide direct and important notifications from announcements and general activity.
- Record the notification consistency rule in `CLAUDE.md`.

## Root-cause findings

### Apparent duplicate Week 1

The connected database has no duplicate `subject_weeks` rows for the same subject, term, and week.
The two choices are valid rows from different terms, such as 2026 Term 1 Week 1 and 2026 Term 2 Week 1.
The selector previously displayed only the subject and week number, which made those rows look identical.
No curriculum data was deleted.

The UI now displays subject, year, term, and week.
It also removes any concrete subject-week that already owns a quiz.
Migration 0026 adds a unique index on `quizzes.subject_week_id` so concurrent requests cannot create a second quiz for the same concrete curriculum week.

### Missing quiz for tutors and students

The existing Year 9 English Term 2 Week 1 quiz was approved and unassigned.
The tutor list previously selected only rows whose `assigned_tutor_id` matched the tutor.
The student curriculum query did not fetch quizzes at all.

Tutors now receive assigned quizzes plus approved common quizzes for any subject they teach.
Student and tutor curriculum weeks now include the approved quiz that belongs to that exact `subject_weeks` row.
The connected data check found one eligible tutor and two actively enrolled eligible students for the existing quiz.

### Inconsistent notifications

Admin and parent already used a shared inbox component.
Student and tutor had separate implementations with different visual and grouping behaviour.
All four role routes now render the same shared inbox and the same grouping rules.

## Behaviour delivered

### Quiz identity and lifecycle

- `src/lib/quiz-status.ts` formats unambiguous subject, year, term, and week labels.
- `src/lib/quiz-queries.ts` excludes occupied curriculum weeks from create/request choices.
- `src/app/_actions/quizzes.ts` checks for an existing quiz before insertion and converts database unique violations into a friendly error.
- `src/db/schema.ts` and migration 0026 define the unique subject-week index.
- `src/app/_actions/quizzes.ts` adds a validated `updateQuizTitle` action.
- Assigned tutors can rename a quiz only in their editable lifecycle states.
- Admins can rename any quiz, including an approved quiz, without reopening or changing its questions.
- Admin-direct drafts use Approve as their primary maker action.
- Admin approval is restricted to admin-direct drafts and tutor submissions that are pending review.
- Tutor-editable quizzes use Submit for review as their primary maker action.
- Admins never receive a Submit for review action.
- The separate review control retains only the secondary Send back flow.

### Files and images

- `src/db/schema.ts` adds `quiz_attachments` metadata.
- `supabase/migrations/0026_quiz_delivery.sql` creates the table, index, policies, and audit trigger.
- `src/lib/upload-validation.ts` adds the quiz attachment policy.
- `src/lib/quiz-storage.ts` uploads, deletes, and signs private quiz files.
- The existing private `resource-library` bucket is reused.
- Files use randomized quiz-scoped storage paths.
- Supported uploads use the existing document and image MIME allowlist.
- Each file is limited to 10 MB.
- Each request is limited to three files.
- Each quiz is limited to six files.
- If the database write fails, newly staged storage files are removed.
- The maker displays image previews and download links for other supported files.
- Student attachment links use short-lived signed URLs after access is authorized.

### Tutor delivery

- `src/lib/quiz-queries.ts` includes approved common quizzes for subjects taught by the current tutor.
- Tutor quiz detail authorization accepts either the assigned author or a tutor who teaches the approved quiz subject.
- `src/app/tutor/quizzes/page.tsx` and `src/app/tutor/quizzes/[id]/page.tsx` display the full term-aware identity.
- `src/app/tutor/classes/[id]/curriculum/_queries.ts` joins the approved quiz into the correct curriculum week.
- `src/app/tutor/classes/[id]/curriculum/_components/section-editor.tsx` displays an approved quiz card and links to its detail.
- Migration 0026 adds tutor read policies for approved quiz rows, questions, options, and attachments in taught subjects.

### Student delivery and practice grading

- `src/app/student/subjects/[id]/_queries.ts` joins approved quizzes into enrolled curriculum weeks.
- `src/app/student/subjects/[id]/_components/week-content.tsx` displays a weekly quiz card.
- `src/app/student/quizzes/[id]/page.tsx` is the enrolment-gated student route.
- `src/components/quiz/student-practice-quiz.tsx` renders the interactive unranked practice experience.
- `src/lib/quiz-queries.ts` checks active enrolment before loading the student quiz.
- The student query intentionally omits `is_correct`.
- `src/lib/quiz-validation.ts` validates one option per question and rejects missing, duplicate, or cross-question answers.
- `gradePracticeQuiz` repeats the role and enrolment checks and grades against the server-side answer key.
- Correct answers and per-question feedback are returned only after submission.
- Practice attempts are not stored.
- Saved scores, history, ranking, and admin/tutor analytics remain outside this delivery.

### Quiz maker redesign

- `src/components/quiz/quiz-maker.tsx` now fills the available content width.
- The desktop layout uses a question canvas and a sticky tools, files, and readiness rail.
- Question cards have stronger hierarchy, type chips, accent treatment, clearer option grids, and compact controls.
- Title editing is available in the maker header.
- Attachment management is part of the same workspace.
- Readiness counts and progress communicate whether the quiz can advance.
- Interactive controls meet the 44px target size where practical.
- Focus states, semantic labels, responsive layouts, disabled pending states, and reduced-motion handling are included.
- Tayio radius, colour, typography, accent, and motion conventions are retained.
- Admin and tutor pages use a wider 1400px content boundary to support the redesigned workspace.

### Notification consistency and dividers

- `src/components/notifications/inbox-page.tsx` is the single shared presentation for admin, parent, tutor, and student.
- `src/app/admin/notifications/page.tsx` and `src/app/parent/notifications/page.tsx` continue to use that shared component.
- `src/app/tutor/notifications/page.tsx` and `src/app/student/notifications/page.tsx` now use the same component.
- `src/components/student/notifications-inbox.tsx` is retained only as a compatibility re-export.
- `src/lib/notification-groups.ts` classifies notifications consistently.
- The visible order is Messages, Action needed, Learning updates, Announcements, and Other updates.
- Each non-empty category has a labelled divider, description, icon, and count.
- Direct messages and action-needed items appear before announcements regardless of timestamp.
- A quiz submitted for admin review is classified as Action needed, while a completed approval is a Learning update.
- `src/lib/notification-groups.test.ts` covers the category mapping and priority order.
- `CLAUDE.md` now forbids role-specific notification inbox forks and requires classification tests for new types.

### Database security and audit tooling

- Migration 0026 enables RLS on `quiz_attachments`.
- Admins have full attachment access.
- Assigned tutors can manage attachments for their quiz.
- Tutors can read approved attachments for subjects they teach.
- Students can read approved attachment metadata only for enrolled subjects.
- Student RLS does not expose quiz question or option tables because `quiz_options` contains the answer key.
- Student question delivery stays behind the enrolment-checked server query that strips answer-key data.
- Attachment writes are recorded by the existing audit trigger.
- `scripts/check-rls.mjs` now recognises `admin_settings`, `math_game_scores`, and `reschedule_requests` as intentional RLS deny-all tables.
- The checker still fails for an unknown public table with no policies.
- Its completion message now distinguishes policy-protected tables from intentional deny-all tables.

## Files changed

### Data, security, and storage

- `src/db/schema.ts`
- `supabase/migrations/0026_quiz_delivery.sql`
- `src/lib/upload-validation.ts`
- `src/lib/quiz-storage.ts`
- `scripts/check-rls.mjs`

### Quiz domain and actions

- `src/app/_actions/quizzes.ts`
- `src/lib/quiz-queries.ts`
- `src/lib/quiz-status.ts`
- `src/lib/quiz-status.test.ts`
- `src/lib/quiz-validation.ts`
- `src/lib/quiz-validation.test.ts`

### Admin and tutor quiz UI

- `src/components/quiz/quiz-maker.tsx`
- `src/app/admin/quizzes/page.tsx`
- `src/app/admin/quizzes/[id]/page.tsx`
- `src/app/admin/quizzes/[id]/_components/review-controls.tsx`
- `src/app/admin/quizzes/_components/new-quiz-form.tsx`
- `src/app/admin/quizzes/_components/request-quiz-form.tsx`
- `src/app/tutor/quizzes/page.tsx`
- `src/app/tutor/quizzes/[id]/page.tsx`
- `src/app/tutor/classes/[id]/curriculum/_queries.ts`
- `src/app/tutor/classes/[id]/curriculum/_components/section-editor.tsx`

### Student quiz UI

- `src/app/student/subjects/[id]/_queries.ts`
- `src/app/student/subjects/[id]/_components/week-content.tsx`
- `src/app/student/quizzes/[id]/page.tsx`
- `src/components/quiz/student-practice-quiz.tsx`

### Notification UI

- `src/components/notifications/inbox-page.tsx`
- `src/lib/notification-groups.ts`
- `src/lib/notification-groups.test.ts`
- `src/app/student/notifications/page.tsx`
- `src/app/tutor/notifications/page.tsx`
- `src/components/student/notifications-inbox.tsx`

### Project records

- `CLAUDE.md`
- `docs/checklist.md`
- `docs/security-checklist.md`
- `docs/superpowers/specs/2026-07-26-quiz-maker-design.md`
- `docs/changes/2026-07-27-quiz-delivery-notifications.md`

## Migration and data impact

Migration 0026 was applied successfully to the connected Supabase database on 2026-07-27.
It created the attachment table, added the unique quiz index, and added delivery policies.
It did not delete or rewrite curriculum, quiz, question, option, enrolment, class, or notification data.
The existing approved Year 9 English Term 2 Week 1 quiz remains intact.

The unique constraint is intentionally attached to the concrete `subject_weeks` row.
Term 1 Week 1 and Term 2 Week 1 remain separate valid quiz targets.

## Verification evidence

- `npm run typecheck` passed.
- `npm test` passed all 46 tests across 8 files.
- `npm run build` passed after network access was allowed for the existing Google font download.
- The production build includes `/student/quizzes/[id]`.
- `npm run db:check-rls` passed for all 37 public tables.
- The connected database has no duplicate subject, term, and week rows.
- The connected database has the new unique index and `quiz_attachments` table.
- The private `resource-library` bucket exists.
- The existing Year 9 English Term 2 Week 1 quiz is approved and has one question.
- The existing quiz resolves to one eligible tutor and two active eligible student enrolments.
- The notification grouping tests prove that a direct message is ordered before an announcement.
- `git diff --check` passed before documentation was added and is rerun at final handoff.

## Manual verification still required

The in-app browser skill required a Node browser runtime that was not available in this session.
No claim is made that the new screens were visually clicked through on a device.
The exact outstanding browser checks are recorded in `docs/checklist.md`.
