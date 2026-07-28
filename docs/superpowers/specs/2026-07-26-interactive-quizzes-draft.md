# Interactive Quizzes + Test-Week Rankings - Design Scoping Draft

Status: DRAFT for human review (not a final spec).
Date: 2026-07-26.
Author: scoping agent.
Scope: replace the per-homework `is_test` ranking flag with (a) in-app interactive auto-graded quizzes, (b) curriculum "test week" designation that makes a quiz count toward rankings automatically, and (c) a common exam shared across all class sections of a subject so rankings are genuinely subject/year-wide.

This document names options and gives a recommendation for each, grounded in the current schema.
It deliberately flags where the schema makes something easy or hard.
It is a starting point, not a build order.

## 0. What exists today (grounding)

Curriculum template model (shared across all classes of a subject):

- `terms` (`src/db/schema.ts:595`) - year + term_number, unique on (year, term_number).
- `subjectTopics` (`src/db/schema.ts:608`) - named topics under a subject.
- `subjectWeeks` (`src/db/schema.ts:626`) - the shared weekly template: `subjectId`, `termId`, `topicId`, `weekNumber`, `title`, unique on (subjectId, termId, weekNumber). This is the single row every class of a subject shares. It is the natural anchor for "test week".
- `tutorWeekSections` (`src/db/schema.ts:652`) - a tutor's per-(tutor, subjectWeek) overlay (notes/attachments). Per tutor, not per class.
- `tutorWeekAttachments` (`src/db/schema.ts:672`) - files/links hung off a tutor section.

Assessment + ranking today:

- `homework` (`src/db/schema.ts:301`) - `classId` (nullable, `:303`), `weekId` -> `subjectWeeks` (nullable, `:314`), `isTest` boolean (`:313`), `tutorId`. Homework is authored per class; the `weekId` links it to the shared week only for organisation.
- `homeworkAssignments` (`src/db/schema.ts:318`) - PK (homeworkId, studentId), `score` numeric(5,2) (`:331`). This is where a score lives.
- `getStudentTestRank` (`src/app/student/_lib/queries.ts:596`) - ranks students by `score` within one homework row where `is_test = true`.
- `getStudentOverallSubjectRank` (`src/app/student/_lib/queries.ts:628`) - averages each student's `is_test` homework scores, joining `homework -> classes -> subject`, ranks by average.
- `isTest` is also read by admin reports (`src/app/admin/_lib/reports-queries.ts:117`) and shown in the student homework hero (`src/app/student/homework/[id]/page.tsx:135`, rank fetch at `:72`) and the progress page (`src/app/student/progress/[id]/page.tsx:95`).
- The "Mark as test" checkbox is in `section-editor.tsx:466` and consumed in `createHomework` (`src/app/tutor/_actions.ts:183`, insert at `:245`).

Key structural fact that makes the "common exam" genuinely new:
today a "test" is a per-class `homework` row.
Two classes of the same subject sitting "the same test" are actually two different `homework` rows with two different `weekId`-linked assessments.
`getStudentOverallSubjectRank` papers over this by averaging scores across those separate rows.
There is no entity today that means "one assessment, authored once, taken by every enrolled student in the subject." That is the new concept in section 3.

Does subject == year level?
`subjects` (`src/db/schema.ts:148`) has a unique `name` (`:150`) and a nullable `yearLevel` text column (`:151`).
So a subject can carry a year level, but it is optional and free-text.
In practice subjects appear to be named per cohort (unique name), so "subject-wide" is the closest thing to "year-wide" the schema offers today.
This matters: the ranking cohort we can define cleanly is "all students enrolled in any class of subject X", not "all Year 7 students" in the abstract.
Recommendation: treat the ranking cohort as subject-scoped, and if true year-wide grouping is ever needed, promote `yearLevel` to a first-class concept then - do not overbuild it now (see open questions).

## 1. Quiz data model

Goal: students answer questions in-app, auto-graded, score lands somewhere the ranking can read.

### Proposed tables

`quizzes`
- `id` uuid pk.
- `subjectId` uuid not null -> subjects (authored at subject level; see section 3 for why this, not classId).
- `subjectWeekId` uuid null -> subject_weeks (which week it belongs to; null allowed for ad-hoc quizzes).
- `title` text not null.
- `description` text.
- `createdBy` uuid not null -> profiles.
- `totalPoints` integer not null default 0 (denormalised sum of question points, maintained on write; lets ranking and UI avoid a per-render aggregate).
- `isPublished` boolean not null default false (draft vs live; students only see published).
- `opensAt` / `dueAt` timestamptz null (optional availability window).
- `createdAt` timestamptz.

