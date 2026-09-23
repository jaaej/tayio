# Beta Fix Checklist

Last updated: 23 September 2026

## Status key

- `[x]` — implemented in the current codebase
- `[ ]` — not fully implemented
- **Partial** — some supporting behaviour exists, but the full requirement is
  still open
- Every implemented feature still requires a separate manual QA check by the
  owner before deployment. Automated checks do not close manual QA items.

## Manual QA required

- [x] Tutor can open the `Weekly availability` slide-over and add and remove
  recurring weekly availability.
- [x] Tutor can open the `Absence or leave request` slide-over and submit a
  single-class absence, including the 48-hour cutoff.
- [x] Confirm the schedule page has no separate `Change one date` workflow and
  the monthly timetable appears immediately beneath the page header/actions.
- [x] Tutor can apply for extended leave and admin can approve or reject it.
- [x] Another tutor can claim and release an eligible cover shift.
- [x] Admin receives the expected leave, cover, 48-hour, 24-hour, and daily
  uncovered notifications.
- [x] Urgent admin notifications are visible in the inbox, filter, and header
  badge.
- [x] Tutor schedule and availability pages are clear on desktop and mobile.
- [x] Compare production loading times before and after the performance changes.
- [x] Opening `/` while signed out goes directly to `/login` without showing the
  old marketing page.
- [x] Both student access types open the dashboard without a `Your quests`
  section, while subjects and the weekly calendar still display correctly.
- [x] Student Homework no longer shows the `Open` or `Due this week` summary
  blocks; the homework filters, list, and `Marked this term` summary still work.
- [x] `Taiyo Blitz` is the displayed name in desktop navigation, mobile
  navigation, and the game page, and every entry link still opens the game.
- [x] Start a Taiyo Blitz round and confirm the visible `Back to levels` button returns to
  the level picker during the countdown, active round, and results screen
  without opening another tab. Confirm the labelled `Back to levels` control
  stays prominent in the top-left of the game card on desktop and mobile.
- [x] Check both student timetable types with classes that have and do not have
  a room/location; locations should be clear and missing values should not
  leave empty labels.
- [x] As a Student – parental access account, click lesson chips in the month
  timetable and confirm each opens its subject/curriculum page. Confirm an
  unrestricted student's lesson chip still opens its reschedule/cancel menu.
- [x] Admin user creation, editing, directory, user details, and messages show
  `Student` and `Student – parental access` without exposing internal role
  values; permissions for both roles remain unchanged.
- [x] In an admin parent or student profile, click the linked family member's
  name and `View profile` link and confirm both open the correct user record.
- [x] In Create user, confirm Phone appears above Role, the generic `Optional`
  heading is gone, and account creation still works with and without a phone or
  manually entered temporary password.
- [x] With unread tutor/student/parent notifications, confirm the red `New
  notifications` control shows the correct count, opens the unread filter,
  caps the display at `99+`, and disappears after all notifications are read.
- [x] Open unread notifications from Today, This week, and Earlier. Confirm
  every row is clickable; linked items open their destination, older items
  without a link expand in place, the unread count decreases by one, and the
  blue unread dot disappears immediately.
- [x] Leave a notification inbox open across a minute boundary and confirm its
  timestamp advances from `5m ago` to `6m ago` without refreshing. Confirm the
  label changes to `1h ago` at 60 minutes and then advances hourly.
- [x] Open Messages as admin, tutor, parent, and student. Confirm thread dates
  render without the `lastActivityAt.toLocaleDateString` runtime error.
- [x] From the admin users list, confirm the gear menu exposes password reset
  and deactivate/reactivate, each confirmation and action works, and `Open`
  remains directly available.
- [x] In admin attendance, confirm `Free trial` appears only when the lesson date
  falls within the student's trial dates, including for a make-up attendee.
- [x] In tutor attendance, confirm a saved free-trial note appears with the
  `Free trial` badge during the configured dates for both a regular enrolment
  and a make-up attendee, and is hidden outside those dates.
- [x] In Admin Users, confirm a trial student shows only the appropriate `Trial
  scheduled`, `Free trial`, or `Trial ended` status badge. Confirm the exact
  trial date range appears as an information note beneath the student's name,
  not in the Status column.
- [x] Confirm linked parents/children appear beneath the correct account in the
  admin users list and each name opens the correct profile on desktop and mobile.
- [x] In the admin users list, confirm current student/tutor badges show only
  the subject (no weekday or AM/PM), collapse repeated classes for the same
  subject, open the correct class, and exclude withdrawn enrolments.
- [x] Check class labels in admin/tutor attendance, tutor dashboards and
  rosters, admin class/tutor/profile views, parent class/curriculum pages,
  student recorded lessons, absence choices, cover notices, and free-trial
  notifications. The subject must appear once; a class name that does not
  include its subject must still show both values.
- [x] Confirm student enrolment notes appear only beneath the correct student in
  the admin users list; check a blank note, a short note, and a long note on
  desktop and mobile.
- [x] Confirm student `In person`/`Online` badges respect an explicit enrolment
  mode and fall back to the class location/link when no override is set.
- [x] Confirm a tutor teaching both in-person and online classes shows both
  delivery badges, while accounts without class delivery data show no badge.
- [x] Search the admin users list by the full subject name and by the class name
  and confirm the matching students and tutors remain visible.
- [x] As Admin – reception, confirm admin account rows have no action gear,
  admin profile fields are read-only, and direct attempts to edit, deactivate,
  reset, promote, or change the admin PIN are rejected. Confirm student,
  parent, and tutor operational account management still works.
