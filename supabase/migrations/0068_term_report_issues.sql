-- 0068: which term reports have been issued to families.
--
-- Term reports were issued one student at a time with nothing recording that
-- it happened, so the office could not see who still needed theirs
-- (18 October 2026 consistency audit). One row per student and term: when it
-- was last issued, by whom, and how many people were notified. Reports > Term
-- reports reads it for its sent / not sent column; the student profile's Term
-- reports tab shows the same.
--
-- New table only. Admin-only through the API (the app writes it through its
-- own server connection after its role checks).
--
-- Reversible: drop table public.term_report_issues.

begin;

create table if not exists public.term_report_issues (
  student_id uuid not null references public.profiles(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  issued_by_id uuid references public.profiles(id) on delete set null,
  issued_at timestamptz not null default now(),
  recipient_count integer not null check (recipient_count > 0),
  primary key (student_id, term_id)
);

create index if not exists term_report_issues_term_idx
  on public.term_report_issues(term_id);

alter table public.term_report_issues enable row level security;

drop policy if exists term_report_issues_admin_all on public.term_report_issues;
create policy term_report_issues_admin_all on public.term_report_issues
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
