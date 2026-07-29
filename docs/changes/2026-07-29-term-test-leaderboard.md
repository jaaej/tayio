# Term Test + Leaderboard

Date: 2026-07-29
Branch: `feat/term-test`
Status: Code, migrations, automated tests, and production build complete.
Owner browser verification remains pending.

## Requested outcome

Add an end-of-term term test as the first scored, persisted, term-wide quiz kind.
It is authored through the existing quiz maker but scoped to a whole term instead of a single week.
A student takes it once, it is auto-graded on the server, and results are embargoed until a release date.
Once released, the student sees their score, rank, and corrections on a per-subject-per-term leaderboard that both students and the parents of a child in that subject can view.
Weekly quizzes stay exactly as they are: practice-only, unscored, unboarded, client-graded.

## The `kind` discriminator model

A term test is a `quizzes` row, not a new parallel table set.
The rejected alternative was a parallel `term_tests` + `term_test_questions` + `term_test_options` schema; it was rejected because it would duplicate the entire quiz maker, question types, and tutor-request/admin-approve workflow for no benefit.

Migration `0028_term_test.sql` (applied, `db:check-rls` green):

- New enum `quiz_kind` with values `weekly` and `term_test`; `quizzes.kind` defaults to `weekly`.
- `quizzes.subject_week_id` is now nullable.
Weekly rows keep it set; term-test rows leave it null.
- `quizzes.term_id uuid references terms(id)` and `quizzes.results_release_at timestamptz`, both null for weekly rows and both required for term-test rows.
- The existing unique-per-week index is unchanged; Postgres treats null `subject_week_id` values as distinct, so term-test rows do not collide with it.
- A new partial unique index on `(subject_id, term_id) where kind = 'term_test'` enforces at most one term test per subject per term.
- A check constraint enforces the two shapes: weekly rows have `subject_week_id` set and `term_id`/`results_release_at` null; term-test rows have `subject_week_id` null and `term_id`/`results_release_at` set.
- Two new tables: `term_test_attempts` (`quiz_id`, `student_id`, `score`, `total`, `submitted_at`, unique on `(quiz_id, student_id)` to enforce one attempt, indexed on `(quiz_id, score desc)` for the leaderboard) and `term_test_answers` (`attempt_id`, `question_id`, `selected_option_id`, unique on `(attempt_id, question_id)`), both with RLS enabled.

Migration `0028` also made the shared quiz queries in `src/lib/quiz-queries.ts` kind-aware: the week join changed from an inner join to a left join, plus a left join to `terms` via `quizzes.term_id`, with the term derived by `coalesce(week_term, direct_term)`.
Weekly output is unchanged; a term test now carries `kind`, a null `weekNumber`, and its term from `quizzes.term_id` instead of from a week.

## Server-side grading (the security-relevant difference from practice quizzes)

Practice (weekly) quizzes grade client-side.
That is acceptable for them because they are an ungraded self-check and `quiz_options.is_correct` reaching the browser does no harm.

A term test feeds a leaderboard, so the same is not acceptable: `is_correct` must never reach the client before submit, and the grade must not be trusted from the client.

- `getStudentTermTest` (`src/lib/quiz-queries.ts`) returns the term test's questions and options with `is_correct` stripped out, mirroring the existing `getStudentQuiz` option projection.
Verified by reading the function body: its option select projects only `id, questionId, text, position`, never `isCorrect`.
- The student submits selected option IDs only.
`submitTermTest` (`src/app/_actions/term-tests.ts`) loads the answer key server-side, calls the pure `gradeTermTest` (`src/lib/term-test.ts`), and persists the attempt plus per-question answers in one transaction.
- One attempt is enforced twice: the `(quiz_id, student_id)` unique constraint in the database, and a `catch` on the resulting `23505` via `isUniqueViolation` (relocated to `src/lib/db-errors.ts` so both `quizzes.ts` and `term-tests.ts` share it) that turns a race into "You have already taken this term test." instead of a 500.
- Grading counts one point per gradable leaf question (multiple-choice and true-false, including leaf sub-questions inside a context set); the context container itself is never scored, matching the existing practice grader's exclusion of `type = 'context'`.
An unanswered question scores zero; `gradeTermTest` never treats "unanswered" as an error, only a genuinely malformed submission (a duplicate answer for one question, or an option ID that does not belong to its question) is rejected.

