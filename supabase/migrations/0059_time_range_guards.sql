-- 0059_time_range_guards.sql
-- A lesson that finishes before it starts breaks payroll check-ins: the admin
-- check-in page threw for the whole week when one recurring class was saved
-- as 12:00 to 02:10 (an AM/PM slip for 14:10). The admin class actions now
-- reject that range; these constraints make every writer obey it.
--
-- Applying fails if any existing row violates a guard. Correct such rows
-- first (production's ENG class and its lessons were fixed on 10 Oct 2026).
--
-- Reversible by:
--   ALTER TABLE public.classes DROP CONSTRAINT classes_time_range_check;
--   ALTER TABLE public.lessons DROP CONSTRAINT lessons_time_range_check;
--   ALTER TABLE public.tutor_availability DROP CONSTRAINT tutor_availability_time_range_check;
--   ALTER TABLE public.tutor_checkin_entries DROP CONSTRAINT tutor_checkin_entries_time_range_check;

begin;

-- Class times are optional (unscheduled classes), so NULLs pass.
alter table public.classes
  add constraint classes_time_range_check
  check (end_time > start_time);

alter table public.lessons
  add constraint lessons_time_range_check
  check (end_time > start_time);

alter table public.tutor_availability
  add constraint tutor_availability_time_range_check
  check (end_time > start_time);

alter table public.tutor_checkin_entries
  add constraint tutor_checkin_entries_time_range_check
  check (end_time > start_time);

commit;
