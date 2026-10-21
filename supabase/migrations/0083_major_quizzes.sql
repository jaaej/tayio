-- 0083: a quiz can count towards a student's term report ratings.
--
-- The report rates each topic 1 to 6 from the term's topic tests and the
-- quizzes an admin marks as major (src/lib/attainment-bands.ts); practice
-- quizzes stay out of it. Additive, default false, so every existing quiz
-- stays a practice quiz. Reversible: drop the column.

alter table public.quizzes
  add column if not exists is_major boolean not null default false;
