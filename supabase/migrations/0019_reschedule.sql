-- 0019_reschedule.sql
--
-- Self-serve reschedule (spec 2026-07-10):
--   1. class_type enum + classes.class_type (every existing class -> 'group').
--   2. reschedule_status enum + reschedule_requests table.
--
-- Raw SQL by design — no drizzle-kit push. Guarded so re-running is safe.

-- 1. class_type -------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'class_type') then
    create type public.class_type as enum ('group', 'one_on_one');
  end if;
end $$;

alter table public.classes
  add column if not exists class_type public.class_type not null default 'group';

-- 2. reschedule_requests ----------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'reschedule_status') then
    create type public.reschedule_status as enum
      ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end $$;

create table if not exists public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  original_lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  requested_by_id uuid not null references public.profiles(id),
  reason text,
  status public.reschedule_status not null default 'pending',
  -- 1-on-1 target: a new makeup slot with the same tutor
  target_tutor_id uuid references public.profiles(id),
  target_date date,
  target_start_time time,
  target_end_time time,
  -- group target: an existing lesson to join
  target_lesson_id uuid references public.lessons(id) on delete cascade,
  decided_by_id uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reschedule_requests_status_idx
  on public.reschedule_requests(status);
create index if not exists reschedule_requests_student_idx
  on public.reschedule_requests(student_id);

-- RLS: all access is server-side Drizzle (postgres role, bypasses RLS).
-- Enable RLS with no client policies = deny-by-default for anon/authenticated,
-- consistent with the rest of the schema.
alter table public.reschedule_requests enable row level security;
