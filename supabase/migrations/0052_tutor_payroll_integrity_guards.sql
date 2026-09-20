-- Database-level payroll invariants. Application checks remain the friendly
-- first line of defence; these triggers stop a future code path or concurrent
-- request from mutating approved snapshots or approving unsafe pay data.

begin;

do $$ begin
  alter table public.tutor_weekly_checkins
    add constraint tutor_weekly_checkins_approval_timestamp_check
    check (
      (status = 'approved' and approved_at is not null)
      or (status <> 'approved' and approved_at is null)
    );
exception when duplicate_object then null; end $$;

create or replace function public.validate_tutor_checkin_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'approved' then
    if not exists (
      select 1
      from public.tutor_checkin_entries entry
      where entry.checkin_id = new.id
        and entry.is_removed = false
    ) then
      raise exception 'Cannot approve a tutor check-in without worked lessons';
    end if;

    if exists (
      select 1
      from public.tutor_checkin_entries entry
      where entry.checkin_id = new.id
        and entry.is_removed = false
        and (entry.hourly_rate <= 0 or entry.minutes <= 0)
    ) then
      raise exception 'Cannot approve a tutor check-in with a missing rate or invalid duration';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_tutor_checkin_approval
  on public.tutor_weekly_checkins;
create trigger validate_tutor_checkin_approval
  before insert or update on public.tutor_weekly_checkins
  for each row execute function public.validate_tutor_checkin_approval();

create or replace function public.protect_approved_tutor_checkin_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_status public.tutor_checkin_status;
begin
  select status into parent_status
  from public.tutor_weekly_checkins
  where id = coalesce(new.checkin_id, old.checkin_id)
  for update;

  if parent_status = 'approved' then
    raise exception 'Approved tutor check-in rows are immutable; reopen the week first';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_approved_tutor_checkin_entry
  on public.tutor_checkin_entries;
create trigger protect_approved_tutor_checkin_entry
  before insert or update on public.tutor_checkin_entries
  for each row execute function public.protect_approved_tutor_checkin_entry();

commit;
