-- 0045_account_pauses_and_class_moves.sql - independent account/schedule
-- status plus an auditable permanent class-relocation workflow.
--
-- Additive and non-destructive. Class-move requests are authorised by server
-- actions, so the table is RLS deny-by-default for browser clients.
--
-- Reversible by:
--   DROP TABLE public.class_move_requests;
--   ALTER TABLE public.profiles DROP COLUMN pause_status;
--   DROP TYPE public.class_move_status;
--   DROP TYPE public.account_pause_status;

begin;

do $$ begin
  create type public.account_pause_status as enum
    ('none', 'on_break', 'paused');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists pause_status public.account_pause_status
    not null default 'none';

do $$ begin
  create type public.class_move_status as enum
    ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.class_move_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  requested_by_id uuid not null references public.profiles(id),
  from_class_id uuid not null references public.classes(id),
  to_class_id uuid not null references public.classes(id),
  reason text not null,
  status public.class_move_status not null default 'pending',
  decided_by_id uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_move_requests_different_classes_check
    check (from_class_id <> to_class_id),
  constraint class_move_requests_reason_check
    check (char_length(reason) between 1 and 2000)
);

create index if not exists class_move_requests_student_idx
  on public.class_move_requests(student_id, created_at desc);
create index if not exists class_move_requests_status_idx
  on public.class_move_requests(status, created_at desc);
create unique index if not exists class_move_requests_one_pending_idx
  on public.class_move_requests(student_id, from_class_id)
  where status = 'pending';

alter table public.class_move_requests enable row level security;

commit;
