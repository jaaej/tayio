-- 0030_free_trials.sql - per-enrollment free-trial start/end dates.
-- Additive. An enrollment is a trial iff trial_ends_at IS NOT NULL; both dates
-- are set together or both null. Existing rows (both null) satisfy the check.
-- (0028/0029 belong to the held feat/term-test branch and are already applied
-- to the live database; this continues at 0030.)

begin;

alter table public.enrollments
  add column if not exists trial_starts_at date,
  add column if not exists trial_ends_at date;

alter table public.enrollments
  add constraint enrollments_trial_shape check (
    (trial_starts_at is null) = (trial_ends_at is null)
    and (trial_starts_at is null or trial_starts_at <= trial_ends_at)
  );

commit;
