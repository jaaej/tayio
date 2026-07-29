-- 0028_term_test.sql - term_test quiz kind + scored attempts + leaderboard.
-- Additive. A term test is a quizzes row with kind='term_test', term_id set,
-- subject_week_id null, results_release_at set. Weekly rows are unchanged
-- (kind defaults to 'weekly', term_id/results_release_at null).
-- quiz_kind is a brand-new type, so using it (incl. as a default) in this same
-- transaction is safe; the "new value in same tx" rule only affects ALTER TYPE.

begin;

create type quiz_kind as enum ('weekly', 'term_test');

alter table public.quizzes
  add column if not exists kind quiz_kind not null default 'weekly',
  add column if not exists term_id uuid references public.terms(id),
  add column if not exists results_release_at timestamptz;

alter table public.quizzes
  alter column subject_week_id drop not null;

-- At most one term test per subject per term.
create unique index if not exists quizzes_term_test_unique_idx
  on public.quizzes (subject_id, term_id)
  where kind = 'term_test';

-- Shape integrity: weekly rows are week-scoped; term tests are term-scoped.
alter table public.quizzes
  add constraint quizzes_kind_shape check (
    (kind = 'weekly'
      and subject_week_id is not null
      and term_id is null
      and results_release_at is null)
    or
    (kind = 'term_test'
      and subject_week_id is null
      and term_id is not null
      and results_release_at is not null)
  );

create table if not exists public.term_test_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null,
  total integer not null,
  submitted_at timestamptz not null default now(),
  unique (quiz_id, student_id)
);
create index if not exists term_test_attempts_board_idx
  on public.term_test_attempts (quiz_id, score desc);

create table if not exists public.term_test_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.term_test_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_option_id uuid references public.quiz_options(id) on delete cascade,
  unique (attempt_id, question_id)
);

-- RLS: mirror the quiz tables. Admin full access; a student owns only their
-- own attempts/answers. Leaderboard reads of other students happen through
-- server (Drizzle) code, which bypasses RLS, so student-owns-their-rows is
-- the correct row-level rule.
alter table public.term_test_attempts enable row level security;
alter table public.term_test_answers enable row level security;

drop policy if exists term_test_attempts_admin_all on term_test_attempts;
drop policy if exists term_test_attempts_student_own on term_test_attempts;
drop policy if exists term_test_answers_admin_all on term_test_answers;
drop policy if exists term_test_answers_student_own on term_test_answers;

create policy term_test_attempts_admin_all on term_test_attempts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy term_test_attempts_student_own on term_test_attempts
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy term_test_answers_admin_all on term_test_answers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy term_test_answers_student_own on term_test_answers
  for all to authenticated
  using (
    exists (
      select 1 from term_test_attempts a
      where a.id = attempt_id and a.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from term_test_attempts a
      where a.id = attempt_id and a.student_id = auth.uid()
    )
  );

commit;
