-- 0001_profile_sync_trigger.sql
-- Auto-create a public.profiles row whenever a new auth.users row appears.
-- Idempotent: re-running this migration drops and recreates the function/trigger.
-- Pulls role + name from app_metadata first, falling back to user_metadata so
-- the trigger works both before and after the role-to-app_metadata flip.

set search_path = public;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role text;
  resolved_first_name text;
  resolved_last_name text;
begin
  resolved_role := coalesce(
    new.raw_app_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'role'
  );

  resolved_first_name := coalesce(
    new.raw_app_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'first_name',
    split_part(new.email, '@', 1)
  );

  resolved_last_name := coalesce(
    new.raw_app_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'last_name',
    ''
  );

  if resolved_role is null then
    raise warning 'handle_new_auth_user: no role found for user %; skipping profile insert', new.id;
    return new;
  end if;

  insert into public.profiles (id, role, email, first_name, last_name, is_active)
  values (
    new.id,
    resolved_role::public.user_role,
    new.email,
    resolved_first_name,
    resolved_last_name,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

comment on function public.handle_new_auth_user is
  'Creates a public.profiles row when a new auth.users row is inserted. Idempotent via ON CONFLICT.';
