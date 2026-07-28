# Quiz Maker v2 - Design Spec

Date: 2026-07-27
Status: Implementation complete. Code, migration, automated tests, production build, and RLS audit pass.
Manual browser verification remains pending because the in-app browser runtime was unavailable in this session.
Branch: `feat/quiz-maker`
Builds on: `2026-07-26-quiz-maker-design.md` and its 2026-07-27 delivery addendum.

## Context

The quiz maker ships today with two question types (multiple choice, true/false), quiz-level attachments, a status-grouped tutor list, and a two-column workspace.
Live use surfaced six concrete gaps.
This spec covers only those six refinements.
It does not change the unranked-common-weekly-quiz model, the approval lifecycle, or the student practice experience beyond what grading requires.

A separate, later spec covers the student curriculum page restyle.
That work is explicitly out of scope here.

## Goals

Make the quiz maker fill the screen at real laptop widths, support richer question structures (context sets, per-question files, reordering), keep admin instructions out of the way, and group the tutor's finished quizzes by subject.

## The six changes

### 1. Workspace fills the screen

Root cause: the workspace switches to its two-column layout only at the `xl` breakpoint (1280px viewport).
At 125% browser zoom, or on a 1280-1366px laptop, the effective CSS width falls below 1280px, so the layout collapses to a single narrow column and leaves a large empty gutter.

Fix:
- Switch the two-column workspace at `lg` (1024px) instead of `xl`.
- Let the question canvas absorb the freed width via `minmax(0,1fr)`.
- Relax the hard `max-w-[1400px]` cap on the admin and tutor detail pages so the workspace uses the available content width.
- No behaviour change below `lg`; the single-column stack is retained for tablet and mobile.

### 2. Admin instruction docked at the bottom

Today `quiz.note` renders as a full-width block above the maker on both the tutor and admin detail pages, pushing the quiz down.

Fix:
- Move the note into a collapsed strip docked at the bottom of the page, expandable on click.
- Render it only when a note exists.
- Collapsed by default so it never obstructs the quiz view.
- Applies to both the tutor page (label "Instructions from admin" / "Changes requested") and the admin page (label "Note").
- Keyboard accessible and screen-reader labelled; respects reduced motion on expand/collapse.

### 3. Context set question type

A context set is a passage or scenario block followed by its own sub-questions that reference that passage.
It is a distinct type in the "Add question" picker, alongside multiple choice and true/false.

Data model:
- Add `context` to the `quiz_question_type` enum.
- A context block is a `quiz_questions` row with `type = 'context'`, a `prompt` holding the passage text, and no options.
- Add a nullable self-reference `parent_id uuid -> quiz_questions(id) on delete cascade` to `quiz_questions`.
- A sub-question is a normal `multiple_choice` or `true_false` row whose `parent_id` points at its context block.
- Every question row, sub-question included, still carries `quiz_id`.
  All existing RLS policies key off `quiz_id`, so sub-questions are covered without new policies.
- `position` is sibling-scoped: it orders rows within the same `parent_id`, and orders top-level rows where `parent_id is null`.
- Deleting a context block cascades to its sub-questions and their options and attachments.

Grading and validation:
- Only leaf `multiple_choice` and `true_false` questions are graded.
- A context block is a container and is never graded.
- `validateQuizForSubmit` requires each context block to have a non-empty passage and at least one complete sub-question, and requires each leaf question to have a prompt, at least two options, and exactly one correct option.
- `gradeQuizAnswers` skips context containers and grades only leaf questions.

Maker UI:
- The "Add question" tools gain a third option: "Context set".
- A context block renders as a container card with a passage textarea, its own attachment control, its nested sub-question cards, and an "Add sub-question" control offering multiple choice or true/false.
- Sub-questions render inside the container, visually subordinate to the passage.

### 4. Per-question attachments

Attachments attach to a specific question or context block rather than to the quiz as a whole.

Data model:
- Add a nullable `question_id uuid -> quiz_questions(id) on delete cascade` to `quiz_attachments` (plus an index).
- Attachment RLS stays keyed on `quiz_id`, so the access model is unchanged.
- The existing `quiz_id` column stays not-null; `question_id` distinguishes a question-scoped attachment from a legacy quiz-level one.

