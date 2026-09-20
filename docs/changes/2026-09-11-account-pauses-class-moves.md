# Account pauses and permanent class moves

## Account versus schedule status

`profiles.is_active` still controls whether the account can sign in. The new
`profiles.pause_status` is separate and may be `none`, `on_break`, or `paused`.
Admin can change it in the user's Profile form for student and tutor accounts.
Admin Users deliberately displays both pills, for example `Active` and
`On break`, so staff do not mistake a temporary scheduling break for a disabled
account.

## Permanent class move workflow

Students can request a recurring-class change from Timetable. Parents use the
same control from Classes for the currently selected linked child. The target
must be a different class in the same subject and must have capacity. These
rules are repeated on the server; client-side filtering is only a convenience.

Creating a request does not alter enrolments. It inserts a pending
`class_move_requests` audit row and sends every active admin a detailed
`Relocate class time for [student]` notification containing the old and new
weekly slots, requester contact details, reason, and a link to the student's
Lessons tab.

Admin can approve, decline, or make a direct permanent move from that tab.
Approval locks the destination class, checks capacity again, withdraws the old
enrolment, activates/inserts the destination enrolment, and records the decision
in one transaction. The student, linked parents, original tutor, and new tutor
are then notified with a destination appropriate to their role. Direct office
moves use the same transaction and retain an approved history row.

## Database and security

Migration `0045_account_pauses_and_class_moves.sql` adds the pause enum/profile
column plus the class-move enum and table. The request table has RLS enabled
with no browser policies; all access is through role-checked server code. A
partial unique index prevents two pending requests for the same student and
source class.

The migration has been applied to the isolated development Supabase project.
Do not apply it to Production until the manual QA entries in
`checklist_beta_fix.md` pass.
