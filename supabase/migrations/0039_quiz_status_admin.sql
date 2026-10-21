-- 0039_quiz_status_admin.sql
-- Adds the 'admin' quiz status: a quiz an admin both wrote and published
-- themselves, so it never travels the tutor path (requested -> pending_review
-- -> approved). It is a live/published state, exactly as visible to students
-- as 'approved' - the two are separated only so the list shows who published.
--
-- Additive enum value only; no table, column, or policy change, so RLS is
-- untouched. Apply via scripts/apply-migration.mjs (never db:push).

ALTER TYPE quiz_status ADD VALUE IF NOT EXISTS 'admin';
