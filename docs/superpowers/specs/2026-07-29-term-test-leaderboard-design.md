# Term Test + Leaderboard - Design Spec

Date: 2026-07-29
Status: Approved (owner approved the design direction; proceeding to plan + build)
Target branch: `feat/term-test` (off main)
Scope: end-of-term term test as a new, scored quiz kind, with a per-subject-per-term leaderboard visible to students and parents.

## Context

Quizzes today are week-bound and practice-only.
`quizzes.subject_week_id` is `NOT NULL` and `UNIQUE`, so there is exactly one quiz per subject week.
Grading runs client-side in the practice flow and nothing is persisted, so there is no quiz score history and no quiz leaderboard anywhere in the product.
The only existing leaderboard is the separate `math-game` feature (`math_game_scores` + `getLeaderboard`), which is the ranking and display pattern this feature reuses.

`classes` has no `term_id`; classes are recurring (`is_recurring`, `weekday`, `start_time`), and a student's link to a subject is a continuous `enrollments` row (`enrolled_at`, `withdrawn_at`), not a per-term record.
Term scoping of curriculum content comes from `subject_weeks.term_id`.
`terms` has `start_date` and `end_date` (both `date`).

The owner wants an end-of-term term test that is the first scored, persisted, term-wide quiz, with a leaderboard, while weekly quizzes stay exactly as they are.

## Goals

Add a `term_test` quiz kind that is authored through the existing quiz maker but scoped to a whole term instead of a single week, taken once per student and auto-graded on the server, with results embargoed until a release date and then shown as score, rank, and corrections, ranked on a per-subject-per-term leaderboard that students and their parents can view.

## Non-goals

- No change to weekly quizzes: they remain practice-only, unscored, unboarded, and their code path is untouched.
- No new question types: the term test uses the multiple-choice, true-false, and context sub-question types the quiz maker already supports.
- No manual-grading queue and no written-answer questions.
- No half-term major exam handling (that exam happens outside the portal and has no leaderboard).
- No year-level board segmentation: the cohort is per subject per term (see the interpretation note below).

## Owner decisions (locked)

1. Only the term test is scored and has a leaderboard; weekly quizzes stay practice-only and untouched.
2. One attempt per student, auto-graded on the server.
3. Results are embargoed until a release date, then auto-released; students who did not take it by the deadline are scored zero for that test but can still review the questions and correct answers.
4. The leaderboard is per subject per term; students who are in that subject that term appear on it, and both students and the parents of a child in that subject that term can view it.
5. Corrections show the correct answers with no explanation text.

## Interpretation note (carried, owner approved)

"Everyone in that subject/year" is read as all students enrolled in that subject for that term, forming a single cohort per subject per term.
There is no year-level split (for example Year 7 Math and Year 9 Math would share one board).
If year-level segmentation is wanted later, it is an added filter on the cohort query and the board scope, not a structural change.

## Architecture

### Data model: extend `quizzes`, do not fork it

A term test is a quiz that is scored, term-wide instead of week-wide, and taken once.
Everything else is identical to a weekly quiz: questions, options, context sub-questions, attachments, the tutor-request then admin-approve workflow, and the quiz-maker UI.
Reusing the `quizzes` table means term tests inherit all of that.

The rejected alternative is a parallel `term_tests` + `term_test_questions` + `term_test_options` set.
It is rejected because it duplicates the entire quiz maker, the question types, and the approval workflow for no benefit.
A `kind` discriminator column is the standard way to model a variant that shares nearly all of its structure.

Changes to `quizzes`:

