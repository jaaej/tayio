begin;

alter table public.subject_topics enable row level security;

drop policy if exists subject_topics_select_authenticated on public.subject_topics;
drop policy if exists subject_topics_admin_all on public.subject_topics;

create policy subject_topics_select_authenticated on public.subject_topics
  for select to authenticated using (true);

create policy subject_topics_admin_all on public.subject_topics
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.subject_topics from anon;
grant select on public.subject_topics to authenticated;

commit;
