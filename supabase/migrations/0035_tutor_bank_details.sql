-- 0035_tutor_bank_details.sql - owner-only tutor payment/reference details.
-- Additive, non-destructive.
--
-- One optional row per tutor holding the bank details the owner needs for
-- payroll (account name + BSB + account number). Kept in its own table rather
-- than on public.profiles so this PII is isolated: only the owner-gated
-- /admin/tutors page reads/writes it (server-side Drizzle as the postgres
-- role), and it is never joined into any student/parent/tutor-facing query.
--
-- RLS: enabled with no client policies - deny-by-default for anon/authenticated,
-- matching class_credits (0031) / allowance_adjustments (0032) / student_leave
-- (0033). All access is server-side and gated in the app by
-- requireUnrestrictedAdmin(). The table is added to scripts/check-rls.mjs's
-- ALLOW_NO_RLS set.
--
-- Reversible by:
--   DROP TABLE public.tutor_bank_details;

begin;

create table if not exists public.tutor_bank_details (
  tutor_id uuid primary key references public.profiles(id) on delete cascade,
  account_name text,
  bsb text,
  account_number text,
  note text,
  updated_by_id uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.tutor_bank_details enable row level security;

commit;
