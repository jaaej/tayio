-- 0025_quizzes.sql - quiz maker (creation side).
--
-- Adds two new enums and three tables: quizzes, quiz_questions, quiz_options.
-- RLS mirrors 0024_resources.sql / 0010_tutor_week_sections_rls.sql.
-- App-layer guards are the primary control; RLS is defense-in-depth.
--
-- Helper-name verification (grep supabase/migrations/ before writing):
--   Admin check: public.is_admin()   <- migration 0004, called as public.is_admin()
--   (no other helper needed - tutor scoping below is a plain column/EXISTS check)
--
-- Reversible by:
--   DROP TABLE quiz_options;
--   DROP TABLE quiz_questions;
--   DROP TABLE quizzes;
--   DROP TYPE quiz_question_type;
--   DROP TYPE quiz_status;

begin;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type quiz_status as enum (
  'draft', 'requested', 'pending_review', 'changes_requested', 'approved'
);

create type quiz_question_type as enum ('multiple_choice', 'true_false');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  subject_week_id uuid not null references subject_weeks(id) on delete cascade,
  title text not null,
  status quiz_status not null default 'draft',
  created_by uuid not null references profiles(id),
  assigned_tutor_id uuid references profiles(id),
  note text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quizzes_subject_week_idx on quizzes(subject_week_id);
create index quizzes_assigned_tutor_idx on quizzes(assigned_tutor_id);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  prompt text not null,
  type quiz_question_type not null,
  position integer not null,
  created_at timestamptz not null default now()
);
create index quiz_questions_quiz_idx on quiz_questions(quiz_id);

create table quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references quiz_questions(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position integer not null
);
create index quiz_options_question_idx on quiz_options(question_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_options enable row level security;

drop policy if exists quizzes_admin_all on quizzes;
drop policy if exists quiz_questions_admin_all on quiz_questions;
drop policy if exists quiz_options_admin_all on quiz_options;
drop policy if exists quizzes_tutor_assigned on quizzes;
drop policy if exists quiz_questions_tutor_assigned on quiz_questions;
drop policy if exists quiz_options_tutor_assigned on quiz_options;

-- Admin: full access on all three.
create policy quizzes_admin_all on quizzes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy quiz_questions_admin_all on quiz_questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy quiz_options_admin_all on quiz_options
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Tutor: read/write only quizzes assigned to them (and those quizzes'
-- questions/options, via EXISTS joins back to quizzes.assigned_tutor_id).
create policy quizzes_tutor_assigned on quizzes
  for all to authenticated
  using (assigned_tutor_id = auth.uid())
  with check (assigned_tutor_id = auth.uid());

create policy quiz_questions_tutor_assigned on quiz_questions
  for all to authenticated
  using (
    exists (
      select 1 from quizzes q
      where q.id = quiz_id and q.assigned_tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from quizzes q
      where q.id = quiz_id and q.assigned_tutor_id = auth.uid()
    )
  );

create policy quiz_options_tutor_assigned on quiz_options
  for all to authenticated
  using (
    exists (
      select 1 from quiz_questions qq
      join quizzes q on q.id = qq.quiz_id
      where qq.id = question_id and q.assigned_tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from quiz_questions qq
      join quizzes q on q.id = qq.quiz_id
      where qq.id = question_id and q.assigned_tutor_id = auth.uid()
    )
  );

commit;
