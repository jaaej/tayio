-- 0070: a tutor's access to homework follows the class they teach now.
--
-- Homework copies the class's tutor into `homework.tutor_id` when it is set,
-- and changing a class's tutor never moved that copy, so the old tutor kept
-- the class's homework and marking and the new one got nothing. The app now
-- scopes tutor access through `classes.tutor_id` (src/app/tutor/_lib/
-- homework-access.ts); these policies give the public API the same rule.
-- Homework set outside a class (no class_id) stays with `homework.tutor_id`.
--
-- Also fixes a loop that made both tables unreadable through the public API
-- for every signed-in user who is not an admin ("infinite recursion detected
-- in policy for relation homework"): homework's student and parent policies
-- read homework_assignments, whose tutor policy read homework again. The
-- assignment policy now asks a SECURITY DEFINER helper, which reads homework
-- without re-entering its policies.
--
-- Reversible: recreate the two policies from 0004 (tutor_id = auth.uid()) and
-- drop the two functions. No data changes.

begin;

create or replace function public.tutor_manages_homework(p_class uuid, p_tutor uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    case
      when p_class is null then p_tutor = auth.uid()
      else exists (
        select 1 from public.classes c
        where c.id = p_class and c.tutor_id = auth.uid()
      )
    end,
    false
  );
$$;

revoke all on function public.tutor_manages_homework(uuid, uuid) from public;
grant execute on function public.tutor_manages_homework(uuid, uuid) to authenticated;

create or replace function public.tutor_manages_homework_id(p_homework uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select public.tutor_manages_homework(h.class_id, h.tutor_id)
      from public.homework h
      where h.id = p_homework
    ),
    false
  );
$$;

revoke all on function public.tutor_manages_homework_id(uuid) from public;
grant execute on function public.tutor_manages_homework_id(uuid) to authenticated;

drop policy if exists homework_tutor_all on public.homework;
create policy homework_tutor_all on public.homework
  for all to authenticated
  using (public.tutor_manages_homework(class_id, tutor_id))
  with check (public.tutor_manages_homework(class_id, tutor_id));

drop policy if exists homework_assignments_tutor_all on public.homework_assignments;
create policy homework_assignments_tutor_all on public.homework_assignments
  for all to authenticated
  using (public.tutor_manages_homework_id(homework_id))
  with check (public.tutor_manages_homework_id(homework_id));

commit;
