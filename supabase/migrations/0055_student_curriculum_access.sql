-- 0055_student_curriculum_access.sql
-- Admin exceptions for students who need curriculum from before the term in
-- which they enrolled. Normal access is derived from enrollments.enrolled_at;
-- rows here grant one earlier subject/term without weakening future-week locks.

begin;

create table if not exists public.student_curriculum_term_grants (
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  granted_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (student_id, subject_id, term_id)
);

create index if not exists student_curriculum_term_grants_student_idx
  on public.student_curriculum_term_grants(student_id);

-- Server-only table: learner reads are resolved after the app's role and
-- relationship checks. No browser role receives direct table access.
alter table public.student_curriculum_term_grants enable row level security;
revoke all on public.student_curriculum_term_grants from anon, authenticated;

commit;
