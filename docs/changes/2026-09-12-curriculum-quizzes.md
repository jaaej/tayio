# Curriculum-based admin quizzes

Implemented locally on 12 September 2026. No database migration is required.

The admin sidebar no longer presents Quizzes as a separate destination. Each
saved week in Admin → Classes → Curriculum now shows its own Weekly quiz area:

- a week with no quiz offers both direct draft creation and a tutor request;
- the currently open week is preselected in the creation panel;
- a week with a quiz shows its title, workflow status, answerable-question
  count, approval action when relevant, and quiz-builder link;
- the admin quiz builder returns to the exact curriculum subject, term, and
  week it belongs to.

Existing quiz records, status permissions, tutor request notifications, student
visibility rules, and the one-quiz-per-week database constraint are unchanged.
The legacy `/admin/quizzes` route remains available for existing deep links,
but is no longer part of normal navigation or quiz creation.
