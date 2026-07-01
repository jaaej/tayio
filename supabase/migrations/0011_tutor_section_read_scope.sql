begin;

-- Who may READ a tutor's section for a given (tutor, subject-week)?
-- The tutor themselves, an admin, a student enrolled with that tutor for that
-- subject, or a parent of such a student. SECURITY DEFINER + pinned search_path;
-- returns bool only.
create or replace function public.can_read_tutor_section(p_tutor_id uuid, p_subject_week_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select
    p_tutor_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.subject_weeks sw
      join public.classes c on c.subject_id = sw.subject_id and c.tutor_id = p_tutor_id
      join public.enrollments e on e.class_id = c.id
      where sw.id = p_subject_week_id and e.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.subject_weeks sw
      join public.classes c on c.subject_id = sw.subject_id and c.tutor_id = p_tutor_id
      join public.enrollments e on e.class_id = c.id
      join public.family_links fl on fl.student_id = e.student_id
      where sw.id = p_subject_week_id and fl.parent_id = auth.uid()
    );
$$;

create or replace function public.can_read_tutor_section_att(p_section_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.tutor_week_sections s
    where s.id = p_section_id
      and public.can_read_tutor_section(s.tutor_id, s.subject_week_id)
  );
$$;

drop policy if exists tutor_week_sections_select_authenticated on public.tutor_week_sections;
create policy tutor_week_sections_select_scoped on public.tutor_week_sections
  for select to authenticated
  using (public.can_read_tutor_section(tutor_id, subject_week_id));

drop policy if exists tutor_week_attachments_select_authenticated on public.tutor_week_attachments;
create policy tutor_week_attachments_select_scoped on public.tutor_week_attachments
  for select to authenticated
  using (public.can_read_tutor_section_att(section_id));

commit;
