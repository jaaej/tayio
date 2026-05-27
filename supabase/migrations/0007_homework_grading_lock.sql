-- 0007_homework_grading_lock.sql
--
-- Closes security-checklist A9: the homework_assignments_student_update
-- policy from migration 0004 lets a student UPDATE any column on their own
-- assignment row, including score / feedback / marked_at / marked_by — the
-- tutor-only grading fields. Frontend doesn't expose those, but the database
-- accepts them: a student calling supabase.from('homework_assignments')
-- .update({ score: 100 }).eq(...) over the JS SDK would have their UPDATE
-- accepted by RLS.
--
-- Fix: a BEFORE UPDATE trigger that resets grading columns to their OLD
-- values when the caller is the `authenticated` role and isn't the
-- assignment's tutor or an admin. The UPDATE itself is allowed to proceed
-- (silent enforcement — the row "updates" but the disallowed fields don't
-- change), keeping the student portal's existing optimistic-UI code working
-- without errors.
--
-- Carve-outs (trusted callers, no restriction):
--   - current_user IS NOT 'authenticated' / 'anon' — i.e. postgres role
--     (Drizzle via DATABASE_URL) or service_role. Server-side admin/tutor
--     mutations and seed scripts continue to work unrestricted.
--   - public.is_admin() — admin via authenticated JWT.
--   - public.is_tutor_of_homework(homework_id) — the homework's authoring
--     tutor via authenticated JWT.
--
-- Idempotent: create or replace function; drop trigger if exists. Safe to
-- re-run.

begin;

create or replace function public.enforce_homework_assignment_grading_lock()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  -- Trusted server contexts: allow anything.
  -- current_user is the effective role the statement is running as. For
  -- Supabase: PostgREST sets it to 'authenticated' (or 'anon') when a JWT
  -- request arrives. Direct postgres / service_role connections keep their
  -- own role name and bypass.
  --
  -- WHY SECURITY INVOKER (not DEFINER): with SECURITY DEFINER, current_user
  -- inside the function is always the function owner (postgres), so the
  -- bypass check would always succeed. INVOKER makes current_user reflect
  -- the actual caller's role. The helpers this function calls
  -- (is_admin, is_tutor_of_homework) are themselves SECURITY DEFINER and
  -- handle their own table-access privileges.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Admin or the homework's tutor via authenticated JWT: allow.
  if public.is_admin() then
    return new;
  end if;
  if public.is_tutor_of_homework(new.homework_id) then
    return new;
  end if;

  -- Everyone else (the student via JS SDK, or any other authenticated user):
  -- silently revert tutor-only grading fields to their previous values.
  new.score := old.score;
  new.feedback := old.feedback;
  new.marked_at := old.marked_at;
  new.marked_by := old.marked_by;
  return new;
end;
$$;

comment on function public.enforce_homework_assignment_grading_lock is
  'BEFORE UPDATE guard on homework_assignments — reverts changes to score / feedback / marked_at / marked_by unless the caller is the homeworks tutor or an admin. Trusted server contexts (postgres / service_role) bypass.';

drop trigger if exists homework_assignments_grading_lock on public.homework_assignments;

create trigger homework_assignments_grading_lock
  before update on public.homework_assignments
  for each row execute function public.enforce_homework_assignment_grading_lock();

commit;
