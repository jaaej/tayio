begin;

alter table public.tutor_week_sections enable row level security;
drop policy if exists tutor_week_sections_select_authenticated on public.tutor_week_sections;
drop policy if exists tutor_week_sections_tutor_all on public.tutor_week_sections;
drop policy if exists tutor_week_sections_admin_all on public.tutor_week_sections;

create policy tutor_week_sections_select_authenticated on public.tutor_week_sections
  for select to authenticated using (true);
create policy tutor_week_sections_tutor_all on public.tutor_week_sections
  for all to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());
create policy tutor_week_sections_admin_all on public.tutor_week_sections
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SECURITY DEFINER helper: does the current user own the section this attachment hangs off?
-- Pinned search_path defeats search-path injection; returns bool only (no data leak).
create or replace function public.is_owner_of_tutor_section(p_section_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.tutor_week_sections s
    where s.id = p_section_id and s.tutor_id = auth.uid()
  );
$$;

alter table public.tutor_week_attachments enable row level security;
drop policy if exists tutor_week_attachments_select_authenticated on public.tutor_week_attachments;
drop policy if exists tutor_week_attachments_tutor_all on public.tutor_week_attachments;
drop policy if exists tutor_week_attachments_admin_all on public.tutor_week_attachments;

create policy tutor_week_attachments_select_authenticated on public.tutor_week_attachments
  for select to authenticated using (true);
create policy tutor_week_attachments_tutor_all on public.tutor_week_attachments
  for all to authenticated
  using (public.is_owner_of_tutor_section(section_id))
  with check (public.is_owner_of_tutor_section(section_id));
create policy tutor_week_attachments_admin_all on public.tutor_week_attachments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.tutor_week_sections from anon;
revoke all on public.tutor_week_attachments from anon;
grant select on public.tutor_week_sections to authenticated;
grant select on public.tutor_week_attachments to authenticated;

commit;
