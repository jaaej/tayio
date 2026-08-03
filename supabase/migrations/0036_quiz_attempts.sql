-- 0036_quiz_attempts.sql - persist student quiz scores. Additive,
-- non-destructive.
--
-- Quizzes are unranked practice, but the score IS tracked: one row per
-- submission (a student may retake, so multiple rows per quiz - report/analytics
-- use the latest by submitted_at). Written by gradePracticeQuiz after grading.
--
-- RLS: enabled with no client policies - deny-by-default; all reads/writes are
-- server-side Drizzle as the postgres role (bypasses RLS), matching
-- class_credits (0031) / student_leave (0033) / tutor_bank_details (0035).
-- Added to scripts/check-rls.mjs's ALLOW_NO_RLS set.
--
-- Reversible by:
--   DROP TABLE public.quiz_attempts;

begin;

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  correct_count integer not null,
  total integer not null,
  submitted_at timestamptz not null default now()
);

create index if not exists quiz_attempts_student_idx
  on public.quiz_attempts(student_id);
create index if not exists quiz_attempts_quiz_idx
  on public.quiz_attempts(quiz_id);

alter table public.quiz_attempts enable row level security;

commit;
