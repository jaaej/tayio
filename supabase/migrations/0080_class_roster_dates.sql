-- 0080: who is on a lesson's roll, by date.
--
-- A lesson's roll was "the class's current students who had enrolled by the
-- lesson date", and withdrawing a student took them off every unmarked
-- lesson of the class, including ones before they left. Admins can now add
-- or remove a student on a lesson's roll for that lesson only or from that
-- lesson on (src/app/admin/_lib/actions-roll.ts), so a student's place on a
-- lesson depends on its date:
--
-- 1. enrollments.ends_on: the first lesson date the student is no longer on
--    the class's rolls. Set when they leave from a lesson, or leave today;
--    withdrawn_at follows on that day (the daily sweep for a future date).
--    Null on a row withdrawn before this migration, which keeps the old rule
--    (off every unmarked lesson) for those.
-- 2. lesson_roll_exclusions: a class student taken off one lesson only.
--
-- The rule lives in src/lib/class-roster-sql.ts. RLS on lesson_roll_exclusions:
-- enabled with no client policies; only the server's connection uses it.
-- Additive. Reversible: drop the table and the column.

alter table public.enrollments
  add column if not exists ends_on date;

create table if not exists public.lesson_roll_exclusions (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  excluded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);
create index if not exists lesson_roll_exclusions_student_idx
  on public.lesson_roll_exclusions (student_id);

alter table public.lesson_roll_exclusions enable row level security;