`quiz_questions`
- `id` uuid pk.
- `quizId` uuid not null -> quizzes (on delete cascade).
- `position` integer not null.
- `type` enum `quiz_question_type` in { `multiple_choice`, `short_answer` } for v1.
- `prompt` text not null.
- `points` integer not null default 1.
- `acceptedAnswers` text[] null (short-answer only: list of accepted strings; normalised compare, see grading).

`quiz_options` (multiple-choice only)
- `id` uuid pk.
- `questionId` uuid not null -> quiz_questions (cascade).
- `position` integer not null.
- `label` text not null.
- `isCorrect` boolean not null default false.

`quiz_attempts`
- `id` uuid pk.
- `quizId` uuid not null -> quizzes.
- `studentId` uuid not null -> profiles.
- `startedAt` timestamptz not null default now().
- `submittedAt` timestamptz null (null = in progress).
- `score` numeric(5,2) null (auto-graded total, filled on submit; matches `homeworkAssignments.score` precision so ranking SQL is uniform).
- `maxScore` integer not null (snapshot of quiz.totalPoints at submit time, so later question edits do not retroactively change a graded attempt).
- Unique index on (quizId, studentId) for v1 (one attempt per student; relax later if retakes are wanted - see open questions).

`quiz_responses`
- `id` uuid pk.
- `attemptId` uuid not null -> quiz_attempts (cascade).
- `questionId` uuid not null -> quiz_questions.
- `selectedOptionId` uuid null -> quiz_options (multiple-choice answer).
- `answerText` text null (short-answer answer).
- `awardedPoints` numeric(5,2) not null default 0 (per-question grade).
- Unique index on (attemptId, questionId).

### Question types for v1

- `multiple_choice`: one correct option (single-select). Auto-grade = award `points` if `selectedOptionId` matches the option with `isCorrect = true`.
- `short_answer`: award `points` if `normalise(answerText)` is in `normalise(acceptedAnswers)`. Normalise = trim + lowercase + collapse whitespace. This is deliberately simple and will produce false negatives on typos/synonyms; that is acceptable for a v1 and is called out as an open question.

Deferring to later: multi-select, numeric-with-tolerance, ordering, matching, image questions, and any free-text that needs human/AI marking.

### How scoring / auto-grading works

- Grading runs server-side inside the "submit attempt" server action, never on the client (the client must never see `isCorrect` or `acceptedAnswers`).
- On submit: for each response compute `awardedPoints`, sum into `quiz_attempts.score`, snapshot `maxScore = quiz.totalPoints`, set `submittedAt`.
- The quiz-taking client fetches questions/options with `isCorrect`/`acceptedAnswers` stripped out at the query layer (a dedicated student-facing select, not `select *`).
- Idempotency: the unique (quizId, studentId) constraint plus a check that `submittedAt is null` before grading prevents double submission.

Why a separate `quiz_attempts.score` rather than reusing `homeworkAssignments`:
quizzes are auto-graded and have no submission file/resubmission/marked-by lifecycle, so overloading `homeworkAssignments` would force nullable columns and status values that never apply.
A clean attempts table keeps both models honest and keeps the ranking SQL a simple union of two score sources during the transition (section 4).

## 2. "Test week" designation

Two options for "this week's quizzes count toward rankings."

Option A - automatic, every Nth week.
Rule like "every 3rd week is a test week", derived from `subjectWeeks.weekNumber % 3 == 0`.
- Pros: zero extra data; matches the owner's "every 3 weeks there is a test" phrasing.
- Cons: brittle. The cadence is a guess, it cannot vary per subject or term, holidays/catch-up weeks shift the count, and there is no way to mark an unplanned assessment or un-mark a week. It also hides an important, ranking-affecting fact inside a magic constant. This violates the project's "no magic, production-quality" bar.

Option B - explicit `is_test_week` flag on `subject_weeks`.
Add `isTestWeek boolean not null default false` to `subjectWeeks` (`src/db/schema.ts:626`).
- Pros: one column, lives exactly where the shared curriculum template lives, so it is set once per subject/term and every class of that subject inherits it automatically. Admin (who owns the curriculum template) ticks it while building weeks. It is explicit, auditable, and overridable. It composes with the existing unique (subjectId, termId, weekNumber) structure with zero friction.
- Cons: someone has to set it (a feature, not a bug - it makes the assessment calendar intentional).

Recommendation: Option B.
It is barely more work than A, removes all the cadence brittleness, and puts the flag on the row that is already the single shared point across class sections.
Option A can even be offered as a convenience default in the admin UI ("mark every Nth week") that just writes the Option B flags - best of both, with the flag as the source of truth.

How a quiz gets associated with a test week's section:
a quiz carries `subjectWeekId` (section 1).
A quiz "counts" when its `subjectWeekId` points at a `subjectWeek` whose `isTestWeek = true` (and the quiz is published and the attempt is submitted).
No manual per-quiz checkbox - the ranking eligibility is derived: `quiz.subjectWeekId -> subjectWeek.isTestWeek`.
This is the direct structural replacement for `homework.isTest`.

