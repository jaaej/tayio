-- 0056_admin_homework_and_solutions.sql
-- Distinguish the person who created a homework task from the tutor who owns
-- its marking workflow, and store a separate solution file. Existing homework
-- was tutor-authored, so its tutor is the correct creator backfill.
--
-- Solutions stay in the existing private homework-attachments bucket. Portal
-- code signs them only for authorised staff and for assigned students after
-- the homework due date.
--
-- Reversible by:
--   ALTER TABLE public.homework DROP COLUMN solution_url;
--   ALTER TABLE public.homework DROP COLUMN created_by_id;

begin;

alter table public.homework
  add column if not exists created_by_id uuid references public.profiles(id),
  add column if not exists solution_url text;

update public.homework
set created_by_id = tutor_id
where created_by_id is null;

alter table public.homework
  alter column created_by_id set not null;

commit;