- [x] Reschedule a lesson, change its make-up destination, and confirm it still
  consumes exactly one reschedule allowance. Attempt a different subject/year
  target and confirm the server rejects it.
- [x] From a tutor's `Students to bump` card, send a reminder and confirm the
  button changes to `Sent`, the message names the current overdue task(s), and
  the student receives one working inbox notification. Confirm withdrawn and
  unrelated students cannot be messaged.
- [x] In Taiyo Blitz, confirm each correct answer shows the green `+1 Correct!`
  burst and score animation, the selected sound plays, Mute is silent, wrong
  answers retain their red feedback, and reduced-motion mode removes animation.
- [x] For a student with a class today inside their trial dates, confirm admin
  and the assigned tutor each receive one `Free-trial student today` notice
  with student, class, subject, time, and tutor details. Open each deep link and
  rerun the notification sweep to confirm it does not duplicate the notice.
- [x] Move a trial end date into the past and confirm admin receives exactly one
  `Bump student for free-trial follow-up` notification linked to the student.
- [x] Confirm Student Progress shows the written effort guide and matching
  red/blue/green/amber topic labels; meaning must remain clear without relying
  only on colour.
- [x] Confirm Terms is absent from admin navigation and `Manage terms` beside
  `Create class` opens the existing term-management page.
- [x] From tutor curriculum, create homework with and without an attachment.
  Confirm the form stays on the selected curriculum week, clears after success,
  and the new homework appears without opening the marking page.
- [x] Open an existing tutor homework item with an attachment, expand `Edit
  homework details`, and confirm the current attachment card and `Open file`
  action are obvious. Replace and remove the attachment in separate checks.
- [x] On Student → My subjects, confirm the week and full-month homework
  calendars span the whole content width beneath the subjects/tutors row and
  remain usable on mobile.
- [x] Compare student, tutor, and admin curriculum pages for the same subject.
  Confirm tutor/admin now use the same expandable weeks rail, subject-coloured
  week hero, and connected content layout, while all staff editing, upload,
  homework, topic, and announcement controls still work.
- [x] Trigger the under-48-hour extended-leave denial for a class whose class
  name repeats its subject and weekday. Confirm each appears only once and the
  date, time, deadline, and office instruction remain clear.
- [x] Open both Tutor Schedule actions on desktop and mobile. Confirm the wider
  weekly-availability and absence/leave panels fit the viewport, the forms are
  easy to scan, and both reason fields provide enough writing space.
- [x] Save and remove tutor recurring hours, then confirm the same changes show
  in Admin → Tutor availability and the tutor profile Availability tab.
- [x] With unread admin notifications, confirm the top-right bell is red and
  displays the unread count (capped at `99+`), and that the old large red
  `New notifications` callout is absent from the admin inbox.
- [x] On both the tutor and admin cover boards, confirm a class whose name
  repeats its subject or weekday displays each only once.
- [x] Claim a cover as a tutor. In Admin → Reschedules, change it to a different
  tutor, then use `Return to board`; confirm the original lesson tutor is
  restored and another tutor can claim the reopened cover.
- [x] Open tutor and admin curriculum with the weeks rail collapsed and
  expanded. Confirm the staff-only subject tab starts flush with the coloured
  week hero, the rail remains usable, and the student curriculum is unchanged.
- [x] In tutor curriculum, confirm Overview uses the subject colour, lesson
  materials are separate and easy to identify, and the homework form appears
  only after pressing `Add new homework`. Create homework and confirm the form
  closes, success feedback appears, and the new row is listed.
- [x] In admin curriculum, confirm an existing week opens in the learner-style
  reading view rather than a full-page form. Open `Edit week`, change every
  field, save, and confirm the coloured Overview updates correctly.
- [x] Open admin `Manage topics`, then create, rename, reorder, and delete a
  topic. Confirm the popup remains usable on desktop/mobile and the weeks rail
  updates after refresh without showing the former topics block above it.
- [x] From admin curriculum, create a new week, upload/replace its video and
  booklet, and confirm each saved item is reflected in the reading view.
- [x] In Create user, select each student role and confirm the optional linked
  Parent section appears. Create a student alone, then create a student and
  parent together; confirm both accounts are listed, both generated passwords
  are shown once, and the parent is linked as the student's primary contact.
- [x] As Admin – reception, open Create user and confirm Tutor, Admin –
  reception, and Admin – owner are not offered. Confirm a direct request to
  create any of those privileged roles is still rejected by the server.
- [x] Open a student profile on the default Profile tab and save a free-trial
  period. Confirm unrelated credits/reschedule queries do not run, the profile
  does not crash, and the save returns promptly while notifications appear
  shortly afterwards.
- [x] Add a dated student break from the student's Lessons tab. Confirm the
  directory/profile automatically shows `On break` (or `Break scheduled`) with
  the date range, the student's classes remain scheduled, affected tutor rolls
  identify only that student as away, and assigned tutors/admins receive one
  linked notification. Remove the break and confirm the status and roll flag
  clear without changing enrolment or login access.
- [x] Submit and approve a dated tutor leave request. Confirm Admin Users shows
  `Leave pending`, then `Leave approved`/`On leave` with the date range; every
  affected lesson is posted for cover rather than cancelled, and the status
  disappears automatically after the final date.
- [x] As a student, request a permanent move from Timetable. Confirm only a
  different class for the same subject is offered, full classes are disabled,
  the existing timetable stays unchanged while pending, and admin receives a
  detailed `Relocate class time for [student]` notification with a working link.
