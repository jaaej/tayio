-- 0084: a make-up student starts unmarked.
--
-- Booking a make-up (a reschedule or a class credit), or an admin adding a
-- student to one lesson, wrote that student's attendance as "Make-up
-- attended" at once, because that mark was how the roll, the timetables and
-- the seat counts found them. A student who didn't come stayed "attended"
-- unless the tutor changed it, a private make-up lesson never asked to be
-- marked, and the attendance rates counted lessons that had not happened.
-- The booking now puts the student on the roll (lessonGuestIdsSql in
-- src/lib/class-roster-sql.ts) and the tutor marks them like anyone else.
--
-- 1. lesson_roll_additions: a student an admin added to one lesson alone,
--    the counterpart of lesson_roll_exclusions. A reschedule or a credit is
--    already its own record.
-- 2. One-off visits written the old way (a "Make-up attended" mark with no
--    class roll place, reschedule or credit behind it) get their row.
-- 3. Marks written at booking on lessons that haven't started are removed:
--    those students start unmarked.
-- 4. The rest become "present". The roll no longer offers "Make-up"; the
--    booking says it was a make-up, and the history pages still read it so.
--
-- RLS on lesson_roll_additions: enabled with no client policies; only the
-- server's connection uses it. Steps 3 and 4 change existing marks; before
-- this migration, Production had no "Make-up attended" marks at all.

create table if not exists public.lesson_roll_additions (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);
create index if not exists lesson_roll_additions_student_idx
  on public.lesson_roll_additions (student_id);

alter table public.lesson_roll_additions enable row level security;

insert into public.lesson_roll_additions (lesson_id, student_id, added_by, created_at)
select a.lesson_id, a.student_id, a.marked_by, a.marked_at
from public.attendance a
join public.lessons l on l.id = a.lesson_id
where a.status = 'makeup_attended'
  and not exists (
    select 1 from public.reschedule_requests r
    where r.target_lesson_id = a.lesson_id and r.student_id = a.student_id and r.status = 'approved'
  )
  and not exists (
    select 1 from public.class_credits c
    where c.redeemed_on_lesson_id = a.lesson_id and c.student_id = a.student_id
  )
  and not (
    l.status <> 'makeup' and exists (
      select 1 from public.enrollments e
      where e.class_id = l.class_id
        and e.student_id = a.student_id
        and (e.enrolled_at at time zone 'Australia/Melbourne')::date <= l.date
        and (case when e.ends_on is not null then l.date < e.ends_on else e.withdrawn_at is null end)
    )
  )
on conflict do nothing;

delete from public.attendance a
using public.lessons l
where l.id = a.lesson_id
  and a.status = 'makeup_attended'
  and ((l.date + l.start_time) at time zone 'Australia/Melbourne') > now();

update public.attendance set status = 'present' where status = 'makeup_attended';