- New enum `quiz_kind` with values `weekly` and `term_test`.
- Add `kind quiz_kind NOT NULL DEFAULT 'weekly'`.
- Make `subject_week_id` nullable. Weekly rows keep it set; term-test rows leave it null.
- Add `term_id uuid REFERENCES terms(id)`. Term-test rows set it; weekly rows leave it null.
- Add `results_release_at timestamptz`. Term-test rows set it (default the term's end date, admin-editable); weekly rows leave it null.
- Keep the existing unique-per-week index. Postgres treats null `subject_week_id` values as distinct, so weekly uniqueness is preserved and term-test rows with null weeks do not collide.
- Add a partial unique index on `(subject_id, term_id) WHERE kind = 'term_test'`, so there is at most one term test per subject per term.
- Add a check constraint enforcing the two shapes:
  weekly rows have `subject_week_id` not null and `term_id` null and `results_release_at` null;
  term-test rows have `subject_week_id` null and `term_id` not null and `results_release_at` not null.

### New tables

`term_test_attempts`:

- `id uuid primary key`
- `quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE`
- `student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `score integer NOT NULL` (number of gradable questions answered correctly)
- `total integer NOT NULL` (number of gradable questions on the test at submit time)
- `submitted_at timestamptz NOT NULL DEFAULT now()`
- Unique `(quiz_id, student_id)` to enforce one attempt.
- Index `(quiz_id, score DESC)` for the leaderboard.

`term_test_answers`:

- `id uuid primary key`
- `attempt_id uuid NOT NULL REFERENCES term_test_attempts(id) ON DELETE CASCADE`
- `question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE`
- `selected_option_id uuid REFERENCES quiz_options(id) ON DELETE CASCADE` (nullable: a question the student left unanswered)
- Unique `(attempt_id, question_id)`.

This stores exactly what the corrections view needs (the student's chosen option per question) without duplicating the questions.

### The cohort (who is on the board, who gets a zero)

The cohort for a term test is the set of students who were active students of that subject at the deadline.
It is computed, not stored, as students with an enrollment in a class of the test's `subject_id` where the enrollment is not withdrawn before the deadline:
`enrolled_at <= results_release_at AND (withdrawn_at IS NULL OR withdrawn_at > results_release_at)`.
The term supplies the content label, the default deadline, and the date window; because classes are recurring rather than term-scoped, the cohort is defined by active enrollment rather than by a class-to-term link that does not exist.

No-show zeros are not written as rows.
After release, the leaderboard query starts from the cohort and left-joins `term_test_attempts`; a cohort student with no attempt renders as score zero and ranks last.
This is self-correcting: if a student is later withdrawn or the cohort changes, the board reflects it without stale fabricated rows.

### Lifecycle and states

Authoring reuses the existing tutor-request then admin-build-and-approve flow and the quiz-maker component verbatim.
The only new authoring input is choosing a term (instead of a week) and an optional release date that defaults to the term's end date.
Term tests appear in the same admin and tutor quiz lists, under a "Term tests" grouping.

A student's view of a term test moves through these states, derived from `status`, `results_release_at`, `now`, and whether the student has an attempt:

- Not open: the term test is not yet `approved`. The card shows it is coming, no take action.
- Open to take: `approved` and `now < results_release_at` and the student has no attempt. The student can take it once.
- Submitted, pending: the student has an attempt and `now < results_release_at`. The card shows "submitted, results pending" and nothing else, honoring the embargo.
- Released: `now >= results_release_at`. Results are visible to the whole cohort, including no-shows. Submissions are closed. The student sees score, rank, corrections, and the board.

### Server-side grading (security-critical)

Practice quizzes grade client-side, which is acceptable because they are an ungraded self-check and `is_correct` reaching the browser does no harm.
A term test feeds a leaderboard, so grading must be server-side and `is_correct` must never reach the client before submit.

- The take-test query returns questions and options with `is_correct` stripped out.
- The student submits their selected option per question.
- The server loads the answer key, computes the score, and persists the attempt and the per-question answers in one transaction.
- Grading counts one point per gradable leaf question (multiple-choice and true-false, plus the leaf sub-questions inside a context set); the context container question itself is not scored, matching how the existing practice grader excludes `type = 'context'`.
  An unanswered or wrong selection scores zero for that question.
  `total` is the number of gradable leaf questions on the test.

This adds one row to the security checklist: term-test take payloads must exclude `is_correct`, and grading is server-only.

### RLS

The two new tables get RLS enabled with policies consistent with the existing quiz tables, as defense in depth (app-layer role guards remain the primary control because Drizzle bypasses RLS).
Students may read and insert only their own attempts and answers; reads of others' attempts happen only through the leaderboard query after release and are mediated by server code, so the row-level policy stays student-owns-their-rows.
Policies are added in the same raw-SQL migration and verified with `db:check-rls`.

## Files

Backend:

- `supabase/migrations/0028_term_test.sql` (new): the enum, the `quizzes` alterations, the two new tables, indexes, the check constraint, and RLS policies. Applied with `node scripts/apply-sql.mjs`, never `db:push`.
- `src/db/schema.ts` (modify): add `quizKindEnum`, the new `quizzes` columns, the `termTestAttempts` and `termTestAnswers` tables, and their inferred types.
- `src/lib/term-test-grading.ts` (new): a pure grading function (answers + answer key to score/total) and a pure results-derivation function (cohort rows + attempts to ranked board with no-show zeros), unit-tested.
- `src/lib/term-test-state.ts` (new, or folded into grading lib): pure derivation of the student-facing state from `status`, `results_release_at`, `now`, and attempt presence.
- Server queries and actions for: creating a term test, listing them for admin/tutor, fetching a term test for a student to take (no `is_correct`), submitting and grading, fetching a student's results and the board after release, and fetching a child's results and the board for a parent.

Frontend:

- Admin/tutor: a create-term-test entry that reuses the quiz-maker component, adding term and release-date inputs, and a "Term tests" grouping in the quiz lists.
- Student subject page: a term-test card reflecting the four states, the take page, and the results page (score, rank, corrections, board).
- Parent: a read-only view of the child's term-test result and the board within the child's subject area.
- A leaderboard component reusing the `math-game` ranking and display shape (best or only score, ranked, first name plus last initial, a "you" row when outside the top).

Records:

- `docs/checklist.md` and `docs/security-checklist.md` updated in the same commits as the code.
- `docs/changes/2026-07-29-term-test-leaderboard.md` written.

## Testing

Following the project convention of pure-logic unit tests only (no DB or render harness):

- Grading: score and total computation, context container excluded, unanswered counts as wrong, all-correct and all-wrong boundaries.
- Results derivation: cohort left-joined with attempts produces correct ranks, no-show students appear at zero and rank last, ties broken consistently, the "you" row surfaces when outside the top.
- State derivation: the four student-facing states are produced correctly across `status`, `results_release_at` before and after `now`, and attempt presence, including the embargo (submitted but not released shows pending only).
- Validation: a term test cannot be created without a term; the release date is required and defaults to term end.

Machine verification for a task to be considered backend-complete: typecheck, the vitest suite, `db:check-rls` green after the migration.
Browser verification remains the owner gate before any front-end row is marked done.

## Verification (owner browser gate)

- Admin or tutor can author a term test for a subject and term, set or accept the default release date, and approve it, reusing the quiz maker.
- A student sees the term test on the subject page, takes it once, and cannot take it again.
- After submitting and before the release date, the student sees only a "results pending" state, with no score, rank, or answers leaked.
- At the release date, results become visible: the student sees their score, their rank, and the correct answers; a student who never took it appears at zero and can review the questions and answers.
- The leaderboard shows the subject-and-term cohort, ranked, with the viewer highlighted, using masked display names.
- A parent can view their child's result and the board, read-only.
- Weekly quizzes are unchanged in behavior and appearance.
- `is_correct` is never present in any take-test network payload.

## Rollout

Single feature branch off main, built with subagent-driven development, merged after the owner browser-approves.
No dependency on the parked `feat/curriculum-restyle` branch or the unmerged `feat/operational-reports` branch.