- [x] As a parent, submit a move for a linked child and confirm it appears on
  that child's admin profile. Attempt a direct request for an unrelated child,
  a different subject, the current class, and a full class; each must be
  rejected by the server.
- [x] Approve a pending permanent move from the student's `Lessons` tab. Confirm
  the old enrolment is withdrawn, the target enrolment is active exactly once,
  class capacity is respected, move history is recorded, and the student,
  linked parents, old tutor, and new tutor receive working notifications.
- [x] With unread notifications, confirm the admin, tutor, parent, and student
  top-right bells are red and show the unread number (capped at `99+`). Confirm
  their Notifications badges are also red in desktop and mobile navigation.
- [x] Create a recurring class and confirm lesson instances appear immediately
  for the next 16 weeks. Run the authenticated daily cron and confirm it adds
  only missing weeks, extends the rolling horizon, and does not recreate a
  cancelled lesson date or duplicate an existing lesson.
- [ ] Create another class with an assigned tutor. Confirm the tutor receives
  one `New class assigned` notification, every active admin receives one
  `Class created` confirmation, the tutor notification opens Tutor → Schedule
  & availability (the actual timetable), and the admin notification opens the
  class record.
- [x] From Tutor → Schedule & availability, open a lesson and use the back link.
  Confirm it is labelled `Schedule & availability` and returns to the schedule
  page; lessons opened from Tutor → Today must still return to Today.
- [x] Decline a separate move request with an explanation and confirm no
  enrolment changes. Then use `Move student` for a direct admin relocation and
  confirm the same capacity, history, and notification behaviour.
- [x] Create one account and one combined student/parent pair with complete
  postal addresses. Confirm each address is stored on the correct profile,
  remains editable, and older accounts with no address still open normally.
- [ ] Create an account using a real test inbox. Confirm the success panel says
  the password-setup email was sent, its link opens the portal reset-password
  page, the new password works, and the temporary password is still available
  as a one-time fallback. Repeat for a linked parent account.
- [ ] Move a student into a make-up class, then mark and edit that student's
  make-up attendance and attendance note as both tutor and admin. Save a full
  tutor lesson note and confirm admin can read it from the lesson record.
- [ ] As admin, move a student to an available make-up slot, then change that
  destination. Confirm only the latest make-up remains live, the previous
  history is cancelled, and the original roll still contains the other
  students. Try a stale/taken slot and confirm no partial move is saved.
- [ ] For that admin move, confirm the student, linked parent, original tutor,
  replacement tutor, and active admins each receive one notification with a
  link that opens in their own portal role.
- [ ] Reschedule the same original lesson twice as a student or parent. Confirm
  the allowance remains one, the earlier make-up is cancelled but remains in
  history, and the student appears only on the latest make-up roll. A stale or
  already-booked slot must fail without changing either roll.
- [ ] Sign in as another student enrolled in the original recurring class and
  as that student's parent. Confirm they cannot see or open the first
  student's private make-up lesson, attendance, or lesson note.
- [ ] After that make-up lesson, open the target class's next roll and confirm
  the temporary student is absent unless another make-up was booked. Use Admin
  Attendance's date picker to reopen the past lesson and inspect its tutor,
  attendance, make-up origin, attendance note, and lesson note.
- [ ] In Admin Settings, save `e1/2` against one subject. Confirm an exact
  `e1/2` search in Admin Users finds its students and tutors, while the full
  subject name and original class name still find the same accounts. Clear the
  shortcut and confirm it stops expanding; duplicate shortcuts must be rejected.
- [ ] As admin, publish announcements using multiple roles and combinations of
  subject, year, class, and assigned-tutor filters. Confirm every intended user
  receives one inbox notification and an unrelated student, parent, tutor, and
  admin do not receive or see the announcement.
- [ ] Submit a tutor class announcement and confirm students/parents cannot see
  it before approval, every active admin receives a working approval-inbox
  notification, and approving it publishes to the class students plus linked
  parents only when selected. Confirm the tutor receives the approval result.
- [ ] Reject a separate tutor announcement with a reason. Confirm no family
  receives it, the tutor sees the admin feedback in both notifications and the
  curriculum announcement card, and it remains labelled `Changes requested`.
- [ ] Mark a narrowly targeted announcement Urgent. Confirm the same exact
  recipients receive the red urgent in-app notification, one email job exists
  per recipient, retries do not duplicate sent mail, and no unrelated address
  is queued. End-to-end email delivery remains blocked until a no-extra-cost
  sender/domain is configured in the test environment.
- [ ] Open Admin → Classes → a subject curriculum and inspect weeks with and
  without quizzes. From an empty week, create a draft and separately request a
  tutor-built quiz; confirm the week is preselected, the new quiz card appears,
  and the quiz builder's back action returns to that exact curriculum week.
- [ ] Confirm the standalone `Quizzes` item is absent from desktop and mobile
  admin navigation. Open an existing draft, approved quiz, and pending-review
  quiz from its curriculum week; confirm preview/edit/approval actions and
  student visibility still respect the existing status rules.
- [ ] During Term Week 2, open a student and linked-parent curriculum. Confirm
  Weeks 1–2 open normally, Week 3 onward show a lock and cannot be opened, and
  direct booklet/quiz links for a locked week are rejected.
- [ ] Use a student first enrolled in Term 3. Confirm only started Term 3+
  curriculum appears. In Admin → Users → student → Curriculum access, grant
  one earlier subject term, confirm it appears for student and parent, then
  remove the grant and confirm it disappears again.
- [ ] Open a curriculum booklet and tutor-added PDF as student, parent, and
  tutor, plus a booklet as admin. Confirm it opens inside the large PDF viewer
  without forcing a download, Escape/X closes it, and Open separately works.
