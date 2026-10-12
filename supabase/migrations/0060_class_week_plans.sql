-- 0060_class_week_plans.sql
-- Tutor redesign (October 2026): the per-class "lesson plan" text
-- (classes.lesson_plan) and the per-tutor week notes (tutor_week_sections)
-- become ONE per-class, per-week field, "For students this week".
--
-- The week-note tables are evolved in place rather than replaced, so every
-- attachment keeps its id and resources.source_attachment_id ("Add to
-- library") keeps pointing at the same row:
--   tutor_week_sections    -> class_week_plans            (keyed class + week)
--   tutor_week_attachments -> class_week_plan_attachments (section_id -> plan_id)
--
-- A tutor note used to be shared by every class that tutor teaches in the
-- subject. It is copied to each of those classes (attachments too, sharing the
-- same storage object; the app only deletes a storage object when no other
-- attachment row still references it).
--
-- Data safety: the migration REFUSES to run (raises) rather than drop content
-- it cannot place:
--   * a classes.lesson_plan with text (it has no week to land in), or
--   * a week note with text or attachments whose tutor no longer teaches a
--     class in that subject.
-- Empty orphan notes are deleted. Production had no rows of either kind on
-- 12 Oct 2026.
--
-- Not reversible without data loss once per-class plans diverge. To roll back
-- before any edits, rename the tables/columns back, re-add tutor_id from
-- classes.tutor_id, keep one row per (tutor, week), and restore 0010/0011.

begin;

-- 1. Refuse to drop content -------------------------------------------------

do $$
begin
  if exists (
    select 1 from public.classes where coalesce(btrim(lesson_plan), '') <> ''
  ) then
    raise exception
      'classes.lesson_plan has text. Move it into a week plan before applying 0060.';
  end if;

  if exists (
    select 1
    from public.tutor_week_sections s
    join public.subject_weeks w on w.id = s.subject_week_id
    where not exists (
      select 1 from public.classes c
      where c.tutor_id = s.tutor_id and c.subject_id = w.subject_id
    )
    and (
      coalesce(btrim(s.note), '') <> ''
      or exists (
        select 1 from public.tutor_week_attachments a where a.section_id = s.id
      )
    )
  ) then
    raise exception
      'A tutor week note has content but its tutor no longer teaches that subject. Reassign or clear it before applying 0060.';
  end if;
end $$;

delete from public.tutor_week_sections s
using public.subject_weeks w
where w.id = s.subject_week_id
  and not exists (
    select 1 from public.classes c
    where c.tutor_id = s.tutor_id and c.subject_id = w.subject_id
  );

-- 2. Old policies and helpers go before the columns they read ---------------

drop policy if exists tutor_week_sections_select_authenticated on public.tutor_week_sections;
drop policy if exists tutor_week_sections_select_scoped on public.tutor_week_sections;
drop policy if exists tutor_week_sections_tutor_all on public.tutor_week_sections;
drop policy if exists tutor_week_sections_admin_all on public.tutor_week_sections;
drop policy if exists tutor_week_attachments_select_authenticated on public.tutor_week_attachments;
drop policy if exists tutor_week_attachments_select_scoped on public.tutor_week_attachments;
drop policy if exists tutor_week_attachments_tutor_all on public.tutor_week_attachments;
drop policy if exists tutor_week_attachments_admin_all on public.tutor_week_attachments;
drop function if exists public.can_read_tutor_section_att(uuid);
drop function if exists public.can_read_tutor_section(uuid, uuid);
drop function if exists public.is_owner_of_tutor_section(uuid);

-- 3. Re-key sections by class -----------------------------------------------

alter table public.tutor_week_sections rename to class_week_plans;
alter table public.class_week_plans rename column note to body;
alter table public.class_week_plans
  add column class_id uuid references public.classes(id) on delete cascade;
-- The (tutor, week) key no longer holds once a note is copied per class.
drop index if exists public.tutor_week_sections_tutor_week_idx;
drop index if exists public.tutor_week_sections_week_idx;

alter table public.tutor_week_attachments rename to class_week_plan_attachments;
alter table public.class_week_plan_attachments rename column section_id to plan_id;

-- Each existing row keeps its id and goes to the tutor's first matching class.
update public.class_week_plans p
set class_id = (
  select c.id
  from public.classes c
  join public.subject_weeks w on w.subject_id = c.subject_id
  where w.id = p.subject_week_id and c.tutor_id = p.tutor_id
  order by c.created_at, c.id
  limit 1
);

-- Copies for the tutor's other classes in the same subject.
create temporary table plan_copies on commit drop as
select
  p.id as source_id,
  gen_random_uuid() as new_id,
  c.id as class_id
from public.class_week_plans p
join public.subject_weeks w on w.id = p.subject_week_id
join public.classes c
  on c.subject_id = w.subject_id and c.tutor_id = p.tutor_id
where c.id <> p.class_id;

insert into public.class_week_plans
  (id, tutor_id, subject_week_id, body, class_id, created_at, updated_at)
select pc.new_id, p.tutor_id, p.subject_week_id, p.body, pc.class_id,
       p.created_at, p.updated_at
from plan_copies pc
join public.class_week_plans p on p.id = pc.source_id;

insert into public.class_week_plan_attachments
  (plan_id, file_name, kind, storage_path, url, content_type, size_bytes, uploaded_at)
select pc.new_id, a.file_name, a.kind, a.storage_path, a.url, a.content_type,
       a.size_bytes, a.uploaded_at
from plan_copies pc
join public.class_week_plan_attachments a on a.plan_id = pc.source_id;

alter table public.class_week_plans drop column tutor_id;
alter table public.class_week_plans alter column class_id set not null;
-- Who last edited it (the class tutor or an admin). Nullable so migrated rows
-- do not have to invent an author.
alter table public.class_week_plans
  add column updated_by uuid references public.profiles(id) on delete set null;

create unique index class_week_plans_class_week_idx
  on public.class_week_plans (class_id, subject_week_id);
create index class_week_plans_week_idx
  on public.class_week_plans (subject_week_id);

alter index if exists public.tutor_week_attachments_section_idx
  rename to class_week_plan_attachments_plan_idx;
alter table public.class_week_plan_attachments
  rename constraint tutor_week_attachments_kind_check
  to class_week_plan_attachments_kind_check;

alter table public.classes drop column lesson_plan;

-- 4. RLS: the class tutor and admins write; enrolled students and their
--    parents read. SECURITY DEFINER helpers with a pinned search_path return
--    booleans only.

create or replace function public.can_read_class_week_plan(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.classes c
      where c.id = p_class_id and c.tutor_id = auth.uid()
    )
    or exists (
      select 1 from public.enrollments e
      where e.class_id = p_class_id and e.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.enrollments e
      join public.family_links fl on fl.student_id = e.student_id
      where e.class_id = p_class_id and fl.parent_id = auth.uid()
    );
$$;

create or replace function public.can_write_class_week_plan(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.classes c
      where c.id = p_class_id and c.tutor_id = auth.uid()
    );
$$;

create or replace function public.class_of_week_plan(p_plan_id uuid)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select class_id from public.class_week_plans where id = p_plan_id;
$$;

alter table public.class_week_plans enable row level security;
alter table public.class_week_plan_attachments enable row level security;

create policy class_week_plans_select on public.class_week_plans
  for select to authenticated
  using (public.can_read_class_week_plan(class_id));
create policy class_week_plans_write on public.class_week_plans
  for all to authenticated
  using (public.can_write_class_week_plan(class_id))
  with check (public.can_write_class_week_plan(class_id));

create policy class_week_plan_attachments_select on public.class_week_plan_attachments
  for select to authenticated
  using (public.can_read_class_week_plan(public.class_of_week_plan(plan_id)));
create policy class_week_plan_attachments_write on public.class_week_plan_attachments
  for all to authenticated
  using (public.can_write_class_week_plan(public.class_of_week_plan(plan_id)))
  with check (public.can_write_class_week_plan(public.class_of_week_plan(plan_id)));

revoke all on public.class_week_plans from anon;
revoke all on public.class_week_plan_attachments from anon;
-- Writes go through server actions on the service connection, as in 0010.
grant select on public.class_week_plans to authenticated;
grant select on public.class_week_plan_attachments to authenticated;

commit;
