# Beta Fix Checklist

Last audited: 11 September 2026

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
- [x] From the admin users list, confirm the gear menu exposes password reset
  and deactivate/reactivate, each confirmation and action works, and `Open`
  remains directly available.
- [ ] In admin attendance, confirm `Free trial` appears only when the lesson date
  falls within the student's trial dates, including for a make-up attendee.
- [ ] In tutor attendance, confirm a saved free-trial note appears with the
  `Free trial` badge during the configured dates for both a regular enrolment
  and a make-up attendee, and is hidden outside those dates.
- [x] Confirm linked parents/children appear beneath the correct account in the
  admin users list and each name opens the correct profile on desktop and mobile.
- [ ] In the admin users list, confirm current student/tutor badges show only
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
- [ ] For a student with a class today inside their trial dates, confirm admin
  and the assigned tutor each receive one `Free-trial student today` notice
  with student, class, subject, time, and tutor details. Open each deep link and
  rerun the notification sweep to confirm it does not duplicate the notice.
- [ ] Move a trial end date into the past and confirm admin receives exactly one
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
- [ ] In Create user, select each student role and confirm the optional linked
  Parent section appears. Create a student alone, then create a student and
  parent together; confirm both accounts are listed, both generated passwords
  are shown once, and the parent is linked as the student's primary contact.
- [ ] As Admin – reception, open Create user and confirm Tutor, Admin –
  reception, and Admin – owner are not offered. Confirm a direct request to
  create any of those privileged roles is still rejected by the server.
- [ ] Open a student profile on the default Profile tab and save a free-trial
  period. Confirm unrelated credits/reschedule queries do not run, the profile
  does not crash, and the save returns promptly while notifications appear
  shortly afterwards.

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

## Tutor leave, breaks, and account status

- [x] Extended tutor leave requires approval and posts affected classes to the
  cover notice board.
- [x] Admin cover notifications, urgent deadline alerts, and daily uncovered
  reminders are implemented.
- [ ] Add a separate break/pause status for tutors and students.
- [ ] When an account remains enabled while paused, show both `Active` and
  `On break`/`Paused` instead of replacing one status with the other.

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

- [ ] Let a student/parent request a permanent move to a completely different
  recurring class slot.
- [ ] Send admin a clear `Relocate class time for [student]` notification with
  the student, current class, requested schedule, reason, and contact details.
- [ ] Add admin controls for permanent class moves under
  `/admin/users/[id]`, alongside the student's class information.

## Create new user

- [x] Move Phone above Role and remove the generic `Optional` section label.
- [ ] Add postal address fields.
- [x] For either student access type, show optional parent/contact fields:
  parent name, email, phone, and relationship.
- [x] Allow admin to create and link the parent account in the same submission
  as the student account.
- [x] Show parent/student links directly on the admin users list.
- [x] Add a clear link from a user detail page to each linked parent/student
  account.
- [ ] Send a new-account email containing an activation/password-setup flow.
  - **Partial:** Admin account creation and generated temporary passwords work,
    but account creation currently confirms the email without sending an
    invitation email.
- [x] Forgotten-password and admin-triggered password-reset emails are wired
  through Supabase.
- [ ] Verify password-reset delivery end-to-end with a real configured email
  provider and real inbox.

## Make-up class attendance

- [ ] Complete and verify the full make-up-class relocation workflow.
  - **Partial:** Reschedules already record students moving into and out of a
    lesson, and tutor/admin attendance shows moved-in students under
    `Make-up attendees` for the target lesson only.
  - **Partial:** Reschedule notifications already include admin and relevant
    tutors.
  - [x] Confirm that the selectable destination is restricted to the same
    subject and year level in every reschedule path.
  - [x] Ensure the reschedule token is consumed exactly once per original
    lesson, including after changing its make-up destination.
  - [ ] Allow attendance details/notes to be managed consistently for temporary
    make-up attendees.
  - [ ] End-to-end test that the student disappears from later rolls unless
    another make-up is scheduled.
  - [ ] Ensure admin can inspect every past, current, and future class with its
    students, attendance, tutor, notes, and make-up status.

## Admin users list

- [x] Add subject-only information as compact status badges; class schedule
  details remain available through the badge link.
