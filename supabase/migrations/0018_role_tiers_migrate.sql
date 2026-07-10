-- 0018_role_tiers_migrate.sql
--
-- Migrates existing accounts to tiered roles and updates the admin-detection
-- predicates so they match BOTH admin tiers (and the legacy 'admin' value).
--
-- Safe mapping (preserves current capabilities):
--   admin   -> admin_unrestricted   (owner keeps full access)
--   student -> student_restricted    (parent-dependent, today's exact scope)
--
-- This changes app_metadata.role (the JWT claim that requireRole AND RLS read),
-- so is_admin() / the lesson_notes_safe view MUST be updated in the same
-- migration or all admin access breaks. Raw SQL by design — no drizzle-kit push.

-- 1. profiles.role
update public.profiles set role = 'admin_unrestricted'   where role = 'admin';
update public.profiles set role = 'student_restricted'    where role = 'student';

-- 2. auth.users.app_metadata.role — the runtime source of truth. Mirror of
--    migration 0002's merge (preserve other app_metadata keys via ||).
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin_unrestricted')
where (raw_app_meta_data ->> 'role') = 'admin';

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'student_restricted')
where (raw_app_meta_data ->> 'role') = 'student';

-- 3. is_admin(): match both admin tiers (and legacy 'admin', harmlessly) via
--    the like 'admin%' prefix. Original body (migration 0004) compared = 'admin'.
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') like 'admin%', false);
$$;

-- 4. lesson_notes_safe: same prefix fix on the inline admin predicate. Body is
--    copied verbatim from migration 0003 except the final WHERE clause.
create or replace view public.lesson_notes_safe
with (security_invoker = false) as
select
  ln.id,
  ln.lesson_id,
  ln.student_id,
  ln.tutor_id,
  ln.topic_covered,
  ln.key_concepts,
  ln.performance,
  ln.strengths,
  ln.struggles,
  ln.next_lesson_focus,
  ln.parent_visible_comment,
  ln.created_at
from public.lesson_notes ln
where
  ln.student_id = auth.uid()
  or ln.tutor_id = auth.uid()
  or exists (
    select 1
    from public.family_links fl
    where fl.parent_id = auth.uid()
      and fl.student_id = ln.student_id
  )
  or (auth.jwt() -> 'app_metadata' ->> 'role') like 'admin%';

revoke all on public.lesson_notes_safe from public;
revoke all on public.lesson_notes_safe from anon;
revoke all on public.lesson_notes_safe from authenticated;
grant select on public.lesson_notes_safe to authenticated;
