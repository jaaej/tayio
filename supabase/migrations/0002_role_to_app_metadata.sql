-- 0002_role_to_app_metadata.sql
-- One-time backfill: copy role + name from user_metadata into app_metadata
-- for every existing auth.users row that has them.
--
-- WHY: user_metadata is user-mutable (a signed-in user can self-edit it via
-- the Supabase client), which means a malicious user could promote themselves
-- to admin. app_metadata is server-only and never returned to the client as
-- writable. Role must live there.
--
-- WHY a merge (||) instead of overwrite: other app_metadata keys (e.g.
-- 'provider', 'providers' set by Supabase auth flows) must be preserved.
--
-- WHY jsonb_strip_nulls: if user_metadata is missing first_name or last_name,
-- we don't want to write a literal null into app_metadata — strip them so the
-- merge only touches keys that have real values.
--
-- Idempotent: re-running this migration produces the same result. Existing
-- app_metadata keys are preserved; role/name are overwritten with the
-- user_metadata values (which should match).

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
    'role', raw_user_meta_data ->> 'role',
    'first_name', raw_user_meta_data ->> 'first_name',
    'last_name', raw_user_meta_data ->> 'last_name'
  ))
where raw_user_meta_data ? 'role';