- [ ] In Admin → Payments, edit an invoice's linked parent/student, amount,
  currency, due date, description, and each status. Confirm only students linked
  to the selected parent are offered, paid/refunded states require and preserve
  the original payment date, dashboard totals refresh, and an `invoices` UPDATE
  audit row records the signed-in admin as actor.
- [ ] As students in two different year levels, submit Taiyo Blitz scores on
  multiple difficulties. Confirm the sidebar/mobile entry badge and game hero
  show the whole-centre overall rank, the year-level board excludes other
  years, `All Taiyo` includes them, each difficulty ranks personal-best scores,
  and inactive accounts are absent.
- [ ] As a student, open Profile icon from desktop and mobile navigation and
  select several icons. Confirm the header updates, the choice persists after
  sign-out/sign-in, invalid free-form values are rejected, and only the signed-in
  student's profile changes. As an assigned tutor, confirm the chosen icon
  appears in the Students list and that student's detail page; an unrelated
  tutor must still be unable to open the profile.
- [ ] As a tutor, open `Weekly check-in` for the current and a past week.
  Confirm scheduled lessons, dates, times, total hours, and estimated pay match
  the timetable, and cancelled/rescheduled lessons are not counted.
- [ ] Approve a tutor week and confirm its status persists after refresh. Submit
  an incorrect-hours report for another week and confirm the owner receives one
  notification linking to that tutor and week with the tutor's explanation.
- [ ] As Admin – owner, open Tutor check-ins and filter by tutor and class.
  Confirm reception has neither the navigation item nor direct page access.
- [ ] As Admin – owner, correct a row's class, date, times, rate, and note, then
  remove and restore it. Confirm totals update, the week returns to `Pending`,
  the tutor receives a correction notification, and the tutor can approve the
  corrected record again. Confirm the original lesson timetable is unchanged.
- [ ] Set an hourly rate on a tutor's Admin Users profile. Confirm all
  unapproved, non-manually-corrected rows immediately use that rate in Tutor
  check-in and Admin → Tutor check-ins. Confirm an approved week contributes to
  approved pay owed and a later rate change does not rewrite a valid approved
  snapshot. A legacy approved `$0` week must reopen as Pending, notify the
  tutor, and require approval again. Check the missing-rate warning and blocked
  approval with a second tutor whose rate is blank.
- [ ] Run the authenticated daily cron using Saturday and Sunday Melbourne test
  times. Confirm unapproved tutors receive one Saturday reminder and one Sunday
  reminder, owner-admin receives the Sunday overdue notice, approved/empty weeks
  are skipped, and rerunning the same day creates no duplicates.
- [ ] Inspect audit logs after tutor approval and an owner correction. Confirm
  the signed-in tutor/admin actor is recorded against the weekly check-in and
  entry changes, including before/after data. Attempt two stale edits of the
  same row and confirm the second is rejected instead of overwriting the first.
- [ ] Submit an assigned tutor quiz for review and confirm every active admin
  receives exactly one inbox approval notification linking to the quiz. Submit
  it again after an admin requests changes and confirm every admin receives
  exactly one new review-cycle notification, without retry duplicates.

## Recently implemented

- [x] Consistent class and subject labels across the portal.
  - A shared formatter removes a matching subject prefix from class names,
    including older records where the prefix was saved more than once.
  - Admin Users badges now show the subject only, such as `Year 9 English`;
    weekday and AM/PM details remain on the linked class page.
  - Multiple class slots for the same subject collapse into one directory
    badge.
  - The same rule is used in attendance, tutor schedules/dashboards/rosters,
    admin class and tutor views, parent class views, student recorded lessons,
    cover workflows, absence choices, and free-trial notifications.
  - Unrelated class names remain intact, so `English` plus `Tuesday PM` still
    displays as `English · Tuesday PM`.

- [x] Tutor extended-leave approval and class-cover workflow.
  - A tutor can report one assigned class they cannot teach, with a minimum
    48-hour submission rule.
  - A tutor can request 2–90 days of extended leave.
  - Extended leave requires admin approval before affected lessons are posted.
  - Each affected lesson is posted separately to the tutor cover board.
  - Any active tutor except the original tutor can claim cover.
  - Timetable conflicts and simultaneous claims are blocked.
  - Admin is notified when cover is posted, leave is requested/approved, cover
    is claimed, or claimed cover is released.
  - Admin receives deduplicated urgent alerts at 48 hours and 24 hours, plus a
    daily reminder while extended leave remains partly uncovered.
  - Urgent notifications are highlighted, filterable, and reflected by the
    admin notification bell.

- [x] Tutor Schedule & availability redesign.
  - Recurring availability now uses a weekday, full start time, and full finish
    time instead of small `8p`/`9p` buttons.
  - Saved windows are written in full, such as `Monday 3:00 PM–6:00 PM`.
  - The small dot and tutor-facing `isolate` terminology were removed.
  - The separate `Change one date` workflow was removed; time away is handled
    through the existing single-class absence or extended-leave request.
  - Weekly availability and absence/leave now open from clear slide-over
    buttons above the timetable instead of occupying the page body.
  - Both slide-overs use a wider desktop layout, and absence/leave reason fields
    provide more writing space.
  - Admin can review the same saved recurring hours from the main navigation,
    the Classes page, and each tutor's Availability tab.
  - The monthly timetable now appears directly below the page header.
  - `/tutor/cover` is now specifically the replacement-shift notice board.

