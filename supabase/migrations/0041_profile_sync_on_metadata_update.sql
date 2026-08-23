-- 0041_profile_sync_on_metadata_update.sql - also sync the profile when GoTrue
-- writes app_metadata, not only on the auth.users INSERT.
--
-- Bug this fixes (found 2026-08-23 while bootstrapping the production project):
-- `supabase.auth.admin.createUser({ app_metadata: { role, ... } })` does NOT
-- write app_metadata in the same statement as the row insert. Observed on a
-- freshly created project, immediately after insert:
--
--   raw_app_meta_data  = {"provider":"email","providers":["email"]}
--   raw_user_meta_data = {"role":"admin_unrestricted", ...}
--
-- The role arrives in a follow-up UPDATE. Migration 0001's trigger is AFTER
-- INSERT only, so it resolves a null role, logs its warning, and skips the
-- profile insert. The auth user is created successfully and the API returns
-- 200, so nothing surfaces the failure - the account simply has no
-- public.profiles row and the portal cannot use it.
--
-- This affects the real admin flow (`createUser` in
-- src/app/admin/_lib/actions-users.ts), which passes the role via app_metadata
-- exactly as B2 requires - app_metadata is server-only, user_metadata is
-- user-mutable and must never be trusted for authorization. So the fix belongs
-- in the trigger, not in the caller.
--
-- Fix: fire the same function on UPDATE of raw_app_meta_data once a role is
-- present. handle_new_auth_user already ends in ON CONFLICT (id) DO NOTHING,
-- so this is idempotent and never clobbers later edits to a profile's name or
-- role - it only fills in a row that is missing.
--
-- Reversible by:
--   DROP TRIGGER IF EXISTS on_auth_user_metadata_set ON auth.users;

begin;

drop trigger if exists on_auth_user_metadata_set on auth.users;

-- No COMMENT ON TRIGGER here: auth.users is owned by supabase_auth_admin, and
-- commenting requires ownership, so it fails with "must be owner of relation
-- users". CREATE TRIGGER itself is permitted. (0001 comments on the function,
-- which lives in public and is owned by postgres, which is why it succeeds.)
create trigger on_auth_user_metadata_set
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data ->> 'role' is not null)
  execute function public.handle_new_auth_user();

commit;
