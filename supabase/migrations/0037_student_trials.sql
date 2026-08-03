-- 0037_student_trials.sql - per-student free-trial period. Additive,
-- non-destructive.
--
-- A student trialing the service has one inclusive [start_date, end_date]
-- window (1:1 - student_id is the PK). Admin sets it; tutors see a "Free trial"
-- pill on lessons that fall inside it. Automated missed-class / trial-end
-- follow-ups are deferred (need a scheduled job) - this is the tracking layer.
--
-- RLS: enabled with no client policies - deny-by-default; all access is
-- server-side Drizzle as the postgres role (bypasses RLS), matching
-- student_leave (0033) / tutor_bank_details (0035) / quiz_attempts (0036).
-- Added to scripts/check-rls.mjs's ALLOW_NO_RLS set.
--
-- Reversible by:
--   DROP TABLE public.student_trials;

begin;

create table if not exists public.student_trials (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_by_id uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.student_trials enable row level security;

commit;