Behaviour:
- The upload control moves into each question card and each context block.
- The separate sidebar "Attachments" panel is removed.
- Existing quiz-level attachments (null `question_id`) still render read-only, but the UI creates no new quiz-level attachments.
- The per-quiz six-file cap and the three-file batch cap are retained and counted across all attachments in the quiz.
- The context block's own attachment is the intended way to attach a reading passage as a PDF or image.

### 5. Reorder questions

Questions can be reordered, both at the top level and within a context set.

- Drag-and-drop is the primary interaction, with up/down arrow buttons as the accessible and keyboard fallback on every card.
- A single server action `reorderQuestions({ quizId, parentId, orderedIds })` is the source of truth for both interactions.
  It rewrites `position` for exactly one sibling group (a given `parent_id`, or the top-level group), after re-checking ownership and editable status.
- Reordering is available only while the quiz is editable, matching the existing edit gates.

### 6. Tutor list grouped by subject within Done

`/tutor/quizzes` keeps its current top-level grouping: To do, Submitted, Done.
The Done section splits into per-subject sub-tables so a tutor's finished quizzes are organised by subject.
To do and Submitted keep their existing flat lists.

## Server actions summary

- `addQuestion` accepts `type: 'context'` and an optional `parentId` for sub-questions.
- `reorderQuestions({ quizId, parentId, orderedIds })` is added.
- `uploadQuizAttachments` accepts an optional `questionId`.
- `deleteQuizAttachment` is unchanged.
- `validateQuizForSubmit` and `gradeQuizAnswers` handle context containers as described above.
- Every mutation keeps its existing role and editable-status gate; app-layer checks remain the primary control and RLS remains defence-in-depth.

## Permissions and RLS

No new policies are required.
- `quiz_questions` policies already key off `quiz_id`, which every sub-question carries, so nested rows inherit the same access.
- `quiz_attachments` policies already key off `quiz_id`; the new `question_id` column does not widen access.
- Students still never receive `quiz_options.is_correct` before submitting; the enrolment-checked server query that strips the answer key is unchanged.

## Migration

`0027_quiz_context_attachments.sql`, a raw-SQL ALTER migration applied via `scripts/apply-sql.mjs` (never `db:push`, which wipes RLS).
It is additive and destroys no data:
- `alter type quiz_question_type add value 'context'`.
- `alter table quiz_questions add column parent_id ...` plus an index on `parent_id`.
- `alter table quiz_attachments add column question_id ...` plus an index on `question_id`.

Reversible by dropping the two columns and their indexes; the enum value cannot be dropped, which is acceptable and harmless.

Postgres caveat: a newly added enum value cannot be used in the same transaction that adds it (Postgres 12+).
This migration only alters schema and never inserts a row using `'context'`, so wrapping it in the repo's usual `begin`/`commit` is safe.
The `add value` is idempotent-guarded with `if not exists`.

## Verification

- Migration applies cleanly and `db:check-rls` passes.
- Typecheck and the existing test suite pass; `quiz-validation` tests extend to cover context grading and validation.
- Admin-direct: build a quiz mixing a standalone multiple-choice question, a true/false question, and a context set with two sub-questions and a passage image; reorder both a top-level question and a sub-question; approve.
- Per-question attachment: upload a file to a specific question and to a context block; confirm it is scoped to that question and removable.
- Tutor list: an approved quiz appears under its subject sub-table inside Done; To do and Submitted remain flat.
- Layout: at 125% zoom and at a 1280px viewport the workspace uses two columns and fills the width.
- Admin note: the instruction strip is collapsed at the bottom by default and does not push the quiz down.
- Negative: a context block with no sub-questions, or a sub-question missing a correct option, blocks submission with a clear message.

## Rollout

Migration 0027 authored here; the owner applies it via apply-sql, not db:push.
No data backfill.
Update `docs/checklist.md` and `docs/security-checklist.md` in the same change as the code.
