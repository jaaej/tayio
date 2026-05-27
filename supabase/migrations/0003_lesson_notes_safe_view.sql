-- 0003_lesson_notes_safe_view.sql
--
-- Creates public.lesson_notes_safe — a view over public.lesson_notes that
-- (a) omits the internal_note column entirely, and (b) self-enforces row
-- visibility for student / parent / tutor / admin.
--
-- WHY a view instead of column privileges:
-- Postgres RLS is row-level. To hide a single sensitive column from one role
-- and not another, you either use column-level GRANT/REVOKE (composes
-- awkwardly with RLS, easy to forget when adding new sensitive columns) or
-- expose only the safe columns through a view. We chose the view: explicit,
-- auditable, hard to silently break when adding new sensitive columns later.
--
-- WHY security_invoker = false (the default):
-- The view must bypass RLS on lesson_notes so its own WHERE clause is the
-- only gate. Migration 0004 locks lesson_notes (base table) to tutors and
-- admins only — students and parents have no direct SELECT on the base
-- table, only on this view. internal_note is therefore unreachable by them
-- by construction.
--
-- WHY auth.uid() / auth.jwt():
-- Supabase populates auth.uid() with the authenticated user's id and
-- auth.jwt() with the JWT claims (which include app_metadata.role after
-- migration 0002). Both return NULL for the anon role, so anon queries
-- against this view return zero rows.
--
-- The Supabase Advisor flags this view as "Security Definer View — CRITICAL".
-- That's a generic check on any security_invoker=false view. In our case the
-- pattern is deliberate and the WHERE clause + revoked DML grants ARE the
-- access control. The warning can be dismissed.
--
-- Idempotent: re-running drops + recreates the view.

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
  -- Student sees their own notes
  ln.student_id = auth.uid()
  -- Tutor sees notes for lessons they taught
  or ln.tutor_id = auth.uid()
  -- Parent sees notes for their linked children
  or exists (
    select 1
    from public.family_links fl
    where fl.parent_id = auth.uid()
      and fl.student_id = ln.student_id
  )
  -- Admin sees all
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';

comment on view public.lesson_notes_safe is
  'Read path for students/parents (and a column-safe path for tutors/admins). Excludes internal_note. Row visibility enforced by WHERE clause inside the view (security_invoker=false bypasses RLS on lesson_notes).';

-- Lock down: only authenticated users can query, and only SELECT.
-- Supabase grants the full DML set to authenticated/anon by default; revoke
-- before re-granting SELECT.
revoke all on public.lesson_notes_safe from public;
revoke all on public.lesson_notes_safe from anon;
revoke all on public.lesson_notes_safe from authenticated;
grant select on public.lesson_notes_safe to authenticated;
