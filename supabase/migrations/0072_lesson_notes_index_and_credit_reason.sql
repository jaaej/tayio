-- 0072: look up a lesson's notes by lesson, and keep a family's credit reason
-- on the credit.
--
-- 1. The shared lesson counts (lessonCountFields, src/lib/lesson-progress-sql.ts)
--    and the admin "notes missing" count ask, for every lesson, which students
--    have a note. lesson_notes had only its primary key, so each of those
--    correlated lookups scanned the whole table: fine with a few hundred
--    notes, slow once a year of notes builds up.
--
-- 2. A family's reason for moving or cancelling a lesson used to be copied
--    into the staff roll note ("Rescheduled: <reason>"). Moves keep it on the
--    reschedule request and cancellations on lesson_cancellations; a credit a
--    family asks for when no reschedule slot is free had nowhere else, so it
--    gets request_reason.
--
-- Additive: one index and one nullable column. Reversible: drop both.

create index if not exists lesson_notes_lesson_student_idx
  on public.lesson_notes (lesson_id, student_id);

alter table public.class_credits
  add column if not exists request_reason text;
alter table public.class_credits
  drop constraint if exists class_credits_request_reason_check;
alter table public.class_credits
  add constraint class_credits_request_reason_check
  check (request_reason is null or char_length(request_reason) <= 2000);
