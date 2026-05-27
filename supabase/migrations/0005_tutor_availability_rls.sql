-- 0005_tutor_availability_rls.sql
--
-- The tutor_availability table was added after migration 0004 wrote RLS for
-- the original 14 tables. Supabase Advisor flagged it as CRITICAL (RLS
-- Disabled in Public). This migration closes that gap.
--
-- The table stores recurring weekly slots (weekday + start/end time) and
-- date-specific overrides (date + start/end + is_available). Used by the
-- tutor portal's availability page and by the parent/student portals' make-up
-- booking flow.
--
-- WHY the policies are minimal: parent + student portals query availability
-- via Drizzle's server-side `db` client, which connects through DATABASE_URL
-- as the `postgres` role (bypasses RLS). The RLS policies here only constrain
-- client-side queries that would go through the Supabase JS SDK with a JWT —
-- a defense-in-depth layer for the case where the tutor portal eventually
-- adds direct client-side reads/writes.
--
-- Idempotent: drop policy if exists before create.

begin;

alter table public.tutor_availability enable row level security;

drop policy if exists tutor_availability_tutor_all on public.tutor_availability;
drop policy if exists tutor_availability_admin_all on public.tutor_availability;

-- Tutor: full CRUD on own availability rows.
create policy tutor_availability_tutor_all on public.tutor_availability
  for all to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

-- Admin: full access.
create policy tutor_availability_admin_all on public.tutor_availability
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No student/parent policy: their portals read availability through the
-- trusted server-side Drizzle client, which bypasses RLS. If a direct
-- client-side read is ever needed, add a policy here (e.g. authenticated-read
-- for booking flows).

commit;
