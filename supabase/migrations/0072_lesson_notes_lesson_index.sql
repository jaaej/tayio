-- 0072: look up a lesson's notes by lesson.
--
-- The shared lesson counts (lessonCountFields, src/lib/lesson-progress-sql.ts)
-- and the admin "notes missing" count ask, for every lesson, which students
-- have a note. lesson_notes had only its primary key, so each of those
-- correlated lookups scanned the whole table: fine with a few hundred notes,
-- slow once a year of notes builds up.
--
-- Additive: one index. Reversible: drop it.

create index if not exists lesson_notes_lesson_student_idx
  on public.lesson_notes (lesson_id, student_id);