- [x] Homework and curriculum presentation refinements.
  - Tutor homework creation stays on the selected curriculum week, resets the
    form, confirms success, refreshes the list, and no longer jumps to marking.
  - Existing homework attachments have a prominent current-file card inside
    the edit form with a direct open action.
  - Student homework calendars use the full page width beneath subjects/tutors.
  - Tutor and admin curriculum use the learner curriculum's attached weeks rail,
    coloured week hero, coloured overview, and connected content-panel layout
    without modifying the student curriculum implementation.
  - The staff-only collapsed subject tab is flush with the top of the week hero.
  - Tutor lesson materials are separated from the Overview, and `Add new
    homework` expands the creation form only when needed.
  - Existing admin weeks are read-first; `Edit week` and `Manage topics` use
    focused side panels instead of exposing large forms above the curriculum.
  - Under-48-hour leave errors remove duplicate subject and weekday wording.

- [x] Admin notification and tutor-cover QA refinements.
  - The admin top-bar bell turns red for any unread notification and displays
    the unread count; the duplicate large inbox callout is hidden for admin.
  - Tutor and admin cover-board labels remove repeated subject and weekday text.
  - Admin can change the replacement tutor on a claimed cover or return an
    accidental claim to the open cover board.

- [x] Combined student and parent account creation.
  - Selecting either student access type offers one clearly optional linked
    Parent section beneath the student's details.
  - Admin can create the student and parent in one submission, with separate
    generated or manual temporary passwords and a primary family link.
  - Account/profile/link creation is transactional with compensating auth
    rollback, so a failed parent or link does not intentionally leave half a
    family behind.
  - Reception never sees tutor or either admin role in the create-user picker;
    the owner-only server permission remains enforced.

- [x] Initial website loading-performance pass.
  - Repeated authentication calls within one render are memoized.
  - The message inbox and unread badge no longer perform three extra database
    queries per conversation.
  - Notification counts use database aggregation.
  - Message and notification badges load concurrently.
  - Timetable override history is bounded to a relevant date range.
  - Hundreds of small availability forms were removed from the calendar.
  - Student profile tabs now fetch only the data required by the active tab;
    opening the Profile/free-trial view no longer waits for credits, reschedule
    history, reports, leave, or the lesson calendar.
  - Free-trial notification generation runs after the save response and remains
    protected by the retry-safe daily cron.

- [x] Account contact and password onboarding.
  - New accounts collect a structured postal address: street, optional second
    line, suburb/locality, state/territory, and postcode.
  - The same fields are collected for an optional linked parent, stored on the
    correct profile, shown in the admin summary, and editable later.
  - Every newly created account receives a secure Supabase password-setup link
    that lands on the existing reset-password page.
  - The success screen reports email delivery separately for the student and
    linked parent; failed delivery does not destroy the account or hide its
    one-time temporary-password fallback.
  - Admin-triggered password resets use the same explicit safe redirect.

- [x] Make-up attendance consistency and admin inspection.
  - Make-up attendees have editable attendance status and attendance notes in
    both tutor and admin lesson views.
  - The assigned tutor can create full lesson notes for an approved make-up
    attendee on that lesson only, without gaining access to unrelated students.
  - Admin lesson records display all saved tutor lesson-note fields and mark
    temporary make-up attendees clearly.
  - Server actions reject attendance or notes for a student who is neither
    enrolled in the class nor approved into that exact make-up lesson.

- [x] Admin Users subject search shortcuts.
  - Owner Admin Settings lists every subject beside an optional unique quick
    key such as `e1/2`.
  - Alias matching is exact and additive: name, email, full subject, and class
    name searches continue to work normally.
  - Alias writes are owner-gated and the underlying table is RLS deny-by-default.

- [x] Targeted announcements and tutor approval workflow.
  - Admin announcements use independent, combinable role, subject, year, class,
    and assigned-tutor filters instead of one audience dropdown.
  - Publication stores an exact recipient snapshot, then creates one deduped
    in-app notification per recipient; later enrolment changes do not broaden
    access to an old message.
  - Tutor announcements are restricted to a class assigned to that tutor and
    remain pending until admin approves them from the announcement review area.
  - Tutors can optionally include only parents linked to matching students;
    approval and rejection results are returned to the tutor with feedback.
  - Urgent announcements create retry-safe, auditable email jobs for the exact
    same recipient snapshot. In-app delivery does not depend on email setup,
    and queued mail is retried by the existing authenticated daily cron.
  - Direct Supabase reads use the recipient snapshot and hide pending posts;
    recipient lists and email-delivery records are RLS deny-by-default.

- [x] Admin quiz creation moved into curriculum weeks.
  - The standalone Quizzes navigation item is removed on desktop and mobile.
  - Every saved admin curriculum week now has a dedicated Weekly quiz section
    showing the attached quiz's title, status, and answerable-question count.
  - Empty weeks offer `New quiz` and `Request from tutor` in place; the current
    subject/week is preselected and the one-quiz-per-week constraint is retained.
  - Opening the quiz builder from curriculum returns to the same subject, term,
    and week instead of the former standalone list.

- [x] Audited manual invoice editing.
  - Every invoice row has an admin-only Edit panel for payer, linked student,
    amount, currency, due date, description, status, and original payment date.
  - The server restricts student choices to students actually linked to the chosen
    parent; the server-side action enforces the same relationship and role checks.
  - Paid and refunded records keep an explicit original payment date, while
    quick status changes no longer erase that date when changing Paid to
    Refunded.
  - Saves run through the actor-aware transaction so the existing immutable
    invoice audit trigger records the before/after row and signed-in admin.

