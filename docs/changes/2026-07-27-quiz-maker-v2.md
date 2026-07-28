# Quiz Maker v2

Date: 2026-07-27
Branch: `feat/quiz-maker`
Status: Code, migration, automated tests, and production build complete.
Manual browser verification remains pending because the in-app browser runtime was unavailable in this session.

## Requested outcomes

Live use of the quiz maker built in `docs/changes/2026-07-27-quiz-delivery-notifications.md` surfaced six concrete gaps.
This change addresses only those six gaps.
It does not change the unranked-common-weekly-quiz model, the approval lifecycle, or the student practice experience beyond what grading a new question type requires.

- Make the maker fill the screen at real laptop widths and at 125% browser zoom.
- Keep the admin instruction note out of the way instead of pushing the quiz down the page.
- Add a context-set question type: a passage with its own nested sub-questions.
- Scope attachments to a specific question or context block instead of only to the whole quiz.
- Let a tutor or admin reorder questions, both at the top level and within a context set.
- Group a tutor's finished quizzes by subject inside the Done section.

## The six changes

### 1. Workspace fills the screen

The two-column workspace previously switched on only at the `xl` breakpoint (1280px viewport).
At 125% browser zoom, or on a 1280-1366px laptop, the effective CSS width falls below 1280px, so the layout collapsed to a single narrow column with a large empty gutter.
`src/components/quiz/quiz-maker.tsx` now switches to two columns at `lg` (1024px) instead of `xl`, and the question canvas absorbs the freed width via `minmax(0,1fr)`.
The admin and tutor quiz detail pages also drop their hard `max-w-[1400px]` cap so the workspace can use the available content width.
Behaviour below `lg` is unchanged; the single-column stack still serves tablet and mobile.

### 2. Admin instruction docked at the bottom

`quiz.note` previously rendered as a full-width block above the maker on both the tutor and admin detail pages.
A new `src/components/quiz/quiz-instruction-strip.tsx` renders it instead as a strip docked at the bottom of the page, collapsed by default and expandable on click.
It renders only when a note exists, so a quiz with no note shows nothing extra.
The tutor page labels it "Instructions from admin" or "Changes requested" depending on lifecycle state; the admin page labels it "Note".
The strip is keyboard accessible, screen-reader labelled, and respects reduced motion on expand/collapse.

### 3. Context set question type

A context set is a passage or scenario block followed by its own sub-questions that reference that passage.
It is a distinct type in the "Add question" picker alongside multiple choice and true/false.
Migration `0027_quiz_context_attachments.sql` adds `context` to the `quiz_question_type` enum and a nullable self-reference `parent_id uuid` on `quiz_questions`, cascading on delete.
A context block is a `quiz_questions` row with `type = 'context'` whose `prompt` holds the passage text and which has no options.
A sub-question is a normal `multiple_choice` or `true_false` row whose `parent_id` points at its context block.
`position` is sibling-scoped: it orders rows within the same `parent_id`, or orders top-level rows where `parent_id is null`.
Deleting a context block cascades to its sub-questions and their options and attachments.
Only leaf `multiple_choice` and `true_false` questions are graded; a context block is a container and is never graded.
`validateQuizForSubmit` requires each context block to have a non-empty passage and at least one complete sub-question, and requires each leaf question to have a prompt, at least two options, and exactly one correct option.
`gradeQuizAnswers` skips context containers and grades only leaf questions.
In the maker, a context block renders as a container card with a passage textarea, its own attachment control, its nested sub-question cards, and an "Add sub-question" control offering multiple choice or true/false.
`src/components/quiz/student-practice-quiz.tsx` renders a context block's passage and its own attachment above its nested sub-questions during student practice.

### 4. Per-question attachments

Attachments now attach to a specific question or context block rather than only to the quiz as a whole.
Migration 0027 adds a nullable `question_id uuid` on `quiz_attachments`, referencing `quiz_questions(id) on delete cascade`, plus an index.
The existing `quiz_id` column stays not-null; `question_id` only distinguishes a question-scoped attachment from a legacy quiz-level one.
`uploadQuizAttachments` accepts an optional `questionId`, and the upload control now lives inside each question card and each context block instead of a separate sidebar "Attachments" panel.
Existing quiz-level attachments (null `question_id`) still render read-only; the UI creates no new quiz-level attachments.
The existing per-quiz six-file cap and three-file batch cap are retained and still counted across all attachments in the quiz.

### 5. Reorder questions

