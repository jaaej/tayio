-- 0053_profile_admin_notes.sql - account-level internal notes for the admin
-- user directory. These notes are never exposed to student/parent/tutor
-- portals and follow the profiles table's existing admin access policies.
--
-- Existing per-enrolment notes are retained. For continuity, a student's
-- current class notes are copied into the new account-level note once.
--
-- Reversible by:
--   ALTER TABLE public.profiles DROP COLUMN admin_notes;

begin;

alter table public.profiles
  add column if not exists admin_notes text;

with existing_notes as (
  select
    e.student_id,
    string_agg(
      c.name || ': ' || btrim(e.admin_notes),
      E'\n'
      order by c.name
    ) as note
  from public.enrollments e
  inner join public.classes c on c.id = e.class_id
  where e.withdrawn_at is null
    and nullif(btrim(e.admin_notes), '') is not null
  group by e.student_id
)
update public.profiles p
set admin_notes = existing_notes.note
from existing_notes
where p.id = existing_notes.student_id
  and nullif(btrim(p.admin_notes), '') is null;

commit;
