# Make-up lesson isolation and history

## Outcome

Per-student make-up lessons are now treated as private lesson bookings instead
of ordinary sessions for every student enrolled in the recurring class. Only a
student with an attendance row for that exact make-up lesson can see it or be
managed on its roll.

## Behaviour changes

- Student, parent, admin, resource, timetable, and free-trial lesson queries
  apply the same exact-attendee rule for `makeup` lessons.
- Tutor and admin lesson pages no longer load the full recurring-class roster
  for a one-student make-up lesson.
- Credit-booked and older rescheduled make-ups remain editable even after the
  attendance status changes from `makeup_attended`.
- Admin and self-serve reschedules now write the new lesson, both attendance
  records, approved reschedule history, and notifications in one transaction.
- Tutor/date and student/original-lesson advisory locks prevent simultaneous
  requests from creating two live bookings for the same move or slot.
- Submitted admin slots are revalidated against current server-generated tutor
  availability, and cancelled/rescheduled lessons no longer occupy a slot.
- Reschedule notices go to the student, linked parents, relevant tutors, and all
  active admins, with links appropriate to each role.
- Covered lessons are now considered in the replacement tutor's next-lesson
  query rather than remaining tied to the recurring class tutor.

## Data repair

`0051_makeup_reschedule_history_backfill.sql` creates approved history for older
`makeup` lessons that have `rescheduled_from` and an exact attendance row but no
matching request. Credit-created make-ups are intentionally excluded because
their source of truth is `class_credits`.

The migration was applied only to the isolated test Supabase project. It
backfilled all five existing rescheduled make-up lessons; none remain without
approved history. Production still requires manual QA and an explicit migration
step.

## Manual QA

1. Move a student from an upcoming lesson into a server-offered slot.
2. Confirm the original roll labels the student as moved out and the make-up
   roll contains only that student.
3. Edit make-up attendance and a full tutor note, then confirm admin sees both.
4. Sign in as another student from the recurring class and as their parent;
   confirm the private make-up slot is absent from their schedules.
5. Confirm student, parent, original tutor, replacement tutor (when different),
   and active admins receive one reschedule notice with a working link.
6. Change the destination and confirm only the newest make-up remains live while
   the old history is retained as cancelled.
