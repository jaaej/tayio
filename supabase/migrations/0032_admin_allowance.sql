-- 0032_admin_allowance.sql - admin-granted class credits + per-term
-- reschedule/cancellation allowance top-ups. Additive, non-destructive.
--
-- 1. Adds 'admin_grant' to the credit_grant_reason enum so a credit granted
--    directly by an admin (no originating cancellation/reschedule) is
--    distinguishable in the credits overview.
-- 2. Adds an allowance_kind enum + allowance_adjustments table recording each
--    admin bonus to a student's per-term reschedule or cancellation allowance.
--    The effective cap becomes 3 + sum(bonus) for that student+term+kind.
--
-- Postgres note: a new enum value cannot be USED in the same transaction that
-- adds it. This migration only alters schema and never inserts a row using
-- 'admin_grant', so wrapping in begin/commit is safe (same pattern as 0027).
--
-- RLS: allowance_adjustments has RLS enabled with no client policies - all
-- access is server-side Drizzle as the postgres role (bypasses RLS);
-- deny-by-default for anon/authenticated, matching class_credits (0031).
--
-- Reversible by:
--   DROP TABLE public.allowance_adjustments;
--   DROP TYPE public.allowance_kind;
--   (the enum value 'admin_grant' cannot be dropped; harmless).

begin;

alter type public.credit_grant_reason add value if not exists 'admin_grant';

do $$ begin
  create type public.allowance_kind as enum ('reschedule', 'cancellation');
exception when duplicate_object then null; end $$;

create table if not exists public.allowance_adjustments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  kind public.allowance_kind not null,
  bonus int not null,
  granted_by_id uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists allowance_adjustments_student_term_idx
  on public.allowance_adjustments(student_id, term_id);

alter table public.allowance_adjustments enable row level security;

commit;
