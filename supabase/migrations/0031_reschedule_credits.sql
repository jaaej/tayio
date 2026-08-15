-- supabase/migrations/0031_reschedule_credits.sql
-- Class credits + lesson cancellations for the self-serve reschedule/cancellation
-- limits feature. Additive, non-destructive. RLS enabled with no client policies:
-- all access is server-side Drizzle as the postgres role (bypasses RLS);
-- deny-by-default for anon/authenticated, matching every other table.
--
-- Reversible by:
--   DROP TABLE public.lesson_cancellations;
--   DROP TABLE public.class_credits;
--   DROP TYPE public.credit_status;
--   DROP TYPE public.credit_grant_reason;

begin;

do $$ begin
  create type public.credit_grant_reason as enum ('cancellation', 'reschedule_no_slot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.credit_status as enum ('active', 'redeemed', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists public.class_credits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  grant_reason public.credit_grant_reason not null,
  granted_from_lesson_id uuid references public.lessons(id) on delete set null,
  granted_by_id uuid not null references public.profiles(id),
  status public.credit_status not null default 'active',
  redeemed_on_lesson_id uuid references public.lessons(id) on delete set null,
  redeemed_by_id uuid references public.profiles(id),
  redeemed_at timestamptz,
  expires_at date not null,
  created_at timestamptz not null default now()
);

create index if not exists class_credits_student_status_idx
  on public.class_credits(student_id, status);
create index if not exists class_credits_term_idx
  on public.class_credits(term_id);

alter table public.class_credits enable row level security;

create table if not exists public.lesson_cancellations (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  cancelled_by_id uuid not null references public.profiles(id),
  term_id uuid not null references public.terms(id) on delete cascade,
  credit_id uuid references public.class_credits(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists lesson_cancellations_student_term_idx
  on public.lesson_cancellations(student_id, term_id);

alter table public.lesson_cancellations enable row level security;

commit;
