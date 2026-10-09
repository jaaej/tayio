# Admin homework, solutions, and quiz-builder layout

**Date:** 8 October 2026

## Outcome

Admins can now create class homework from the relevant curriculum week.
The selected class determines the assigned students and the tutor who owns the marking workflow.
The new `homework.created_by_id` field records whether the task was created by that tutor or an admin.

Admins and assigned tutors can upload, replace, open, and remove a separate homework solution.
Solutions use the existing private `homework-attachments` bucket and the direct-upload validation flow.
Assigned students only receive a signed solution URL after the homework due date.

The quiz builder now uses a single aligned content flow.
Its title and metrics occupy a compact header, the back action is icon-sized, question cards use the full width, question-type controls sit below the question list, and readiness is a compact footer row.

## Data change

Migration `0056_admin_homework_and_solutions.sql` adds:

- `homework.created_by_id`, backfilled from `tutor_id` for existing rows;
- `homework.solution_url` for the separate private solution object path.

The migration was applied to the isolated development database on 8 October 2026.
It still requires the normal reviewed production migration and deployment process before the production portal can use these fields.

## Verification

- TypeScript validation passed after the implementation.
- All 170 unit tests passed across 30 test files.
- The Next.js production build completed successfully.
- Development RLS verification passed after applying migration `0056`.
- Manual authenticated browser QA remains listed in `checklist_beta_fix.md`.
