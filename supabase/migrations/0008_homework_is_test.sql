-- 0008_homework_is_test.sql
--
-- Adds an is_test flag to the homework table so the student portal can
-- distinguish marked tests from regular homework when displaying rank
-- (per-test and overall-by-subject). Default false so existing rows are
-- preserved as non-test.
--
-- Idempotent: column add is guarded so re-running is safe.

begin;

alter table public.homework
  add column if not exists is_test boolean not null default false;

commit;