- [x] Taiyo Blitz ranks and scoped leaderboards.
  - The Blitz entry icon shows the student's whole-centre rank on desktop and
    mobile after their first scored run; the game hero repeats the rank clearly.
  - Overall rank sums one personal best from each difficulty, so repeat plays
    cannot inflate a student's standing.
  - The leaderboard has separate year-level and `All Taiyo` views while keeping
    the existing difficulty tabs, top-20 list, and out-of-top-20 personal row.
  - All five boards are loaded in one query per scope and inactive accounts are
    excluded.

- [x] Controlled student profile icons.
  - Students choose from a labelled, keyboard-accessible library of 12
    code-rendered icons; no file upload or custom artwork is required.
  - The selected key is allow-listed by both the server action and a database
    constraint, and the update is restricted to the signed-in student's row.
  - The student's portal header and assigned tutors' Students list/detail page
    render the choice, with initials retained as the fallback.

- [x] Tutor weekly check-in and payroll history.
  - Each tutor receives a Monday–Sunday check-in populated from their scheduled
    lessons, with week navigation, total hours, and rate-based estimated pay.
  - Tutors can approve the record or report incorrect details; an issue sends
    the owner a notification linked to the exact tutor/week.
  - The owner-only dashboard filters by tutor and class, separates approved pay
    owed from pending totals, and retains a monthly summary of generated weekly
    snapshots.
  - Owner corrections can change the payroll class/date/time/rate/note or
    remove/restore a row. Every correction resets the week for tutor approval
    and notifies that tutor, without silently changing the lesson timetable.
  - Check-in, entry, and pay-rate changes are actor-audited. Direct browser
    access to the payroll tables is deny-by-default under RLS.
  - The authenticated daily cron sends deduplicated Saturday/Sunday tutor
    reminders and a Sunday owner alert for each still-unapproved week.
  - Payroll approval is blocked while a lesson is unfinished or any active row
    has a missing/zero rate. Tutor and owner edits use locked, version-checked
    transactions so a stale screen cannot overwrite newer payroll data.
  - Updating the hourly rate on Admin Users synchronizes unresolved generated
    rows. Valid approved snapshots remain frozen; legacy approved `$0` weeks
    reopen, are repaired, notify the tutor, and require fresh approval.
  - Database constraints prevent duplicate tutor/week and lesson rows, reject
    invalid minutes/rates, prevent approved-row mutation, and reject approval
    of empty or zero-rate weeks. Pay is rounded per visible lesson row so the
    weekly/monthly totals equal the rows shown to the owner.

- [x] Approval-inbox routing audit.
  - Permanent class moves, tutor leave, tutor announcements, and legacy pending
    reschedules already create admin inbox notifications with working review
    links.
  - Tutor-built quizzes now notify every active admin when submitted for review,
    rather than only the admin who originally assigned the quiz, and use a
    retry-safe event key.

## Tutor leave, breaks, and account status

- [x] Extended tutor leave requires approval and posts affected classes to the
  cover notice board.
- [x] Admin cover notifications, urgent deadline alerts, and daily uncovered
  reminders are implemented.
- [x] Replace the ambiguous undated break/pause profile toggle with the dated
  student-break and tutor-leave workflows already used by attendance and cover.
- [x] Derive Admin Users/profile schedule badges from those date ranges while
  keeping account activation and login access independent.
- [x] Student breaks keep every class running, mark only the affected student
  as away on tutor rolls, and notify assigned tutors/admins when added/removed.
- [x] Approved tutor leave posts affected lessons to the cover board rather
  than cancelling them; pending/approved/current states show in Admin Users.

## Free-trial students

- [x] Complete the free-trial notification and attendance workflow.
  - Admin can set a student's trial start date, end date,
    and internal note from the student profile.
  - Tutor attendance displays a `Free trial` badge when
    the lesson date falls within the trial.
  - [x] Notify relevant admin and tutors: `There is a free-trial student today`.
  - [x] Include the student's name, class, subject, time, and assigned tutor in
    the admin notification.
  - [x] Show the free-trial badge in admin attendance as well as tutor
    attendance.
  - [x] Show permitted admin/system trial notes to the assigned tutor in
    attendance.
  - [x] Notify admin after the trial finishes to follow up with the student.
  - [x] Show scheduled, current, and ended trial status with dates in Admin
    Users and the student profile summary.

## Navigation feedback

- [x] Replace the normal mouse pointer with a compact Taiyo-blue swirling
  indicator while page navigation waits on server data. Render it through a
  fixed client portal so loading feedback never occupies layout space.
- [x] Navigate between several slow admin, tutor, parent, and student pages on
  desktop/mobile using the sidebar, calendar arrows, and browser back/forward.
  Confirm the small circular indicator follows the mouse without the old banner
  or top progress bar, the page never shifts, and the normal pointer returns
  when the destination renders or when a navigation fails. On touch devices,
  confirm the same indicator appears centrally without changing the layout.
- [x] Add reusable animated pending, success, and error states for async action
  buttons. Shared buttons now add the spinner automatically for pending
  create/save/publish actions, including New User, announcements, classes,
  subjects, terms, invoices, user edits, settings, and authentication. Custom
  reschedule, permanent-move, tutor-cover, curriculum, homework, check-in,
  discussion, reporting, class-credit, resource, and quiz actions use it too.
- [x] Trigger submit, approve, decline, assign, change-tutor, and return-to-board
  actions. Confirm each button blocks repeat clicks, keeps a stable width,
  displays the spinner while pending, briefly shows the correct success state,
  and shows `Try again` plus the detailed page error when the server rejects it.

