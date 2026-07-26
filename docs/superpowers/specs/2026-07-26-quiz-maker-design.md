# Quiz Maker v1 (creation side) - Design Spec

Date: 2026-07-26
Status: Approved (owner approved the design; proceeding to plan + build)
Supersedes: the ranked-exam direction in `2026-07-26-interactive-quizzes-draft.md`. That draft explored a ranked, student-taking exam model; the owner narrowed scope to unranked common weekly quizzes, creation side first.

## Context

The portal has no quiz feature.
The owner wants common weekly quizzes: one quiz per subject per curriculum week, shared across every class section teaching that subject.
This spec covers only the creation side: the quiz maker plus the admin-requests-a-tutor workflow.
Students taking quizzes, auto-grading, scores, and any ranking are explicitly later builds.

## Goals

Let an admin create a quiz directly, or request a specific tutor to build one, and approve the result, so a bank of common weekly quizzes can be built through the portal.

## Non-goals (out of scope for v1)

- Students taking quizzes, auto-grading, scores.
- Any ranking (these quizzes are NOT ranked).
- Short-answer and multiple-correct question types.
- Editing the existing homework `is_test` ranking (untouched by this feature).

## Data model - 3 new tables + 2 enums

Migration `0025_quizzes.sql` (raw-SQL ALTER migration per repo convention; never db:push - it wipes RLS). New tables get RLS enabled + policies following the `0024_resources.sql` pattern.

### Enums

- `quiz_status`: `draft`, `requested`, `pending_review`, `changes_requested`, `approved`.
- `quiz_question_type`: `multiple_choice`, `true_false`.

### `quizzes`

- `id` uuid pk.
- `subject_id` uuid not null -> `subjects.id` (cascade). Stored directly for scoping/RLS even though it is derivable from the week.
- `subject_week_id` uuid not null -> `subject_weeks.id` (cascade). Encodes the subject + term + week number; this is the "one quiz per subject per week" anchor.
- `title` text not null.
- `status` `quiz_status` not null default `draft`.
- `created_by` uuid not null -> `profiles.id` (the admin who created or requested it).
- `assigned_tutor_id` uuid null -> `profiles.id` (the tutor asked to build it; null for an admin-direct quiz).
- `note` text null (admin instructions to the tutor, and/or the reason when changes are requested).
- `approved_by` uuid null -> `profiles.id`.
- `approved_at` timestamptz null.
- `created_at`, `updated_at` timestamptz not null default now().
- Index on `subject_week_id` and on `assigned_tutor_id`.

### `quiz_questions`

- `id` uuid pk.
- `quiz_id` uuid not null -> `quizzes.id` (cascade).
- `prompt` text not null.
- `type` `quiz_question_type` not null.
- `position` integer not null (display order within the quiz).
- `created_at` timestamptz not null default now().
- Index on `quiz_id`.

### `quiz_options`

- `id` uuid pk.
- `question_id` uuid not null -> `quiz_questions.id` (cascade).
- `text` text not null.
- `is_correct` boolean not null default false.
- `position` integer not null (display order within the question).
- Index on `question_id`.
- True/False is stored as two fixed options ("True", "False") with one `is_correct`.

## Status lifecycle

- **Tutor path:** admin creates -> `requested` (assigned tutor set). Tutor edits questions/options while `requested` or `changes_requested`. Tutor submits -> `pending_review`. Admin approves -> `approved`, or sends back -> `changes_requested` (with a note). Cycle repeats until approved.
- **Admin-direct path:** admin creates -> `draft`, edits, then approves their own -> `approved`.
- Editable states: a tutor may edit only `requested` / `changes_requested` quizzes assigned to them. An admin may edit any non-`approved` quiz. Once `approved`, questions/options are locked (admin may still re-open by design later, out of scope now).

## Workflow + notifications

Notifications are created by a direct insert into the existing `notifications` table (`user_id`, `title`, `body`, `href`); there is no helper, matching how the reschedule flow does it.

- **Admin requests a quiz:** admin picks tutor + subject + week + optional note. Insert a `quizzes` row `status=requested`, `assigned_tutor_id=tutor`, `created_by=admin`. Notify the tutor: title "Quiz requested", body "Make the Week N <Subject> quiz", href `/tutor/quizzes/<id>`.
- **Tutor builds + submits:** tutor opens the request, builds in the maker, submits. Status -> `pending_review`. Notify the requesting admin (`created_by`): "Quiz ready for review", href `/admin/quizzes/<id>`.
- **Admin reviews:** approve -> `approved` (`approved_by`/`approved_at` set); notify the tutor "Quiz approved". Or send back -> `changes_requested` with a note; notify the tutor "Changes requested" with the note.
- **Admin-direct:** admin creates and builds a quiz, then approves it themselves. No tutor, no request notification.

## UI surfaces

The quiz maker is built through the `ui-ux-pro-max` ruleset (owner-mandated for this UI).

- **Admin `/admin/quizzes`** (admin UI kit): list of all quizzes with a status badge, filter by status/subject. Two primary actions: "New quiz" (admin-direct -> maker) and "Request a quiz" (a form: tutor + subject + week + note).
- **Admin `/admin/quizzes/[id]`**: the quiz detail. Shows the maker (editable while non-approved). When `pending_review`, shows Approve / Send back (with note) controls.
- **Tutor `/tutor/quizzes`** (tutor UI kit): quizzes assigned to this tutor, grouped by status (to do = requested/changes_requested; submitted = pending_review; done = approved).
- **Tutor `/tutor/quizzes/[id]`**: the maker, editable only while `requested`/`changes_requested`, read-only otherwise. Reachable from the notification.
- **The maker** (shared component): add a question -> pick type (multiple choice / true-false) -> add option rows -> mark the one correct option -> reorder questions and options -> save. True/False auto-fills two option rows.

## Permissions and RLS

App-layer checks are the primary control (Drizzle runs as the postgres role and bypasses RLS; RLS is defense-in-depth), matching the repo architecture.

- Server actions gate every mutation: `requireAdmin` for admin actions (create-direct, request, approve, send-back, and any edit); `requireTutor` plus an `assigned_tutor_id === user.id` and editable-status check for tutor edits/submit.
- RLS enabled on all three tables with policies mirroring `0024_resources.sql`: admin full via the `is_admin()` helper; tutor read/write limited to quizzes assigned to them; no student policy (students have no access in v1).

## Verification

- Migration applies cleanly (raw SQL) and `db:check-rls` passes (RLS on, policies present).
- Typecheck clean.
- Admin-direct: create a quiz, add a multiple-choice + a true/false question, mark correct answers, approve. Row lands `approved` with questions/options persisted in order.
- Request path: admin requests tutor X for Week N Maths; tutor X sees a notification + the quiz in `/tutor/quizzes`; tutor builds + submits; admin sees "ready for review" notification; admin sends back with a note (tutor notified, status `changes_requested`); tutor edits + resubmits; admin approves (tutor notified, status `approved`).
- Negative: a tutor cannot edit a quiz not assigned to them, nor edit after submitting/approval (server action rejects); a non-admin cannot approve.

## Rollout

Migration 0025 authored here; the owner/controller applies it (raw SQL via apply-sql, not db:push).
No data backfill.
Update `docs/checklist.md` (quizzes were a Phase 4 gap) and `docs/security-checklist.md` (new-table RLS entry).