## 3. The common / shared exam across class sections

Requirement: one assessment authored once at the subject level, taken by every enrolled student across every class section, so the ranking cohort is the whole subject.

Today's model (contrast):
`homework.classId` (`src/db/schema.ts:303`) binds an assessment to one class.
Each tutor authors their own homework row; there is no shared assessment entity.

The change, and why the quiz model already gives it to us:
in section 1 the quiz is anchored to `subjectId` (+ optional `subjectWeekId`), not `classId`.
That single decision is what makes it a common exam:

- Authored once against the subject/week.
- The eligible cohort is "every student with an active enrollment in any class of that subject" - resolvable via `enrollments -> classes.subjectId` (`src/db/schema.ts:181`, `:155`), which is exactly what `can_see_subject` already computes in `0024_resources.sql`.
- Every such student takes the same `quiz_questions`, so `quiz_attempts.score` values are directly comparable. This is the genuine subject-wide ranking that the homework model only approximated.

New entity / columns needed for this (vs today):
- `quizzes.subjectId` (subject-level authorship) - the core new idea.
- `quizzes.subjectWeekId` (ties the common exam into the shared curriculum week, so test-week designation flows through).
- No `classId` on quizzes at all for the common-exam case. (If per-class practice quizzes are ever wanted, add a nullable `classId` later and treat `null` as "subject-wide common exam". Do not add it in v1 unless the owner asks - YAGNI.)

Authoring/ownership question this raises: who authors the common exam?
If any tutor of the subject can, two tutors could create conflicting "the" exams for one week.
Recommendation: author common exams at the admin/curriculum level (same role that owns `subjectWeeks`), with tutors able to view results.
This is an open question for the owner (section 6).

## 4. Ranking change

New ranking source: submitted `quiz_attempts` for quizzes whose week is a test week.

Replacement for `getStudentTestRank` (per single assessment):
rank students by `quiz_attempts.score` within one `quizId` where `submittedAt is not null`.
Structurally identical to the current per-homework rank (`src/app/student/_lib/queries.ts:596`), just reading `quiz_attempts` instead of `homeworkAssignments`, and keyed by quizId.

Replacement for `getStudentOverallSubjectRank` (subject-wide):
average each student's `quiz_attempts.score` (or normalise to percentage via `score / maxScore` - see note) across all quizzes where `quiz.subjectId = X` and `quiz.subjectWeekId` points at a test week, then rank by average.
Cohort = students with at least one submitted test-week quiz attempt in the subject.
This mirrors `:628` but sources from quizzes and derives "is a test" from the week flag instead of `homework.isTest`.

Percentage vs raw-score note (matters, easy to get wrong):
if different quizzes have different `totalPoints`, averaging raw `score` is unfair (a 50-point quiz dominates a 10-point one).
Recommendation: rank the overall/subject average on `score / maxScore` (a percentage), not raw score.
Per-single-quiz rank can use raw score since everyone sat the same quiz.
Flag for the owner.

Clean removal of `is_test` without breaking the student ranking UI:

The UI touch points are `student/homework/[id]/page.tsx` (`:72`, `:135`) and `student/progress/[id]/page.tsx` (`:95`), plus admin reports (`reports-queries.ts:117`).
Sequence that never leaves the UI broken:

1. Ship quizzes + `quiz_attempts` + the two new ranking queries first, without touching `is_test`. Both systems coexist. During this window the overall-subject rank can be a UNION of the two score sources (homework `is_test` scores + test-week quiz scores) if the owner wants continuity across the migration.
2. Move the rank display: the progress page reads the new subject rank query; the homework detail page's "Test" chip + per-test rank move onto a new quiz-result page (or is dropped from homework entirely, since homework stops being an assessment).
3. Once no UI reads `homework.isTest`: remove the checkbox (`section-editor.tsx:466`), stop writing it in `createHomework` (`tutor/_actions.ts:183`, `:245`), update `reports-queries.ts:117` to read quiz attempts, then drop the column in a migration (`alter table homework drop column is_test`).
4. Decide separately whether historical `is_test` homework scores are migrated into the new ranking (see open questions) - dropping the column does not have to mean discarding the data if we backfill quiz-equivalent rows or keep the UNION permanently for pre-cutover terms.

Order matters: never drop the column while any query still references it (the four call sites above), or the student progress/homework pages 500.

## 5. Migration + RLS implications

All new tables must ship with RLS enabled and policies, following the repo convention (see `0024_resources.sql` and `docs/SECURITY.md`; RLS is defense-in-depth behind app-layer `requireRole` checks).