## Taiyo branding

- [ ] Add appropriate Taiyo images and illustrations to the portal UI.

## Admin roles and student-role names

- [x] Rename user-facing role labels without changing stored permission values:
  - `student_unrestricted` → `Student`
  - `student_restricted` → `Student – parental access`
- [x] Reception cannot create admin or tutor accounts.
- [x] Reception cannot change its own or another user's role; role changes are
  restricted to owner-level admin on the server.
- [x] Review every other privileged admin action to ensure reception cannot
  bypass owner-only restrictions outside role management.
  - Reception cannot edit, deactivate/reactivate, or reset another admin
    account, and cannot set/change the owner-controlled admin PIN.

## Permanent student class moves

- [x] Let a student/parent request a permanent move to a completely different
  recurring class slot.
- [x] Materialize a rolling 16-week timetable for every recurring class when it
  is created or edited, and extend that horizon in the authenticated daily cron.
  Existing lesson dates of any status are preserved so cancelled or customised
  weeks are not recreated, and per-class advisory locking prevents duplicates.
- [x] Send admin a clear `Relocate class time for [student]` notification with
  the student, current class, requested schedule, reason, and contact details.
- [x] Add admin controls for permanent class moves under
  `/admin/users/[id]`, alongside the student's class information.
- [x] Show unread notification counts as a red numeric bell badge for admin,
  tutors, parents, and students, including red Notifications badges in mobile
  navigation.

## Create new user

- [x] Move Phone above Role and remove the generic `Optional` section label.
- [x] Add structured postal address fields to account creation and profile
  editing, including an optionally created linked parent.
- [x] For either student access type, show optional parent/contact fields:
  parent name, email, phone, and relationship.
- [x] Allow admin to create and link the parent account in the same submission
  as the student account.
- [x] Show parent/student links directly on the admin users list.
- [x] Add a clear link from a user detail page to each linked parent/student
  account.
- [x] Send a new-account email containing a secure password-setup flow.
  - Account creation remains confirmed with a one-time temporary-password
    fallback, then sends a Supabase recovery link to the portal's existing
    set-password page. Delivery status is shown explicitly to admin.
- [x] Forgotten-password and admin-triggered password-reset emails are wired
  through Supabase.
- [ ] Verify password-reset delivery end-to-end with a real configured email
  provider and real inbox. The owner confirmed a received reset email and
  successful password change on 18 September; custom-domain SMTP and delivery
  to a non-team recipient remain unverified.

## Make-up class attendance

- [ ] Complete and verify the full make-up-class relocation workflow.
  - [x] Admin and student/parent make-up moves write lesson, exact-attendee
    attendance, approved history, and role-linked notifications together.
    Replacing a destination cancels the previous booking without deleting its
    history. Legacy session-switch approvals remain a separate path.
  - [x] Tutor/admin attendance shows moved-in students under `Make-up
    attendees` for the target lesson only; unrelated enrolled students do not
    gain access to that private make-up lesson.
  - [x] Student, linked parent, relevant tutors, and active admins receive
    role-appropriate make-up notifications from current move paths.
  - [x] Confirm that the selectable destination is restricted to the same
    subject and year level in every reschedule path.
  - [x] Ensure the reschedule token is consumed exactly once per original
    lesson, including after changing its make-up destination.
  - [x] Allow attendance details/notes to be managed consistently for temporary
    make-up attendees.
  - [ ] End-to-end test that the student disappears from later rolls unless
    another make-up is scheduled.
  - [x] Ensure admin can inspect every past, current, and future class with its
    students, attendance, tutor, notes, and make-up status.

## Admin users list

- [x] Add subject-only information as compact status badges; class schedule
  details remain available through the badge link.
- [x] Move Reset and Deactivate actions into a labelled gear menu.
- [x] Display short admin-only preference notes beneath the relevant user row.
- [x] Display `In person` and/or `Online` delivery status for students.
- [x] Display both delivery modes for tutors who teach both types.
- [x] Add admin-configurable quick-search aliases in Settings, such as `e1/2`
  for `English 1/2`.
- [x] Search continues matching the original subject/class name after an
  alias is added.

## Login entry page

- [x] Remove the public role/marketing landing page and redirect `/` directly
  to `/login`.
- [x] **Manual QA:** Open the production root URL while signed out and confirm it
  reaches `/login` without flashing the old landing page.

## Announcements and email delivery

- [ ] **Deferred until client GoDaddy access is available:** Add the three
  DNS records requested by Resend for `send.taiyotuition.com` (domain
  verification/DKIM, SPF, and MX) in the client's GoDaddy DNS, without
  changing the website's existing records. Refresh Resend domain verification,
  then configure Supabase custom SMTP with the verified sender and test new
  account setup, password reset, and urgent-announcement delivery to a
  non-team inbox. The user will obtain GoDaddy access later; do not mark email
  delivery complete or change production SMTP before verification.

- [x] Replace the single audience dropdown with combinable audience filters:
  role, subject, year level, class, and tutor.
- [x] Ensure only recipients matching the selected audience receive the
  announcement.
- [x] Restrict tutor announcements to students in their own classes.
- [x] Let tutors include the linked parents of their own students, subject to
  admin approval.
- [x] Send every tutor announcement approval request to the admin notification
  inbox.
- [x] Route all approval workflows to the admin notification inbox.
  - Permanent class moves, reschedules, tutor leave, tutor announcements, and
    tutor-built quiz review requests all create linked admin inbox items.
