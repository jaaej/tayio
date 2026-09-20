-- Durable weekly lesson/pay snapshots with tutor approval and owner corrections.

begin;

do $$ begin
  create type public.tutor_checkin_status as enum
    ('pending', 'approved', 'disputed');
exception when duplicate_object then null; end $$;

alter table public.tutor_bank_details
  add column if not exists hourly_rate numeric(10,2);

do $$ begin
  alter table public.tutor_bank_details
    add constraint tutor_bank_details_hourly_rate_nonnegative
    check (hourly_rate is null or hourly_rate >= 0);
exception when duplicate_object then null; end $$;

create table if not exists public.tutor_weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  status public.tutor_checkin_status not null default 'pending',
  approved_at timestamptz,
  dispute_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tutor_id, week_start)
);

create index if not exists tutor_weekly_checkins_week_status_idx
  on public.tutor_weekly_checkins(week_start, status);

create table if not exists public.tutor_checkin_entries (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null
    references public.tutor_weekly_checkins(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  subject_name text not null,
  class_name text not null,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  hourly_rate numeric(10,2) not null default 0 check (hourly_rate >= 0),
  note text,
  is_manual_override boolean not null default false,
  is_removed boolean not null default false,
  updated_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tutor_checkin_entries_checkin_lesson_unique_idx
  on public.tutor_checkin_entries(checkin_id, lesson_id)
  where lesson_id is not null;
create index if not exists tutor_checkin_entries_checkin_date_idx
  on public.tutor_checkin_entries(checkin_id, work_date);

alter table public.tutor_weekly_checkins enable row level security;
alter table public.tutor_checkin_entries enable row level security;
revoke all on public.tutor_weekly_checkins from anon, authenticated;
revoke all on public.tutor_checkin_entries from anon, authenticated;

drop trigger if exists audit_tutor_weekly_checkins
  on public.tutor_weekly_checkins;
create trigger audit_tutor_weekly_checkins
  after insert or update or delete on public.tutor_weekly_checkins
  for each row execute function public.handle_audit_log();

drop trigger if exists audit_tutor_checkin_entries
  on public.tutor_checkin_entries;
create trigger audit_tutor_checkin_entries
  after insert or update or delete on public.tutor_checkin_entries
  for each row execute function public.handle_audit_log();

drop trigger if exists audit_tutor_bank_details
  on public.tutor_bank_details;
create trigger audit_tutor_bank_details
  after insert or update or delete on public.tutor_bank_details
  for each row execute function public.handle_audit_log();

commit;
