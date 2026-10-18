-- 0065: drop per-student delivery, class-card notes and online links; keep
-- attendance notes from students and parents.
--
-- Owner decision, 18 October 2026:
-- - Per-student delivery (enrollments.delivery_mode) only drew a pill on the
--   tutor's roll. Removed with its enum.
-- - The class-card private note (enrollments.admin_notes) duplicated the
--   account's internal note (profiles.admin_notes, migration 0053). Any text
--   still on an enrolment is appended to the student's account note first,
--   unless that note already holds it, so nothing written is lost.
-- - Online links (classes.online_link, lessons.online_link) were never shown
--   to anyone. An online class is a class whose room is "Online".
-- - Attendance notes are for staff. The app reads them only for tutors and
--   admins (through the server's own connection); this also stops a signed-in
--   student or parent reading the note column through the public API, where
--   their attendance read policies would otherwise allow it.
--
-- Apply after the code that no longer reads these columns is deployed: the
-- previous build selects them and would fail against this schema.
--
-- Not reversible for the dropped data. Production held none of it when this
-- was written (0 delivery modes, 0 enrolment notes, 0 class or lesson links).

begin;

with carried as (
  select
    e.student_id,
    string_agg(c.name || ': ' || btrim(e.admin_notes), E'\n' order by c.name) as note
  from public.enrollments e
  inner join public.classes c on c.id = e.class_id
  inner join public.profiles p on p.id = e.student_id
  where nullif(btrim(e.admin_notes), '') is not null
    and strpos(coalesce(p.admin_notes, ''), btrim(e.admin_notes)) = 0
  group by e.student_id
)
update public.profiles p
set admin_notes = case
  when nullif(btrim(p.admin_notes), '') is null then carried.note
  else p.admin_notes || E'\n' || carried.note
end
from carried
where carried.student_id = p.id;

alter table public.enrollments drop column if exists delivery_mode;
alter table public.enrollments drop column if exists admin_notes;
drop type if exists public.delivery_mode;

alter table public.classes drop column if exists online_link;
alter table public.lessons drop column if exists online_link;

-- Column-level read access: every attendance column except note.
revoke select on public.attendance from anon, authenticated;
grant select (lesson_id, student_id, status, marked_at, marked_by)
  on public.attendance to authenticated;

commit;
