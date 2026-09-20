-- Restore durable reschedule history for older one-student make-up lessons.
--
-- Earlier admin/self-serve code created the lesson + attendance but could omit
-- reschedule_requests. Credit-booked make-ups have no rescheduled_from value and
-- are intentionally excluded because class_credits is their source of truth.

begin;

insert into public.reschedule_requests (
  original_lesson_id,
  student_id,
  requested_by_id,
  reason,
  status,
  target_tutor_id,
  target_date,
  target_start_time,
  target_end_time,
  target_lesson_id,
  decided_by_id,
  decided_at,
  created_at
)
select
  makeup.rescheduled_from,
  attendee.student_id,
  coalesce(attendee.marked_by, attendee.student_id),
  nullif(trim(attendee.note), ''),
  'approved'::public.reschedule_status,
  makeup.tutor_id,
  makeup.date,
  makeup.start_time,
  makeup.end_time,
  makeup.id,
  coalesce(attendee.marked_by, attendee.student_id),
  coalesce(attendee.marked_at, makeup.created_at),
  makeup.created_at
from public.lessons makeup
join public.lessons original
  on original.id = makeup.rescheduled_from
join public.attendance attendee
  on attendee.lesson_id = makeup.id
where makeup.status = 'makeup'
  and makeup.rescheduled_from is not null
  and not exists (
    select 1
    from public.reschedule_requests existing
    where existing.target_lesson_id = makeup.id
      and existing.student_id = attendee.student_id
  );

commit;