Existing reusable helpers (verified in `supabase/migrations/`, grep before writing):
- `public.is_admin()` - migration 0004.
- `public.is_enrolled_in(p_class uuid)` - migration 0004.
- `public.is_parent_of(p_student uuid)` - migration 0004.
- `public.teaches_subject(p_uid uuid, p_subject_id uuid)` - migration 0024.
- `public.can_see_subject(p_uid uuid, p_subject_id uuid)` - migration 0024 (student enrolled in / parent of student enrolled in a class for the subject).
- `public.handle_audit_log()` - migration 0006 (attach as an audit trigger, as `resources` does).

Proposed policy shape per table:

`quizzes`, `quiz_questions`, `quiz_options`:
- Authoring (write + read of answer keys): `is_admin()` or `teaches_subject(auth.uid(), subjectId)`.
- Student/parent read: only `isPublished` rows for subjects they can see, via `can_see_subject`. Critical: the answer-key columns (`quiz_options.isCorrect`, `quiz_questions.acceptedAnswers`) must NOT be readable by students even on published quizzes. RLS is row-level, not column-level, so this is enforced at the query/app layer (a student-facing select that omits those columns) - RLS alone cannot hide a column. Call this out prominently in the migration and the server action.

`quiz_attempts`, `quiz_responses`:
- Student: read + write ONLY their own attempts (`studentId = auth.uid()`), and only while `submittedAt is null` for writes (grading lock, analogous to `enforce_homework_assignment_grading_lock` in migration 0007).
- Tutor of the subject / admin: read all attempts for their subject's quizzes (for results/reporting), no write to a student's answers.
- Parent: read their child's attempts via `is_parent_of`.

`subject_weeks.is_test_week`:
- Additive boolean column on an existing table; inherits `subject_weeks` existing RLS (admin writes template, students read). No new policy needed, but re-confirm the existing `subject_weeks` write policy is admin-scoped.

Migration file conventions to follow (from existing migrations):
- Raw-SQL `.sql` under `supabase/migrations/`, next number is `0025_...`.
- `begin; ... commit;`, idempotent guards (`create table if not exists`, `add column if not exists`), a header comment block naming reused helpers + a reversal recipe (as `0024` does).
- Do NOT use `drizzle-kit push` / `db:generate` (per repo memory: push wipes all RLS). Hand-write the ALTER/CREATE + policies, and mirror the columns into `src/db/schema.ts` by hand.

## 6. Open questions for the owner

1. Auto vs manual test weeks: confirm Option B (explicit `is_test_week` flag, optionally seeded by an "every Nth week" helper). Or is a pure automatic cadence genuinely wanted despite the brittleness?
2. Who authors the common exam - admin/curriculum only, or any tutor of the subject? This drives the write-policy subject.
3. Ranking cohort definition: is "all students enrolled in any class of the subject" the right cohort, or is a true year-level cohort needed (which would mean promoting `subjects.yearLevel` to a structured, required concept)?
4. v1 question types: multiple-choice + short-answer only, single-select MC? Any need for multi-select or numeric-tolerance in v1?
5. Retakes: one attempt per student (v1 recommendation) or multiple attempts with best/last/average scored?
6. Overall-rank scoring basis: percentage (`score/maxScore`) vs raw average - confirm percentage.
7. Historical data: do existing `is_test` homework scores need to feed the new rankings (backfill or permanent UNION for pre-cutover terms), or can pre-quiz terms simply keep their old rank display and new terms use quizzes?
8. Short-answer grading strictness: is exact normalised-match acceptable for v1 (known false-negatives on typos/synonyms), or is manual override of an auto-grade required?
9. Availability windows / timing: do quizzes need open/close times or a per-attempt time limit in v1, or is "published = takeable until due" enough?

## 7. Rough phase breakdown

v1 (the replacement, deploy-ready):
- Schema: `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_responses` + `subject_weeks.is_test_week`, with RLS + audit trigger (migration `0025`).
- Authoring UI (admin/curriculum): create a quiz on a subject week, MC + short-answer questions, publish.
- Student taking UI: list published quizzes on the subject/week, take, auto-grade on submit, one attempt.
- Ranking: new per-quiz and subject-wide (percentage) rank queries reading `quiz_attempts`; wire progress page + a new quiz-result view.
- Decommission `is_test`: move the four call sites, remove the checkbox, drop the column (after the coexistence window in section 4).

Later (post-v1):
- Richer question types (multi-select, numeric tolerance, matching), question bank / reuse.
- Retakes and best/last scoring; per-attempt timers and availability windows.
- Tutor/admin results dashboards, per-question analytics, item difficulty.
- True year-level cohorts if subject-scope proves insufficient.
- Optional AI-assisted marking for free-text answers.
- Migrating historical `is_test` scores into the unified ranking if the owner wants one continuous history.
