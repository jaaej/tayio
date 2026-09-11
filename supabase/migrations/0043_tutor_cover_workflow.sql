-- 0043_tutor_cover_workflow.sql - tutor leave approval and lesson cover board.
-- Additive and non-destructive. Both workflow tables are app-authorised and
-- server-only: RLS is enabled with no anon/authenticated policies.
--
-- Reversible by:
--   DROP TABLE public.tutor_cover_requests;
--   DROP TABLE public.tutor_leave_requests;
--   DROP TYPE public.tutor_cover_status;
--   DROP TYPE public.tutor_leave_status;

begin;

do $$ begin
  create type public.tutor_leave_status as enum
    ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tutor_cover_status as enum
    ('open', 'claimed', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists public.tutor_leave_requests (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status public.tutor_leave_status not null default 'pending',
  decided_by_id uuid references public.profiles(id),
  decided_at timestamptz,
  last_uncovered_reminder_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_leave_requests_dates_check check (end_date >= start_date),
  constraint tutor_leave_requests_reason_check check (char_length(reason) between 1 and 2000)
);

create index if not exists tutor_leave_requests_tutor_idx
  on public.tutor_leave_requests(tutor_id);
create index if not exists tutor_leave_requests_status_dates_idx
  on public.tutor_leave_requests(status, start_date, end_date);

create table if not exists public.tutor_cover_requests (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  leave_request_id uuid references public.tutor_leave_requests(id) on delete set null,
  original_tutor_id uuid not null references public.profiles(id),
  replacement_tutor_id uuid references public.profiles(id),
  reason text not null,
  status public.tutor_cover_status not null default 'open',
  claimed_at timestamptz,
  alert_48_sent_at timestamptz,
  alert_24_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_cover_requests_reason_check check (char_length(reason) between 1 and 2000)
);

create unique index if not exists tutor_cover_requests_lesson_idx
  on public.tutor_cover_requests(lesson_id);
create index if not exists tutor_cover_requests_status_idx
  on public.tutor_cover_requests(status);
create index if not exists tutor_cover_requests_leave_idx
  on public.tutor_cover_requests(leave_request_id);
create index if not exists tutor_cover_requests_replacement_idx
  on public.tutor_cover_requests(replacement_tutor_id);

alter table public.tutor_leave_requests enable row level security;
alter table public.tutor_cover_requests enable row level security;

commit;