- [x] Move Reset and Deactivate actions into a labelled gear menu.
- [x] Display short admin-only preference notes beneath the relevant user row.
- [x] Display `In person` and/or `Online` delivery status for students.
- [x] Display both delivery modes for tutors who teach both types.
- [ ] Add admin-configurable quick-search aliases in Settings, such as `e1/2`
  for `English 1/2`.
- [ ] Search must continue matching the original subject/class name after an
  alias is added.

## Login entry page

- [x] Remove the public role/marketing landing page and redirect `/` directly
  to `/login`.
- [ ] **Manual QA:** Open the production root URL while signed out and confirm it
  reaches `/login` without flashing the old landing page.

## Announcements and email delivery

- [ ] Replace the single audience dropdown with combinable audience filters:
  role, subject, year level, class, and tutor.
- [ ] Ensure only recipients matching the selected audience receive the
  announcement.
- [ ] Restrict tutor announcements to students in their own classes.
- [ ] Let tutors include the linked parents of their own students, subject to
  admin approval.
- [ ] Send every tutor announcement approval request to the admin notification
  inbox.
- [ ] Route all other approval workflows to the admin notification inbox.
  - **Partial:** Reschedule and tutor-leave approvals already do this.
- [ ] Send urgent targeted notifications/announcements by email as well as
  in-app, without leaking messages to unrelated roles, classes, subjects, or
  tutors.

## Notifications

- [x] Show the admin unread count on the top-right notification bell, and turn
  the bell and number red whenever unread notifications exist.
- [x] Urgent cover notifications have red styling and an Urgent filter.

## Classes and curriculum

- [x] Show class location/room clearly on both student timetable variants.
- [ ] Move admin quiz creation into `Classes → Curriculum`, attached to the
  relevant curriculum week.
- [x] Move Terms from the main navigation into Classes as `Manage terms`, near
  `Create new class`.
- [x] Student reschedules and cancellations generate in-app notifications for
  admin and the relevant tutor/family recipients.
- [ ] Add manual payment editing controls with an audit trail and clear
  permissions.

## Automations

- [ ] Clarify and design the note: `move Wednesday → notes notified` before
  implementation. Define who initiates it, what moves, who is notified, and
  what note content is included.

## Tutor follow-up and payroll check-in

- [x] Add a one-click action under `Students to bump` that sends an automated,
  task-specific message to the student.
- [ ] Build a weekly tutor check-in page populated from scheduled lessons.
- [ ] Let tutors approve the week's worked hours or message admin when the
  generated record is incorrect.
- [ ] Send tutor reminders on Saturday and Sunday if the week is unapproved.
- [ ] Notify admin on Sunday when a tutor still has not approved their hours.
- [ ] Build the owner-admin check-in dashboard with tutor/class filters.
- [ ] Let owner-admin edit, move, annotate, or remove incorrect check-in rows.
- [ ] Keep tutor and admin check-in records synchronized and auditable.
- [ ] Calculate total tutor pay owed from approved hours and pay rates.
- [ ] Retain weekly and monthly check-in history for payroll records.

## Student portal

- [x] Remove the `Your quests` block for both student access types.
- [x] Rename Math Blitz to `Taiyo Blitz`.
- [ ] Display the student's rank on the Taiyo Blitz entry/logo.
- [ ] Add year-level and whole-of-Taiyo leaderboard views.
- [x] Add stronger correct-answer feedback, optional sound, and visual effects.
- [x] Add an in-game Close button that exits without opening another tab.
- [ ] Let students choose a profile icon from a controlled icon library.
- [ ] Show those profile icons to assigned tutors.
- [x] Remove the `Open` and `Due this week` summary blocks from Student
  Homework.
- [x] Add clear colour-coded effort levels to Student Progress, with accessible
  text labels as well as colour.

## Deployment still required for recently implemented work

- [ ] Apply `supabase/migrations/0043_tutor_cover_workflow.sql`.
- [ ] Apply `supabase/migrations/0044_notification_dedupe.sql`.
- [ ] Add `CRON_SECRET` to the Vercel Production environment.
- [ ] Deploy the current code.
- [ ] Run authenticated acceptance tests for tutor availability, leave and
  cover, free-trial notifications, homework bump messages, reception account
  restrictions, reschedule allowance/target rules, and Taiyo Blitz feedback.
- [ ] Confirm production loading improvements using Vercel/Supabase timing data.