Migration `0029_term_test_rls_tighten.sql` (applied, `db:check-rls` green) tightens the two new tables' student RLS policies from `for all` (as first written in 0028) to `for select` only.
The reasoning: every write to these tables goes through `submitTermTest` via Drizzle, which bypasses RLS entirely, so a student never legitimately needs INSERT/UPDATE/DELETE through PostgREST.
Left at `for all`, a student could self-insert a fake perfect-score attempt directly with their own JWT, bypassing server-side grading altogether.
Admin keeps full access on both tables under both migrations.

The weekly path is also guarded against accidentally serving a term test: `getStudentQuiz` now filters `eq(quizzes.kind, "weekly")`, and `gradePracticeQuiz` (`src/app/_actions/quizzes.ts`) rejects with the same "Quiz not found" error when `kind !== "weekly"`.
Without these, an approved term test could be opened at `/student/quizzes/[id]` and graded by the untouched client-side practice path, which would leak the answer key and bypass the one-attempt/embargo rules.

## Embargo, date-driven release, and no-show zeros

A term test moves through four states, derived purely by `deriveTermTestState` (`src/lib/term-test.ts`) from `status`, `results_release_at`, `now`, and attempt presence:

- Not open: not yet `approved`.
- Open to take: `approved`, before `results_release_at`, no attempt yet.
- Submitted, pending: has an attempt, before `results_release_at`.
The student sees only "submitted, results pending" - no score, rank, or answer reaches the page or the network payload before release, because `getStudentTermTestResults`/`getParentTermTestResults` (`src/lib/term-test-results.ts`) check the release gate before touching the board, scores, or the answer key at all.
- Released: `now >= results_release_at`.
Submissions close; the whole cohort, including no-shows, sees results.

No-show zeros are never written as rows.
After release, `getTermTestCohort` computes the cohort and `rankTermTestBoard` (`src/lib/term-test.ts`) left-joins it with `term_test_attempts`; a cohort member with no attempt renders at score zero and ranks last (ties among no-shows and equal scores are broken by earliest submission, with no-shows sorting after everyone who submitted).
This is self-correcting: if the cohort changes later (a student withdraws, for example), the board reflects it without a stale fabricated row.
`buildCorrectionsAndScore` (`src/lib/term-test-results.ts`) gives a no-show student the full corrections view (every question, no selection, the correct answer, score 0) so they can still review the test.

## The cohort definition

`classes` has no `term_id` - classes are recurring, and the only per-term signal in the schema is `subject_weeks.term_id` and `terms.start_date/end_date`.
A student's link to a subject is a continuous `enrollments` row (`enrolled_at`, `withdrawn_at`), not a per-term record.

The cohort for a term test is therefore computed, not stored: students with an `enrollments` row in a class of the test's `subject_id`, active at the deadline - `enrolled_at <= results_release_at AND (withdrawn_at IS NULL OR withdrawn_at > results_release_at)` - distinct by student.
`getTermTestCohort` (`src/lib/term-test-results.ts`) is this query.
It is the single membership test used for both the leaderboard and for gating who may view results at all: `getStudentTermTestResults` and `getParentTermTestResults` both return `null` for a student/child outside the cohort, before checking the release gate, so a student not in that subject that term learns nothing about whether the test exists or has released.

## Routes and files added

Backend:

- `supabase/migrations/0028_term_test.sql`, `supabase/migrations/0029_term_test_rls_tighten.sql`.
- `src/db/schema.ts`: `quizKindEnum`, `quizzes.kind/termId/resultsReleaseAt`, `termTestAttempts`, `termTestAnswers`.
- `src/lib/term-test.ts` (+ `term-test.test.ts`, 17 tests): pure `gradeTermTest`, `deriveTermTestState`, `rankTermTestBoard`.
- `src/lib/term-test-results.ts`: `getTermTestCohort`, `getStudentTermTestResults`, `getParentTermTestResults`.
- `src/lib/quiz-queries.ts`: kind-aware `getQuizWithContent`/list select, `getStudentTermTest`, weekly-only guard on `getStudentQuiz`, `listTermTestTargets`, `getStudentTermTestForSubjectTerm`, `getTermTestSubjectAndTerm`.
- `src/app/_actions/term-tests.ts`: `createTermTest`, `setTermTestReleaseDate`, `submitTermTest`.
- `src/lib/db-errors.ts`: `isUniqueViolation`, relocated out of `quizzes.ts` so both action files share it.
- `src/app/_actions/quizzes.ts`: weekly-only guard added to `gradePracticeQuiz`.

