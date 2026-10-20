-- 0079: what was done at the end of each school year.
--
-- The Terms page archives the Year 12 students and moves every other student
-- up a year once the year's final term ends (src/app/admin/_lib/school-year.ts).
-- Moving up must happen once per school year: run twice, a Year 10 would
-- become a Year 12. This row records it, and its primary key and
-- rolled_over_at make a second run refuse inside the same transaction.
-- It also keeps who was archived and each student's old and new level, so an
-- admin can see (and if needed undo by hand) what the button did.
--
-- RLS: enabled with no client policies; only the server's own connection
-- reads and writes it, like allowance_adjustments (0032).
-- Additive. Reversible: drop table public.school_year_ends.

create table if not exists public.school_year_ends (
  school_year integer primary key,
  year12_archived_at timestamptz,
  year12_archived_by uuid references public.profiles(id) on delete set null,
  archived_student_ids uuid[] not null default '{}',
  archived_parent_ids uuid[] not null default '{}',
  rolled_over_at timestamptz,
  rolled_over_by uuid references public.profiles(id) on delete set null,
  -- [{ "id": "<student uuid>", "from": "Year 9", "to": "Year 10" }, ...]
  moved jsonb not null default '[]'::jsonb,
  constraint school_year_ends_year_check check (school_year between 2000 and 2100)
);

alter table public.school_year_ends enable row level security;
