-- 0077: the homework grading lock asks the class-tutor rule from 0070, and
-- Production gets two checks it never had.
--
-- 0007's grading lock calls public.is_tutor_of_homework(), which no migration
-- creates. Dev had a hand-made copy, so it worked there; Production has none,
-- so a signed-in tutor or student updating homework_assignments through the
-- public API failed with "function public.is_tutor_of_homework(uuid) does not
-- exist". The lock now asks tutor_manages_homework_id() (0070), so the tutor
-- who may mark is the class's tutor, the same rule as the RLS policies.
--
-- Dev's hand-made helpers are dropped so dev matches what the migrations
-- build and cannot hide a missing function again. Nothing depends on them.
--
-- Production's tables were created by drizzle before 0016 and 0024 ran, so
-- the check constraints inside their create table statements never reached
-- it. They are added when missing; existing rows on both databases satisfy
-- them (checked 20 October 2026).
--
-- Idempotent. Reversible: restore 0007's function body and drop the two
-- constraints. No data changes.

begin;

create or replace function public.enforce_homework_assignment_grading_lock()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  -- Server-side connections (postgres, service_role) are trusted. INVOKER
  -- keeps current_user as the caller's role; see 0007.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;
  if public.tutor_manages_homework_id(new.homework_id) then
    return new;
  end if;

  -- Anyone else keeps the tutor-only grading fields as they were.
  new.score := old.score;
  new.feedback := old.feedback;
  new.marked_at := old.marked_at;
  new.marked_by := old.marked_by;
  return new;
end;
$$;

drop function if exists public.is_tutor_of_homework(uuid);
drop function if exists public.is_tutor_of_lesson(uuid);
drop function if exists public.is_tutor_of_student(uuid);
drop function if exists public.has_homework_assignment(uuid);
drop function if exists public.is_parent_of_assignee(uuid);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.resources'::regclass and conname = 'resources_kind_payload'
  ) then
    alter table public.resources add constraint resources_kind_payload check (
      (kind = 'file' and storage_path is not null)
      or (kind = 'link' and external_url is not null)
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.discussion_attachments'::regclass
      and conname = 'discussion_attachments_parent_check'
  ) then
    alter table public.discussion_attachments add constraint discussion_attachments_parent_check check (
      (thread_id is not null and reply_id is null)
      or (thread_id is null and reply_id is not null)
    );
  end if;
end;
$$;

commit;
