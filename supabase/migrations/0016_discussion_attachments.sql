-- 0016 — discussion attachments (files uploaded on a thread question or a reply)
--
-- Polymorphic parent: each row belongs to EITHER a thread or a reply (never
-- both, never neither) enforced by a check constraint. Files live in the
-- private `discussion-attachments` storage bucket; rows here hold the metadata.
-- Follows the 0012 discussion RLS pattern (read all authenticated, author
-- writes own, admin moderates) for defense-in-depth — the app reads via
-- Drizzle (bypasses RLS) after an app-level canSeeBoard check.
--
-- Reversible by: drop table public.discussion_attachments;

begin;

create table if not exists public.discussion_attachments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.discussion_threads(id) on delete cascade,
  reply_id uuid references public.discussion_replies(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  constraint discussion_attachments_parent_check check (
    (thread_id is not null and reply_id is null) or
    (thread_id is null and reply_id is not null)
  )
);

create index if not exists discussion_attachments_thread_idx
  on public.discussion_attachments(thread_id);
create index if not exists discussion_attachments_reply_idx
  on public.discussion_attachments(reply_id);

alter table public.discussion_attachments enable row level security;
drop policy if exists discussion_attachments_select_authenticated on public.discussion_attachments;
drop policy if exists discussion_attachments_author_insert on public.discussion_attachments;
drop policy if exists discussion_attachments_admin_all on public.discussion_attachments;
create policy discussion_attachments_select_authenticated on public.discussion_attachments
  for select to authenticated using (true);
create policy discussion_attachments_author_insert on public.discussion_attachments
  for insert to authenticated with check (author_id = auth.uid());
create policy discussion_attachments_admin_all on public.discussion_attachments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

commit;