- [x] Send urgent targeted notifications/announcements by email as well as
  in-app, without leaking messages to unrelated roles, classes, subjects, or
  tutors. Email jobs are implemented and safely queued; actual external delivery
  still requires configured sender credentials and end-to-end QA.

## Notifications

- [x] Show the admin unread count on the top-right notification bell, and turn
  the bell and number red whenever unread notifications exist.
- [x] Urgent cover notifications have red styling and an Urgent filter.

## Classes and curriculum

- [x] Show class location/room clearly on both student timetable variants.
- [x] Move admin quiz creation into `Classes → Curriculum`, attached to the
  relevant curriculum week.
- [x] Move Terms from the main navigation into Classes as `Manage terms`, near
  `Create new class`.
- [x] Student reschedules and cancellations generate in-app notifications for
  admin and the relevant tutor/family recipients.
- [x] Release student curriculum one teaching week at a time. Future weeks are
  visibly locked and the same restriction is enforced on server-side booklet,
  progress, and quiz requests for both students and linked parents.
- [x] Restrict curriculum history to the student's first enrolment term for
  each subject and later started terms. Add Admin → Users → student →
  Curriculum access so an admin can grant or revoke a specific earlier term.
- [x] Add an in-portal PDF viewer for curriculum booklets and tutor-added PDF
  attachments across student, parent, tutor, and admin curriculum pages.
- [x] Add manual payment editing controls with an audit trail and clear
  permissions.

## Automations

- [ ] Clarify and design the note: `move Wednesday → notes notified` before
  implementation. Define who initiates it, what moves, who is notified, and
  what note content is included.

## Tutor follow-up and payroll check-in

- [x] Add a one-click action under `Students to bump` that sends an automated,
  task-specific message to the student.
- [x] Build a weekly tutor check-in page populated from scheduled lessons.
- [x] Let tutors approve the week's worked hours or message admin when the
  generated record is incorrect.
- [x] Send tutor reminders on Saturday and Sunday if the week is unapproved.
- [x] Notify admin on Sunday when a tutor still has not approved their hours.
- [x] Build the owner-admin check-in dashboard with tutor/class filters.
- [x] Let owner-admin edit, move, annotate, or remove incorrect check-in rows.
- [x] Keep tutor and admin check-in records synchronized and auditable.
- [x] Calculate total tutor pay owed from approved hours and pay rates.
- [x] Retain weekly and monthly check-in history for payroll records.

## Student portal

- [x] Make Taiyo Blitz Sprint a 30-second round while keeping the other
  difficulty rounds at 60 seconds.
- [x] Remove the duplicate Profile icon entry from the student sidebar and
  open Profile & security from the top-right profile avatar instead.
- [x] Add an authenticated password-change form to Student Profile & security
  that verifies the current password, confirms the new password, and rate
  limits password-change attempts.
- [ ] QA: From a student account, open the top-right profile avatar, change the
  icon, then change the password using the correct current password. Confirm an
  incorrect current password is rejected and the new password works at the
  next sign-in.
- [x] Remove the `Your quests` block for both student access types.
- [x] Rename Math Blitz to `Taiyo Blitz`.
- [x] Display the student's rank on the Taiyo Blitz entry/logo.
- [x] Add year-level and whole-of-Taiyo leaderboard views.
- [x] Add stronger correct-answer feedback, optional sound, and visual effects.
- [x] Add an in-game Close button that exits without opening another tab.
- [x] Let students choose a profile icon from a controlled icon library.
- [x] Show those profile icons to assigned tutors.
- [x] Remove the `Open` and `Due this week` summary blocks from Student
  Homework.
- [x] Add clear colour-coded effort levels to Student Progress, with accessible
  text labels as well as colour.

## Production deployment and acceptance

- [x] Re-run `npm run typecheck`, all unit tests, and `npm run build` after
  moving the repository out of iCloud. All completed successfully on
  20 September; the follow-up batch now passes 161 tests across 28 files.
- [x] Apply `supabase/migrations/0043_tutor_cover_workflow.sql`.
- [x] Apply `supabase/migrations/0044_notification_dedupe.sql`.
- [x] Add `CRON_SECRET` to the Vercel Production environment.
- [x] Deploy the current code.
  - Production is live at `https://portal.taiyotuition.com`.
- [ ] Run authenticated acceptance tests for tutor availability, leave and
  cover, free-trial notifications, homework bump messages, reception account
  restrictions, reschedule allowance/target rules, and Taiyo Blitz feedback.
- [ ] Confirm production loading improvements using Vercel/Supabase timing data.

## Deployment required for the next larger workflow batch

- [x] Apply `supabase/migrations/0045_account_pauses_and_class_moves.sql` to
  Production.
- [x] Apply `supabase/migrations/0046_profile_postal_addresses.sql` and
  `0047_subject_search_aliases.sql` to Production.
- [x] Apply `supabase/migrations/0048_announcement_targeting_and_approval.sql`
  to Production.
- [x] Apply `supabase/migrations/0049_student_profile_icons.sql` to Production.
- [x] Apply `supabase/migrations/0050_tutor_weekly_checkins.sql` to Production.
- [x] Apply `supabase/migrations/0051_makeup_reschedule_history_backfill.sql`
  to Production. The production backfill completed with no duplicate targets.
- [x] Apply `supabase/migrations/0052_tutor_payroll_integrity_guards.sql` to
  Production.
- [x] Commit and push the account-status, class-move, announcement, make-up,
  profile, curriculum, and payroll implementation (`b80c4b1`).
- [x] Deploy the batch to Vercel Production at
  `https://portal.taiyotuition.com`.
- [ ] Repeat the role-specific live smoke tests against non-client test
  accounts.
