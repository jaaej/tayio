-- 0026_quiz_delivery.sql - quiz uniqueness, delivery access, and attachments.
--
-- The curriculum legitimately has Week 1 in multiple terms.
-- A quiz remains unique per concrete subject_weeks row, which already includes
-- subject + term + week. Approved quizzes become visible to tutors who teach
-- that subject and to enrolled students through the application layer.
-- Student answer keys remain inaccessible through RLS: students can select the
-- approved quiz row and its attachments, but not quiz_questions/quiz_options.
--
-- Helper-name verification:
--   public.is_admin()          <- migration 0004
--   public.teaches_subject()   <- migration 0024
--   public.can_see_subject()   <- migration 0024
--   public.handle_audit_log()  <- migration 0006
--
-- Reversible by:
--   DROP TABLE public.quiz_attachments;
--   DROP INDEX public.quizzes_subject_week_unique_idx;
--   CREATE INDEX quizzes_subject_week_idx ON public.quizzes(subject_week_id);
--   Restore the tutor-only policies from migration 0025.

begin;

drop index if exists public.quizzes_subject_week_idx;
create unique index if not exists quizzes_subject_week_unique_idx
  on public.quizzes(subject_week_id);

create table if not exists public.quiz_attachments (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attachments_quiz_idx
  on public.quiz_attachments(quiz_id);

alter table public.quiz_attachments enable row level security;

drop policy if exists quizzes_tutor_approved_subject on public.quizzes;
drop policy if exists quizzes_student_approved_subject on public.quizzes;
drop policy if exists quiz_questions_tutor_approved_subject on public.quiz_questions;
drop policy if exists quiz_options_tutor_approved_subject on public.quiz_options;
drop policy if exists quiz_attachments_admin_all on public.quiz_attachments;
drop policy if exists quiz_attachments_tutor_assigned on public.quiz_attachments;
drop policy if exists quiz_attachments_tutor_approved_subject on public.quiz_attachments;
drop policy if exists quiz_attachments_student_approved_subject on public.quiz_attachments;

-- Existing assigned-tutor write policies from 0025 remain in force.
-- These additive SELECT policies let tutors inspect any approved common quiz
-- for a subject they teach, including answer keys.
create policy quizzes_tutor_approved_subject on public.quizzes
  for select to authenticated
  using (
    status = 'approved'
    and public.teaches_subject(auth.uid(), subject_id)
  );

create policy quiz_questions_tutor_approved_subject on public.quiz_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.quizzes q
      where q.id = quiz_id
        and q.status = 'approved'
        and public.teaches_subject(auth.uid(), q.subject_id)
    )
  );

create policy quiz_options_tutor_approved_subject on public.quiz_options
  for select to authenticated
  using (
    exists (
      select 1
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = question_id
        and q.status = 'approved'
        and public.teaches_subject(auth.uid(), q.subject_id)
    )
  );

-- Students may discover an approved quiz row for an enrolled subject.
-- No student SELECT policy is added to quiz_questions or quiz_options because
-- quiz_options contains is_correct. Student delivery goes through a dedicated
-- server query that omits that answer-key column.
create policy quizzes_student_approved_subject on public.quizzes
  for select to authenticated
  using (
    status = 'approved'
    and public.can_see_subject(auth.uid(), subject_id)
  );

create policy quiz_attachments_admin_all on public.quiz_attachments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy quiz_attachments_tutor_assigned on public.quiz_attachments
  for all to authenticated
  using (
    exists (
      select 1
      from public.quizzes q
      where q.id = quiz_id
        and q.assigned_tutor_id = auth.uid()
        and q.status in ('requested', 'changes_requested')
    )
  )
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1
      from public.quizzes q
      where q.id = quiz_id
        and q.assigned_tutor_id = auth.uid()
        and q.status in ('requested', 'changes_requested')
    )
  );

create policy quiz_attachments_tutor_approved_subject on public.quiz_attachments
  for select to authenticated
  using (
    exists (
      select 1
      from public.quizzes q
      where q.id = quiz_id
        and q.status = 'approved'
        and public.teaches_subject(auth.uid(), q.subject_id)
    )
  );

create policy quiz_attachments_student_approved_subject on public.quiz_attachments
  for select to authenticated
  using (
    exists (
      select 1
      from public.quizzes q
      where q.id = quiz_id
        and q.status = 'approved'
        and public.can_see_subject(auth.uid(), q.subject_id)
    )
  );

drop trigger if exists quiz_attachments_audit on public.quiz_attachments;
create trigger quiz_attachments_audit
  after insert or update or delete on public.quiz_attachments
  for each row execute function public.handle_audit_log();

commit;
