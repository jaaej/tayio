-- 0012 — RLS for previously-uncovered tables
--
-- These 8 tables shipped without any committed RLS and relied only on
-- server-side Drizzle (which bypasses RLS): terms, subject_weeks,
-- student_week_progress, discussion_threads, discussion_replies,
-- dm_threads, dm_messages, dm_reads. This adds defense-in-depth and —
-- most importantly — locks private 1:1 DMs to their participants (+ admins
-- for safeguarding oversight, per the Victorian Reportable Conduct duty to
-- investigate reported conduct; admin DM-access logging is a follow-up).
--
-- Follows the 0004 pattern: enable RLS + create policies, no explicit
-- grant/revoke (RLS with policies is the gate; anon has no policy → denied).

begin;

-- Helper: is the current user a participant in this DM thread?
-- SECURITY DEFINER + pinned search_path; returns bool only (no data leak),
-- and bypasses RLS on dm_threads to avoid policy recursion.
create or replace function public.is_dm_participant(p_thread_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.dm_threads t
    where t.id = p_thread_id
      and (t.user_a_id = auth.uid() or t.user_b_id = auth.uid())
  );
$$;

-- --- Curriculum metadata: read all authenticated, write admin (mirrors subjects) ---

alter table public.terms enable row level security;
drop policy if exists terms_select_authenticated on public.terms;
drop policy if exists terms_admin_all on public.terms;
create policy terms_select_authenticated on public.terms
  for select to authenticated using (true);
create policy terms_admin_all on public.terms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.subject_weeks enable row level security;
drop policy if exists subject_weeks_select_authenticated on public.subject_weeks;
drop policy if exists subject_weeks_admin_all on public.subject_weeks;
create policy subject_weeks_select_authenticated on public.subject_weeks
  for select to authenticated using (true);
create policy subject_weeks_admin_all on public.subject_weeks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --- Per-student progress: own student / parent of that student / admin ---

alter table public.student_week_progress enable row level security;
drop policy if exists student_week_progress_student on public.student_week_progress;
drop policy if exists student_week_progress_parent_read on public.student_week_progress;
drop policy if exists student_week_progress_admin_all on public.student_week_progress;
create policy student_week_progress_student on public.student_week_progress
  for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy student_week_progress_parent_read on public.student_week_progress
  for select to authenticated using (public.is_parent_of(student_id));
create policy student_week_progress_admin_all on public.student_week_progress
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --- Discussions: read all authenticated; author writes own; admin moderates ---

alter table public.discussion_threads enable row level security;
drop policy if exists discussion_threads_select_authenticated on public.discussion_threads;
drop policy if exists discussion_threads_author_insert on public.discussion_threads;
drop policy if exists discussion_threads_author_update on public.discussion_threads;
drop policy if exists discussion_threads_admin_all on public.discussion_threads;
create policy discussion_threads_select_authenticated on public.discussion_threads
  for select to authenticated using (true);
create policy discussion_threads_author_insert on public.discussion_threads
  for insert to authenticated with check (author_id = auth.uid());
create policy discussion_threads_author_update on public.discussion_threads
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy discussion_threads_admin_all on public.discussion_threads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.discussion_replies enable row level security;
drop policy if exists discussion_replies_select_authenticated on public.discussion_replies;
drop policy if exists discussion_replies_author_insert on public.discussion_replies;
drop policy if exists discussion_replies_author_update on public.discussion_replies;
drop policy if exists discussion_replies_admin_all on public.discussion_replies;
create policy discussion_replies_select_authenticated on public.discussion_replies
  for select to authenticated using (true);
create policy discussion_replies_author_insert on public.discussion_replies
  for insert to authenticated with check (author_id = auth.uid());
create policy discussion_replies_author_update on public.discussion_replies
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy discussion_replies_admin_all on public.discussion_replies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --- Private DMs: participants (read/write) + admin (read, safeguarding) ---

alter table public.dm_threads enable row level security;
drop policy if exists dm_threads_participant on public.dm_threads;
drop policy if exists dm_threads_admin_read on public.dm_threads;
create policy dm_threads_participant on public.dm_threads
  for all to authenticated
  using (user_a_id = auth.uid() or user_b_id = auth.uid())
  with check (user_a_id = auth.uid() or user_b_id = auth.uid());
create policy dm_threads_admin_read on public.dm_threads
  for select to authenticated using (public.is_admin());

alter table public.dm_messages enable row level security;
drop policy if exists dm_messages_participant_read on public.dm_messages;
drop policy if exists dm_messages_sender_insert on public.dm_messages;
drop policy if exists dm_messages_admin_read on public.dm_messages;
create policy dm_messages_participant_read on public.dm_messages
  for select to authenticated using (public.is_dm_participant(thread_id));
create policy dm_messages_sender_insert on public.dm_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_dm_participant(thread_id));
create policy dm_messages_admin_read on public.dm_messages
  for select to authenticated using (public.is_admin());

alter table public.dm_reads enable row level security;
drop policy if exists dm_reads_own on public.dm_reads;
create policy dm_reads_own on public.dm_reads
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