Questions can be reordered, both at the top level and within a context set.
Drag-and-drop is the primary interaction; up/down arrow buttons are the accessible and keyboard fallback on every card.
A single server action, `reorderQuestions({ quizId, parentId, orderedIds })` in `src/app/_actions/quizzes.ts`, is the source of truth for both interactions.
It rewrites `position` for exactly one sibling group (a given `parent_id`, or the top-level group) after re-checking ownership and editable status.
Reordering is available only while the quiz is editable, matching the existing edit gates.

### 6. Tutor list grouped by subject within Done

`/tutor/quizzes` keeps its existing top-level grouping of To do, Submitted, and Done.
The Done section now splits into per-subject sub-tables so a tutor's finished quizzes are organised by subject.
To do and Submitted keep their existing flat lists.

## Permissions and RLS

No new policies were required.
`quiz_questions` policies already key off `quiz_id`, which every sub-question carries, so nested rows inherit the same access as their parent quiz.
`quiz_attachments` policies already key off `quiz_id`; the new `question_id` column narrows which question an attachment belongs to but does not widen who can read or write it.
Students still never receive `quiz_options.is_correct` before submitting; the enrolment-checked server query that strips the answer key is unchanged.
Every mutation keeps its existing role and editable-status gate; app-layer checks remain the primary control and RLS remains defence-in-depth.

## Migration

`0027_quiz_context_attachments.sql` is a raw-SQL ALTER migration, applied via `scripts/apply-sql.mjs` and never `db:push`, which wipes RLS.
It is additive and destroys no data:
- `alter type quiz_question_type add value if not exists 'context'`.
- `alter table quiz_questions add column parent_id uuid references quiz_questions(id) on delete cascade`, plus an index on `parent_id`.
- `alter table quiz_attachments add column question_id uuid references quiz_questions(id) on delete cascade`, plus an index on `question_id`.
It is reversible by dropping the two columns and their indexes; the enum value cannot be dropped, which is acceptable and harmless.
A newly added enum value cannot be used in the same transaction that adds it on Postgres 12+, but this migration only alters schema and never inserts a row using `'context'`, so wrapping it in the repo's usual begin/commit is safe.
The migration has been applied to the connected Supabase database and verified.

## Verification evidence

- Typecheck passes (`npm run typecheck`).
- The full automated test suite passes: 45 tests across 8 files (`npm test`), including `quiz-validation` coverage extended for context grading and validation.
- The production build passes (`npm run build`).
- `npm run db:check-rls` passes for all 37 public tables against the connected database, confirming no widened access from the new columns.

## Still pending: manual browser verification

Nothing below has been clicked through in a browser with real data yet.
The checklist entries stay at partial (built, pending browser verify) until an owner completes these:
- Build a quiz mixing a standalone multiple-choice question, a true/false question, and a context set with two sub-questions and a passage image; reorder both a top-level question and a sub-question; approve it.
- Upload a file to a specific question and to a context block; confirm it is scoped to that question and removable.
- Confirm an approved quiz appears under its subject sub-table inside the tutor's Done list, and that To do and Submitted remain flat.
- Confirm the workspace uses two columns and fills the width at 125% zoom and at a 1280px viewport.
- Confirm the admin instruction strip stays collapsed at the bottom by default and does not push the quiz down.
- Confirm a context block with no sub-questions, or a sub-question missing a correct option, blocks submission with a clear message.
- Take a quiz containing a context set as a student and confirm the passage and its nested sub-questions render and grade correctly.

## Files changed

### Data and migration

- `supabase/migrations/0027_quiz_context_attachments.sql`
- `src/db/schema.ts`

### Server actions, queries, and validation

- `src/app/_actions/quizzes.ts`
- `src/lib/quiz-queries.ts`
- `src/lib/quiz-validation.ts`
- `src/lib/quiz-validation.test.ts`

### Maker and shared quiz UI

- `src/components/quiz/quiz-maker.tsx`
- `src/components/quiz/quiz-instruction-strip.tsx`
- `src/components/quiz/student-practice-quiz.tsx`

### Admin and tutor quiz pages

- `src/app/admin/quizzes/[id]/page.tsx`
- `src/app/tutor/quizzes/[id]/page.tsx`
- `src/app/tutor/quizzes/page.tsx`

### Student quiz pages

- `src/app/student/quizzes/[id]/page.tsx`

### Project records

- `docs/checklist.md`
- `docs/superpowers/specs/2026-07-27-quiz-maker-v2-design.md`
- `docs/changes/2026-07-27-quiz-maker-v2.md`
