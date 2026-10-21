-- 0081: the tutor's part of a term report.
--
-- The term report PDF (src/lib/student-report.ts) was built only from data:
-- attendance, quiz and test grades, and every parent-visible lesson comment.
-- At the end of each term each tutor now writes, per student and subject,
-- what the student did well, what to work on, and their goals for next term;
-- an admin reviews it and sends the report
-- (src/app/_actions/term-report-entries.ts, Reports > Term reports). The
-- report's 1 to 6 ratings are worked out by the system from test and major
-- quiz scores (src/lib/attainment-bands.ts), not entered here.
-- One row per student, term and subject. A tutor may change it until the
-- report has gone to the family (term_report_issues); an admin at any time.
--
-- RLS: enabled with no client policies; only the server's connection reads
-- and writes it, after its own role checks. Additive.
-- Reversible: drop table public.term_report_entries.

create table if not exists public.term_report_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  strengths text not null,
  to_work_on text not null,
  goals text not null,
  written_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint term_report_entries_unique unique (student_id, term_id, subject_id),
  constraint term_report_entries_text_check check (
    char_length(btrim(strengths)) between 1 and 1500
    and char_length(btrim(to_work_on)) between 1 and 1500
    and char_length(btrim(goals)) between 1 and 1500
  )
);
create index if not exists term_report_entries_term_idx on public.term_report_entries (term_id);

alter table public.term_report_entries enable row level security;
