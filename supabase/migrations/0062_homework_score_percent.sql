-- 0062: a homework score is the percentage the tutor awards.
--
-- Student progress, the term report and score badges already read
-- homework_assignments.score as 0-100, but nothing stopped a larger number.
-- The tutor marking action now validates the range; this constraint keeps any
-- other writer to the same rule. Existing rows were checked first: none are
-- outside 0-100 on dev or production.

begin;

alter table public.homework_assignments
  drop constraint if exists homework_assignments_score_percent;
alter table public.homework_assignments
  add constraint homework_assignments_score_percent
  check (score is null or (score >= 0 and score <= 100));

commit;