Frontend:

- Admin/tutor: a "Create term test" entry and a "Term tests" grouping reusing the existing quiz maker, plus a release-date editor in the maker header when `kind === "term_test"`.
- Student: `/student/term-tests/[id]` (`page.tsx` + `_components/take-form.tsx`, `status-card.tsx`, `results-view.tsx`), and a `TermTestCard` on `/student/subjects/[id]`.
- `src/components/term-test/leaderboard.tsx`: adapted from the math-game leaderboard's row markup, medals, and "you" styling into a single subject+term board.
- Parent: `/parent/term-tests/[id]/[childId]` (read-only, reuses the student's status card, results view, and leaderboard with a `childName`/`meLabel` prop each), and a `ParentTermTestCard` on `/parent/subjects/[id]` gated on release.

## Machine verification

- Migrations 0028 and 0029 applied to the connected Supabase database via `scripts/apply-sql.mjs` (never `db:push`, which wipes RLS).
- `npm run db:check-rls` passes for all public tables, including the two new ones, after both migrations.
- `npm run typecheck` passes.
- `npm test` passes: 62/62 across 9 files, including 17 term-test unit tests (grading boundary cases, all four state transitions including the embargo, no-show tie-breaking, the "me outside top N" board case, and rejection of malformed submissions).
- `npm run build` passes (exit 0).
- Reading `getStudentTermTest`'s option projection confirms `isCorrect` is never selected on the student take path (the only other `isCorrect` selects in `quiz-queries.ts` are in the admin/tutor `getQuizWithContent` and the list-row types, which are answer-key views, not student-facing).

## Still owner-gated: browser QA

Nothing below has been clicked through in a browser with real data.
Per the project's success-claim rule, both the checklist and this doc keep FE at partial until these are done:

- Admin or tutor authors a term test for a subject and term, accepts or edits the default release date, and approves it, reusing the quiz maker.
- A student sees the term test on the subject page, takes it once, and cannot take it again.
- After submitting and before release, the student sees only "results pending" - no score, rank, or answers leaked.
- At release, the student sees score, rank, and corrections; a student who never took it appears at zero and can still review the questions and answers.
- The leaderboard shows the subject-and-term cohort, ranked, with the viewer highlighted.
- A parent views their child's result and the board, read-only, and sees the same embargo before release.
- Weekly quizzes are unchanged in behavior and appearance (this is the regression risk from making the shared queries kind-aware).
- `is_correct` is never present in any take-test network payload (confirmed by code review above; not yet confirmed by inspecting real network traffic in a browser).

## Deferred minors (non-blocking, noted for future triage)

- The tutor "Term tests" card in the quiz list is not status-triaged the way weekly quizzes are (UX asymmetry, cosmetic).
- `getStudentTermTest`'s `not_open` branch is dead code in practice because the caller already filters to approved quizzes; kept defensively in case that filter changes.
- `buildCorrectionsAndScore`'s `correctOptionText` falls back to `""` if a question somehow has no correct option; this is prevented at authoring time by the same validation weekly quizzes use.

## Files changed

### Data and migrations

- `supabase/migrations/0028_term_test.sql`
- `supabase/migrations/0029_term_test_rls_tighten.sql`
- `src/db/schema.ts`

### Pure logic and server queries/actions

- `src/lib/term-test.ts`, `src/lib/term-test.test.ts`
- `src/lib/term-test-results.ts`
- `src/lib/quiz-queries.ts`
- `src/lib/db-errors.ts`
- `src/app/_actions/term-tests.ts`
- `src/app/_actions/quizzes.ts`

### Admin/tutor UI

- `src/app/admin/quizzes/**`
- `src/app/tutor/quizzes/**`
- `src/components/quiz/quiz-maker.tsx`

### Student UI

- `src/app/student/term-tests/[id]/page.tsx` and `_components/`
- `src/components/term-test/leaderboard.tsx`
- `src/app/student/subjects/[id]/**`

### Parent UI

- `src/app/parent/term-tests/[id]/[childId]/page.tsx`
- `src/app/parent/subjects/[id]/**`

### Project records

- `docs/checklist.md`
- `docs/security-checklist.md`
- `docs/superpowers/specs/2026-07-29-term-test-leaderboard-design.md`
- `docs/superpowers/plans/2026-07-29-term-test-leaderboard.md`
- `docs/changes/2026-07-29-term-test-leaderboard.md`
