-- 0013_profiles_role_lock.sql
--
-- Closes security-checklist A8 / SECURITY.md "Known caveats §1": the
-- profiles_update_own policy from migration 0004 lets a user UPDATE any column
-- on their own profile row, INCLUDING `role`. Today that grants no privilege —
-- every other table's RLS reads role from auth.jwt() (app_metadata), not from
-- profiles.role, and app_metadata is server-only — but a self-set
-- profiles.role is a latent footgun: any future code path that trusts
-- profiles.role for authorization would become an instant privilege-escalation.
--
-- Fix: a BEFORE UPDATE trigger that reverts profiles.role to its OLD value when
-- the caller is the `authenticated`/`anon` role and isn't an admin. Mirrors the
-- silent-revert pattern of 0007 (homework grading lock): the UPDATE proceeds so
-- profiles_update_own (name, etc.) keeps working; only `role` is pinned.
--
-- Carve-outs (trusted callers, no restriction):
--   - current_user NOT IN ('authenticated','anon') — postgres role (Drizzle via
--     DATABASE_URL) and service_role. Server-side admin mutations + seed
--     scripts continue to set role freely.
--   - public.is_admin() — admin via authenticated JWT.
--
-- WHY SECURITY INVOKER (not DEFINER): with DEFINER, current_user inside the
-- function is always the owner (postgres), so the bypass check would always
-- pass. INVOKER makes current_user reflect the actual caller's role. The
-- is_admin() helper it calls is itself SECURITY DEFINER.
--
-- Idempotent: create or replace function; drop trigger if exists. Safe to re-run.

begin;

create or replace function public.enforce_profiles_role_lock()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  -- Trusted server contexts (postgres / service_role): allow anything.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- No change to role: nothing to guard.
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Admin via authenticated JWT may change roles.
  if public.is_admin() then
    return new;
  end if;

  -- Everyone else: silently pin role to its previous value.
  new.role := old.role;
  return new;
end;
$$;

comment on function public.enforce_profiles_role_lock is
  'BEFORE UPDATE guard on profiles — reverts changes to role unless the caller is an admin. Trusted server contexts (postgres / service_role) bypass. Authoritative role lives in auth.users.app_metadata; this pins the display column too.';

drop trigger if exists profiles_role_lock on public.profiles;

create trigger profiles_role_lock
  before update on public.profiles
  for each row execute function public.enforce_profiles_role_lock();

commit;
