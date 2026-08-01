-- 0033_student_leave.sql - per-student leave / holiday periods. Additive,
-- non-destructive.
--
-- A row is a contiguous inclusive date range [start_date, end_date] during
-- which the student is away from ALL their classes (a family holiday, etc.), so
-- tutors don't mark them absent every day of a known break. Multiple separate
-- holidays = multiple rows (the Excel "HOLS 03/07-10/07 + 10/08" encoding).
--
-- RLS: enabled with no client policies - all access is server-side Drizzle as
-- the postgres role (bypasses RLS); deny-by-default for anon/authenticated,
-- matching allowance_adjustments (0032) / class_credits (0031). The table is
-- added to scripts/check-rls.mjs's ALLOW_NO_RLS set.
--
-- Reversible by:
--   DROP TABLE public.student_leave;

begin;

create table if not exists public.student_leave (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_by_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists student_leave_student_idx
  on public.student_leave(student_id);
create index if not exists student_leave_dates_idx
  on public.student_leave(start_date, end_date);

alter table public.student_leave enable row level security;

commit;
