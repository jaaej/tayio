# Beta Fix Checklist

Last updated: 13 October 2026

## Status key

- `[x]` - implemented in the current codebase
- `[ ]` - not fully implemented
- **Partial** - some supporting behaviour exists, but the full requirement is
  still open
- Every implemented feature still requires a separate manual QA check by the
  owner before deployment. Automated checks do not close manual QA items.

## Manual QA required

- [ ] Student dashboard and glass shell (13 October 2026): sign in as a student at 1440px and 390px.
  Confirm the sidebar matches admin and tutor (search, Taiyo Blitz card with your rank, collapse to the icon rail), and that Taiyo Blitz is in the phone menu.
  On `/student`, check the header greeting and date, and that "Term N, Week N" shows once a current term exists (dev has none configured).
  Check that the next subject's card is the saturated one and its next lesson reads correctly ("On now until ...", "Today 4 pm", "Next lesson Thu 4 pm").
  Check that "This week: <topic>" appears on each subject card during a running term.
  In To do, check that overdue work beyond two items becomes one "N overdue pieces of homework" row that opens Homework, and that the badge counts every item.
  Check that this week's unattempted quiz and unwatched video appear and disappear once done, that marked work shows for a week with "See feedback", and that an unrestricted student with a balance sees "Invoice to pay".
  In This week, check that finished lessons turn grey, the live lesson pulses, and due homework links to the homework page.
  Walk every other student page inside the new shell; their inner styling is not redesigned yet.

- [ ] Owner follow-ups to the tutor redesign (12 October 2026):
  withdraw a student from every class of a subject and confirm that board
  leaves their Discussions and its links show not found, while their other
  boards still work. Open a Messages conversation in each role (admin, tutor,
  student, parent) and check the header reads who the person is and the
  classes that connect you ("Parent of ... · class", "Sarah's tutor · class",
  "Tutor · class"). Mark a homework with a score above 100 (refused) and
  65 (shows "65%" to the student and parent); confirm a tutor's Students page
  Average score counts marked homework and quizzes. Tutor Profile shows no
  hourly rate. Notifications fill the page width in all four roles.

- [ ] Tutor glass redesign (12 October 2026): sign in as a tutor at 1440px and
  390px and walk every sidebar item. Today: each To do row opens the right
  place (the single "missing a note" row opens the oldest lesson without a
  note), "Send reminder" on Students to bump, and week arrows. Classes: each
  card's Week plan and Lessons. Class page tabs: Week plan autosave plus
  file upload and "Add to library", Lessons tab buckets, Students tab,
  Announcements submit, admin reject, then "Edit & resubmit". Lesson page:
  All present, Save attendance, notes with "Save & next student", recording
  link. Marking: Save & next through the queue and Homework settings panel.
  Students: search and `?q=` from the sidebar search. Quizzes, Resources
  share switch, Profile photo and icon. Discussions "Tutor answer" tag and
  Asked by card, Messages header for a tutor-parent conversation,
  Notifications sections. Schedule: each tab of
  the "Hours & time away" panel, post a class for cover, have another tutor
  take and release it, request and withdraw extended leave. Check-in: the
  current week shows In progress; approve last week. Then reopen admin
  Dashboard, Users, Attendance, Quizzes and Resources to confirm the shared
  components still look right there.

- [ ] Admin Classes as the home of curriculum (12 October 2026): the sidebar
  has no Curriculum group; from `/admin/classes` open Terms, Quizzes (badge =
  quizzes waiting for review) and a subject's Curriculum; confirm Classes stays
  highlighted on each, every back button returns to Classes, ⌘K still finds
  Quizzes and Terms, and an old `/admin/subjects` link lands on Classes.
- [ ] Admin Users internal notes (12 October 2026): a person with an internal
  note shows it as a third line under their name in the list (full text on
  hover); people without one are unchanged. Check at 1440px and 390px.
- [ ] "For students this week" (12 October 2026): as tutor, write the week
  plan for a class and attach a file and a link; confirm the class's students
  and parents see it on that week of `/student/subjects/[id]` and
  `/parent/subjects/[id]`, that another class of the same subject does not,
  and that removing a migrated attachment shared by two classes keeps the
  other class's copy working.

- [ ] Admin glass redesign (12 October 2026): sign in as owner and as
  reception, at 1440px and 390px; walk every sidebar item, open and close the
  sidebar collapse, use ⌘K search, open a side panel (New class, New invoice),
  and confirm reception still sees no revenue figures without the PIN.

- [ ] Admin Attendance (11 October 2026): on desktop and at 390px, switch
  queue tabs and pick a day, mark a lesson with "All present" and a note, use
  "Save & next lesson" through to the end of the queue, and open "View lesson
  notes". Confirm a make-up lesson lists only its make-up attendees.
- [ ] Admin Reschedules (11 October 2026): on desktop and at 390px, check
  every tab, approve and reject a pending leave from the banner, assign,
  change and return a cover, and confirm a cover under 24 hours sits in its
  own column.

- [ ] (11 October 2026) As owner, open Admin Payments on desktop and phone.
  Click each status tile and confirm it filters and clicking again clears it.
  Search a child's name, create an invoice from the side panel, change a
  status from the pill, mark one paid, and edit one.
  Send a reminder to a family, confirm a second send the same day is refused,
  and confirm the parent sees "Payment reminder" under Action needed.
  As reception without the PIN, confirm no dollar amount appears anywhere on
  the page (tiles, family headers, invoice rows), Edit is hidden, Mark paid
  still works, and entering the PIN on the page reveals the amounts.
  (No reception account exists in dev; create one to test this.)
- [ ] (11 October 2026) As reception, confirm Admin Revenue is locked and
  unlocks with the PIN; as owner, confirm the tiles match the six-month chart
  and the dashboard, and the PDF downloads.
  Open Admin Reports and Settings on desktop and phone and confirm term
  switching, CSV export, PIN change, and shortcut saving still work.
- [ ] (11 October 2026) As admin, tutor, student, and parent, open Messages on
  desktop and at 390px. Desktop: the inbox list and conversation sit side by
  side, the open thread is highlighted, each pane scrolls on its own, and a
  conversation opens scrolled to the newest message. Phone: the list and the
  conversation are separate screens and the conversation's back button
  returns to the list. Check search, `New` and `Cancel`, unread dots clearing
  on open, day dividers, sending (Enter and the Send button), and that admin
  `View profile` opens the right user. No doubled headers in any role.
- [ ] (11 October 2026) As admin, tutor, student, and parent, open
  Notifications. Confirm one labelled section per kind with Messages and
  Action needed above Learning updates, Announcements, and Other updates;
  filters, Mark all read, the tutor/student/parent `New notifications`
  shortcut, Urgent badges, expand-in-place rows, and the Melbourne-time
  stamps (`9:41 am`, `Yesterday`, `Thu`, `24 May`).
- [ ] As owner and as reception admin, open `/admin/users` at 1440px and
  390px.
  On desktop, click through people in each role tab and confirm the list
  keeps its scroll position, the selected row is highlighted, and the URL
  becomes `/admin/users/[id]` with the role, search, and filters kept.
  Refresh on a profile and confirm the same person and list come back.
  On phone, confirm the list shows alone, a profile shows alone with a back
  button, and back returns to the same filtered list.
  Check search, the Filters menu (Status, School, Sort), `?new=1`, the year
  groups on the Students tab, row flags, quick facts, every profile tab, the
  internal note edit, Message, and the More actions menu.
- [ ] As admin, tutor, student, and parent, open Messages, start a new
  message, open a conversation, and send a reply on desktop and phone width.
  Confirm the inbox, contact picker, and conversation use the frosted glass
  treatment, both bubble styles stay readable, and the composer is reachable
  without the page scrolling sideways.
- [ ] As admin, scroll partway down Admin Users and open search from the
  header button, `/`, and Command/Ctrl+K on desktop and phone. Confirm the
  white dialog opens over a dimmed page without scrolling. Then open a
  homework PDF, image, and video and confirm each viewer covers the screen
  rather than appearing below the page.
- [ ] In every role, visit a page other than the dashboard and confirm only
  that destination is highlighted in the desktop sidebar and phone menu.
  Confirm the 220px sidebar shows every label without truncation.

- [ ] Open the admin dashboard on desktop and phone widths. Confirm each
  section header, including `Needs your attention`, retains its solid surface
  while the content below it uses the calendar-style frosted glass treatment.
  Confirm lists, hover states, empty states, pills, and the weekly calendar
  remain legible over the portal background.
- [ ] At a phone-width viewport, sign in as admin, tutor, student, and parent.
  Open the compact Menu control, confirm the active destination is named,
  visit every destination, and confirm unread badges and Taiyo Blitz rank
  remain visible where applicable. Repeat the core navigation on desktop and
  confirm the existing sidebar is unchanged.
- [ ] On phone-width admin, tutor, and student curriculum pages, confirm the
  weeks rail starts collapsed, opens from `Choose a week`, switches weeks, and
  closes without covering the selected week content. Confirm the desktop weeks
  rail and attached content layout remain unchanged.
- [ ] On phone width, check the student timetable, shared month calendar,
  week calendar, mini week calendar, and reschedule date grid. Confirm all
  seven days remain legible through horizontal scrolling without making the
  entire page scroll sideways. Confirm the permanent class-time footer and
  its request button fit within the calendar card.
- [ ] On phone width, inspect admin users, quizzes, reports, resources,
  payments, reschedules, student homework, tutor homework, and tutor students.
  Confirm wide tables scroll inside their own region, page headers and actions
  wrap cleanly, and desktop column widths remain unchanged.
- [ ] Open a homework PDF, image, and video on a phone. Confirm each viewer
  uses the available screen, can be closed without browser navigation, and
  retains the existing desktop modal treatment at desktop width.
- [ ] As admin, tutor, student, and parent, open a new message composer, select
  a valid contact, then return without sending. Confirm the contact does not
  appear in the inbox. Send a first message and confirm the conversation then
  appears for both participants.
- [ ] As a tutor, upload, replace, and remove a JPEG, PNG, or WebP profile
  photo on `/tutor/profile`. Confirm the signed photo appears in the desktop
  profile chip and mobile header, an invalid or oversized file is rejected,
  and choosing an icon removes the photo.
- [ ] In an admin subject curriculum with no classes, save homework with
  `Subject only - not assigned`, add a worksheet and solution, and confirm it
  remains on the selected week without creating student assignments or
  appearing in a tutor marking queue.
- [ ] In Admin Classes, open a curriculum week, create homework for a selected
  class with and without a worksheet, and confirm every active enrolment is
  assigned exactly once and the class tutor receives it in the normal marking
  workflow.
- [ ] Upload, replace, open, and remove a homework solution as both admin and
  the assigned tutor. Confirm an assigned student cannot see or open the
  solution before the due date and can open it after the due date.
- [ ] As admin, tutor, and student, open homework PDFs and images and confirm
  they render inside the portal without a required download. Open a supported
  video and confirm it plays inside the portal. Confirm Word and PowerPoint
  files retain the Open file fallback.
- [ ] Open an approved quiz from an admin curriculum week and confirm the
  action says `Edit quiz`. Change its title, questions, and answers, refresh,
  and confirm the saved approved quiz remains live and editable.
- [ ] Open an editable quiz as admin and tutor on desktop and mobile. Confirm
  the compact title/metrics header aligns cleanly, the icon-sized back control
  returns to the correct curriculum week, question cards use the full content
  width, and the `Add a question` choices appear below the question list.
- [ ] In Admin Users, confirm `Add internal note`, saved notes, and the open
  note editor have clear spacing below the user's name and related details on
  desktop and mobile.
- [ ] Confirm login and all four role portals render with Nunito Sans across
  headings, navigation, controls, tables, and body copy on desktop and mobile.
  The global font is loaded through `next/font` in `src/app/layout.tsx` and the
  shared font tokens in `src/app/globals.css`.
- [ ] Confirm the student timetable and parent class schedule use the shared
  frosted-glass calendar treatment on desktop and mobile. Month controls, the
  calendar frame, day panes, today state, lesson chips, and reschedule menus
  must remain clear and usable against every part of the portal background.
- [ ] Confirm the `Permanent class time` section appears directly below the
  student and parent calendars as a connected glass footer on desktop and
  mobile. Open its request panel and confirm pending, unavailable, success,
  and validation states remain readable.
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
  blue unread dot disappears immediately. (11 October 2026: the time sections
  were replaced by per-kind sections; the row behaviour is unchanged and is
  re-checked in the glass inbox QA item above.)
- [x] Leave a notification inbox open across a minute boundary and confirm its
  timestamp advances from `5m ago` to `6m ago` without refreshing. Confirm the
  label changes to `1h ago` at 60 minutes and then advances hourly.
  (12 October 2026: the live `5m ago` label was restored in the glass inbox
  at the owner's request; re-check it in the glass inbox QA item.)
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
  `Create class` opens the existing term-management page. Confirm `Back to
  classes` returns directly to Admin Classes.
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
- [ ] Open an uploaded curriculum video as student, parent, tutor, and admin.
  Confirm it plays inside the portal without downloading. Also test one lesson
  recording link (YouTube, Vimeo, Google Drive, or Loom), Escape/X, and the
  Open separately fallback.
- [ ] In Admin → Payments, edit an invoice's linked parent/student, amount,
  currency, due date, description, and each status. Confirm only students linked
  to the selected parent are offered, paid/refunded states require and preserve
  the original payment date, dashboard totals refresh, and an `invoices` UPDATE
  audit row records the signed-in admin as actor.
- [ ] As students in two different year levels, submit Taiyo Blitz scores on
  multiple difficulties. Confirm the sidebar/mobile entry badge and game hero
  show the whole-centre overall rank, the year-level board excludes other
  years, `All Taiyo` includes them, each difficulty ranks personal-best scores,
  each player row shows their profile icon/initials, inactive accounts are
  absent, and Sprint ends at 30 seconds while other modes end at 60 seconds.
- [ ] As a student, press the top-right profile avatar on desktop and mobile,
  then select several icons. Confirm the header and leaderboard update, the
  choice persists after sign-out/sign-in, invalid free-form values are rejected,
  and only the signed-in student's profile changes. As an assigned tutor,
  confirm the chosen icon appears on that student's profile page (opened from
  the class's Students tab); an unrelated tutor must still be unable to open
  the profile.
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

- [x] Sidebar logo is the 2025 Taiyo logo (15 October 2026, owner request), for every role on the glass shell (admin, tutor, student).
  `GlassBrandMark` (`src/components/portal/glass-chrome.tsx`) shows `src/components/brand/taiyo-logo.png` (torii, TAIYO, TUITION) with no tile or background; the collapsed rail shows `taiyo-torii.png` (the gate alone); the phone header uses a smaller copy of the full logo.
  The assets were baked from `2025_Taiyo_Logo_MAIN_BLUE.psd`: the gate is a red layer in Luminosity mode over the blue background plus a Curves layer, so its blue was reproduced (Photoshop luminosity blend, then the curve) before removing the background; the lettering keeps its navy stroke and a rebuilt drop shadow.
  The logo fonts are BubbleGum (TAIYO) and Gotham Bold (TUITION); the portal UI uses Figtree (glass portals) and Nunito Sans (login, parent portal).
  Checked on :3004 for student and tutor: expanded, collapsed and phone. Admin uses the same component but was not opened (expired dev session).
  The parent portal (old shell), login and landing pages still use the navy SVG torii (`ToriiMark`).

- [x] Student (shipped 15 October 2026): Progress page trimmed, with a term picker and Reports (15 October 2026, owner request).
  Removed: the overall summary line ("8 topics tracked · 1 mastered ..."), each subject's "4 topics · focus: ..." line, the tiles' sub-text ("homework and quizzes"), and the Submitted and Pending tiles; Mastery and Average score remain.
  A term picker beside the Progress title (`?term=`, left out for the term running today) offers terms that have started since the student's first enrolment, newest first.
  The chosen term drives the average score, the test rank and Recent marks: homework by due date, quizzes by their curriculum week.
  Each term covers the days up to the next term's start, and the student's first term also takes anything earlier, so holiday work still counts (`progressTerms`, `inTerm` in `progress/_lib/progress.ts`, tested; `getStudentOverallSubjectRank` takes an optional term).
  Topic mastery has no term history in the schema, so it always shows the current level.
  Reports lists the term reports an admin issued to the student (read from their "Term report ready" notifications), each downloading the PDF.
  Parental-access students see "Your term reports go to your parent.", matching the report route, which only lets unrestricted students open their own.
  Verified on :3004 for both student types at desktop and phone width; dev has two terms and no issued reports, so switching between two offered terms and a listed report were not seen in the browser.
  Follow-ups: reports are not stored, so a deleted notification hides its report from this list; the parent portal has no reports list yet.

- [x] Tutor Students tab removed (15 October 2026, owner request): students are reached from each class's Students tab, so the separate list duplicated the class page.
  The Students menu item and the `/tutor/students` split-view list are gone; `/tutor/students` and `/tutor/notes` now redirect to `/tutor/classes`.
  Student profiles stay at `/tutor/students/[id]`: they are linked from the class roster, Marking, lessons, Today, discussions and messages, and now open full width with Classes highlighted in the menu.
  The class roster passes `?class=`, so the profile's back button returns to that class's Students tab (otherwise to Classes); tab links keep it.
  The search box (`PortalSearch`, new optional `people` prop) now finds the tutor's students by name and lists their classes, replacing the "Search your students" link to the old list (`src/app/tutor/_lib/student-search.ts`, tested).
  Today's "All students" and "All notes" links, which opened the old list, were removed.
  Lost with the list: its per-student flags (on leave, overdue, due today, trial) at a glance; the class roster shows attendance only, and the flags remain on each profile.
  Verified on :3003 as a tutor: redirect, menu, roster to profile and back, tabs keep the class, search by name, `/tutor/notes`; phone width has no overflow.
- [ ] Manual QA: as a tutor, open a class, its Students tab and a student, switch profile tabs, press back, and find a student by name from the search box (⌘K).

- [x] Student (shipped 15 October 2026): shared notification inbox restyled from the owner's mock (15 October 2026).
  `src/components/notifications/inbox-view.tsx`, used by all four roles: header with "N unread" beside the title and Mark all read, filter pills with a coloured dot and count per kind, then one framed list.
  The owner chose to keep the inbox rule: Messages and Action needed keep their own dividers at the top; everything else falls under Today, This week (Monday onwards) and Earlier.
  Each row names its kind ("Message", "Announcement") and shows a fixed stamp ("3:12 pm", "Sun", "20 Sep") instead of a ticking "5m ago".
  Rules and tests: `notificationWhen` and the new `notificationSections` in `src/lib/notification-groups.ts`; pill labels are now "Learning" and "Updates".
  The red "New notifications" callout and the `showUnreadCallout` prop were removed; the Unread pill does the same job.
  Checked in the browser for student (desktop and phone), tutor and parent; admin not re-checked because the saved admin session expired.
- [x] Student (shipped 15 October 2026): the Play Sprint button was removed from the Taiyo Blitz hero (15 October 2026, owner request); every level, Sprint included, is still played from the level cards.

- [x] Student (shipped 15 October 2026): My subjects week view rebuilt from the owner's colourful mock (14 October 2026).
  `/student/subjects/[id]` right column is now: Overview in the deep subject colour (description plus "By the end of this week you can" ticked objectives), Lesson & materials (recorded lesson and booklet cards; Watch opens the player in place and still ticks the lesson off), Homework rows with Start / Resubmit / Done beside a Weekly quiz card, then the note from the tutor.
  The Weekly quiz card shows the approved quiz, or "Not ready yet" when a quiz was requested for that week but is not approved (new `quizInProgress` on `StudentCurriculumWeek` in `[id]/_queries.ts`); weeks with no quiz requested hide it.
  The recording length in the mock ("24 min") is not stored, so it is left out.
  `_components/week-work.tsx` (the colour task cards) was removed.
- [x] Student (shipped 15 October 2026): the dashboard subject cards no longer show the next lesson line (14 October 2026, owner request).

- [x] Student (shipped 15 October 2026): student Homework page reworked from the owner's mock (14 October 2026).
  `/student/homework` is no longer a split view: a header with subject, To do / Done and search filters, then Due this week as cards with Start, Overdue (three shown, "Show N older"), and Coming up last.
  The header has no subtitle, at the owner's request.
  Done shows Waiting for marking and Marked.
  Filters live in the URL (`subject`, `show`, `q`, `older`); the rules are in `_lib/homework-board.ts` (tested).
  "Ask <tutor> which still count" opens a DM when every overdue item has the same tutor, otherwise Messages; list rows now carry the class tutor (`_lib/homework-data.ts`).
  The detail page opens full width with a back button that keeps the filters.
  Dev data has nothing due this week, so the cards were checked with the clock set back, then reverted.

- [x] Student portal redesign from the design handoff (13-15 October 2026), pushed to production on 15 October 2026 (`2aab063`, after a passing `next build`; no migrations).
  Built from `taiyo-student-design.zip` as designed, using its colourful options, on the existing data and actions.
  The student portal uses the shared `GlassPortalShell`, like admin and tutor (`src/components/student/shell.tsx`), with the dark Taiyo Blitz tile in a new optional `feature` slot.
  Dashboard `/student`: violet hero, solid subject cards with a this-week ring, the Taiyo Blitz card, To do and This week (`src/app/student/page.tsx`).
  The to-do order and week rules are in `src/app/student/_lib/dashboard-rules.ts` (tested) and `dashboard.ts`, using the student's own curriculum access and Melbourne time.
  Every other student page follows the handoff too: My subjects, Homework, Timetable, Progress, Resources and recap, Taiyo Blitz, Payments, Profile, the practice quiz, discussions, messages and notifications.
  Later owner changes are the separate "Student (branch `student-handoff`)" entries above.
  Shared changes: `subjectTone` gains a `solid` fill; `TodoPanel` takes an optional `count`; `melbourneGreeting` in `src/lib/format.ts` replaces the admin and tutor copies; the cross-subject discussion board is "General help" in every role.
  An alternative "Impeccable" build of the same pages was compared on `main` and dropped on 15 October 2026 at the owner's request; it is kept only as the local git tag `impeccable-backup`.
  Known follow-ups: the parent portal is still on `CollapsiblePortalShell`, so its resources and timetable look different; recording length is not stored.

- [x] Tutor quizzes live in the week plan (13 October 2026).
  The Quizzes sidebar item and the `/tutor/quizzes` list are gone; an old `/tutor/quizzes` link redirects to `/tutor/classes`.
  A tutor reaches a quiz in two ways: the quiz card on its week in a class's week plan, or the admin's "Quiz requested" notification.
  The notification now says what admin wants: `Build "<title>" for <subject>, Term N Week N. Admin's note: <note>` (`src/lib/quiz-notifications.ts`, tested).
  Pressing it opens the quiz builder (`/tutor/quizzes/[id]`), which shows "Instructions from admin" at the top.
  The builder's back arrow returns to that quiz's week (`src/app/tutor/_lib/quiz-week.ts`).
  When the tutor teaches several classes in the subject, it uses the first class by name.
  The Classes sidebar item stays highlighted on the builder.
  The Today to-do for a quiz request now opens that week too, with the action "Open week".
  Removed as orphaned: the tutor quiz nav badge (`getTutorQuizTodoCount`), `listQuizzesForTutor`, `tutorQuizBuckets` and `tutorQuizAction`.
  Verified in the browser end to end on dev: admin requested a quiz from a curriculum week; the tutor saw the full request in Notifications; it opened the builder with the instructions; back went to the exact week plan week; and "Write quiz" there reopened the builder.
  The test quiz and its notification were then deleted from dev.
  Requests made before this change keep their old "Please build the ... quiz" text but still open the builder.

- [x] Tutor Schedule & availability header (13 October 2026): removed the "Cover board" button.
  The board is still reachable from the sidebar's Cover board item, so the button was a duplicate.
  The header now has one action: "Absence or leave".
  Checked in the browser at 1440 and 390 widths.

- [x] Lint (12 October 2026): ESLint 9 with `eslint-config-next`
  (`eslint.config.mjs`, `npm run lint`; `next lint` is deprecated in Next 15.5).
  All 49 first-run findings were fixed, and lint now reports nothing. Unused
  imports and dead code removed: `src/components/portal/shell.tsx`,
  `getTutorHomework`, `getTodayLessonCount`, and the student home's unused
  `getNextLesson` query. The parent `ChildSwitcher` prop `children` was
  renamed `students`. The four `<img>` tags (two SVG logos, two signed private
  URLs) keep `<img>` with a stated reason. Variables starting with `_` are
  allowed to go unused.

- [x] Owner follow-ups to the tutor redesign (12 October 2026). Typecheck and
  unit tests pass; each change was checked in the browser.
  - Discussions: withdrawn students lose the subject board
    (`canSeeBoard` in `src/lib/discussions-queries.ts`), thread pages 404 a
    thread from another board (`threadIsOnBoard`), and migration
    `0061_discussion_board_access.sql` scopes the read policies to match.
  - Messages header: one helper for every role,
    `src/lib/dm-context.ts` + `dm-context-label.ts`, replacing the tutor-only
    context. Classes are comma-separated because class names contain " · ".
    Non-admins see the office as "Admin" rather than the owner/reception tier.
  - Scores: a homework score is the percentage the tutor enters (0-100,
    validated in `markSubmission`, constraint in
    `0062_homework_score_percent.sql`) and shows as "65%" everywhere
    (`formatScore`). Average score (`src/lib/score-average.ts`) weighs each
    marked homework and each quiz's latest attempt (correct / questions)
    equally; used on the tutor Students page and student subject progress.
  - Tutor Profile no longer shows the hourly rate (Check-in still shows pay).
  - Notifications inbox fills the content width.
  - The admin and tutor glass sidebar always fills the window height
    (`src/components/portal/glass-shell.tsx`); on short windows only the menu
    scrolls.
  - Dev data: the offensive internal note on tutor Wei Chen was cleared.

- [x] Tutor portal pages on the glass kit (12 October 2026, `taiyo-tutor-design`
  handoff). Each page was checked in the browser at 1440px and 390px with no
  horizontal overflow; typecheck and unit tests pass.
  - Today `/tutor`: shared `TodoPanel` (marking, one row for lessons missing a
    note, quiz requests, last week's check-in, claimable covers), Today card,
    shared week panel (`src/components/dashboard/week-panel.tsx`, also on the
    admin dashboard), shared `PersonStatusTable` for Students to bump, Recent
    notes. `/tutor/notes` redirects to `/tutor/classes` (since 15 October 2026).
  - Classes `/tutor/classes`: next-class strip and class cards.
  - Class page `/tutor/classes/[id]/{curriculum,lessons,students,announcements}`
    with a shared header and tab badges (`classes/[id]/layout.tsx`).
    Week plan edits "For students this week" with autosave and attachments.
    Lessons tab replaces `/tutor/attendance` (now a redirect); its
    "needs finishing" rule is `classes/[id]/_lib/lesson-progress.ts` (tested).
    Announcements tab adds `resubmitClassAnnouncement`; admin approve/reject
    notifications now link to it, and each rejection gets its own
    notification key. Admin curriculum's quiz question count was always 0
    (unqualified Drizzle subquery column); fixed.
  - Lesson page `/tutor/lessons/[id]`: attendance uses the shared
    `src/components/attendance/attendance-row.tsx` (admin Attendance too), one
    roll for enrolled and make-up students, read-only week plan, recording,
    per-student notes with "Save & next student".
  - Marking `/tutor/homework/[homeworkId]?student=`: split view on the shared
    `ListPane`; old links unchanged. Homework settings opens in a side panel
    and `updateHomework` no longer redirects.
  - Students `/tutor/students` split view (`students/layout.tsx`, `?q=`,
    `?year=`, `?tab=`); search box shared with admin Users (`ListPaneSearch`).
    (The Students tab and list were removed on 15 October 2026; see Recently
    implemented.)
  - The shared quiz editor hides reorder arrows when read-only. (The tutor
    Quizzes list was removed on 13 October 2026; see Recently implemented.)
  - Resources rows with a share switch; resource type chip shared with admin.
  - Profile: photo, icon picker (now compact tiles, also on student profile),
    read-only hourly rate, classes and students. No start date or average
    score: the schema has no start date and homework scores have no maximum.
  - Discussions: tutor replies tagged "Tutor answer" in every role, shared
    "Asked by" card on the tutor thread page. Messages header says who the
    person is to a tutor. Six tutor/admin to-do notifications now group under
    Action needed (`src/lib/notification-groups.ts`, tested).
  - Phone menu names off-menu pages (Profile) instead of "Choose a page".
  - Schedule `/tutor/timetable`: the shared `MonthGrid` (new optional
    `dayBadges` for Away/Pending days), "Your regular week" and "Time away".
    One "Hours & time away" side panel with Regular hours, One class (48-hour
    rule) and Extended leave tabs replaces the two old panels;
    `?panel=leave|hours|extended` opens a tab. Tutors can withdraw pending
    leave (`withdrawTutorLeaveRequest`; admins get "Tutor leave withdrawn").
  - Cover board `/tutor/cover`: Needs cover, You're covering, Your requests,
    then extended leave; each open card says whether the tutor is free. The
    card is shared with admin Reschedules (`src/components/cover/cover-board.tsx`).
  - Check-in `/tutor/checkin`: fact tiles, lessons table with totals and
    "Corrected by admin" tags, confirm card. A week whose lessons have not all
    finished shows "In progress" with Approve disabled (the server already
    refused it).
  - Glass shell height variables use rem (html is 17px), so full-height panes
    no longer scroll the window by 2.5px.
  - Known, not fixed: students who withdrew from a class still see that
    subject's discussion board; admin "Tutor check-in not approved" files under
    Other updates.

- [x] Admin: curriculum, quizzes and terms are run from Classes
  (12 October 2026, owner request). The sidebar's Curriculum group is gone.
  `/admin/classes` header opens Terms and Quizzes (with the pending-review
  count) and its Subjects panel opens each subject's curriculum, now with
  "N weeks this term". `NavItem.also` (`src/lib/nav-active.ts`) keeps Classes
  highlighted on `/admin/subjects/**`, `/admin/quizzes/**` and `/admin/terms`;
  those pages' back buttons return to Classes; search still lists Quizzes and
  Terms. `/admin/subjects` redirects to `/admin/classes`. This reverses the
  11 October move of Terms back into the sidebar.
- [x] Admin Users list shows the internal account note under the name, only
  for people who have one (12 October 2026; `note` on `DirectoryListItem`).
- [x] Tutor glass redesign foundation (12 October 2026, `taiyo-tutor-design`
  handoff). The glass shell, sidebar nav, search and account row moved to
  `src/components/portal/` (`glass-shell`, `glass-nav-links`, `glass-chrome`,
  `global-search`) and are shared by admin and tutor; `.theme-admin` was
  renamed `.theme-glass`. Tutor nav has badges for marking, claimable covers,
  messages and notifications (the Quizzes item was removed on 13 October 2026)
  (`src/app/tutor/_lib/nav-badges.ts`); the account row opens
  `/tutor/profile`. Shared pieces extracted from admin for reuse:
  `TodoPanel`, `PersonStatusTable` (`src/components/dashboard/`) and
  `ListPane` (admin Users and Attendance now use it; both panes are now the
  same width). Parent still uses `CollapsiblePortalShell`; student moved to the glass shell on 13 October 2026.
- [x] One "For students this week" field per class per week (12 October 2026,
  migration `0060_class_week_plans.sql`, applied to dev only). Replaces
  `classes.lesson_plan` and the per-tutor `tutor_week_sections` notes; tables
  were renamed in place (`class_week_plans`, `class_week_plan_attachments`) so
  attachment ids and library links survive, and a shared tutor note was copied
  to each of that tutor's classes in the subject. The migration raises instead
  of dropping content it cannot place. Read via `src/lib/week-plans.ts`; write
  via `saveWeekPlanBody` and the `*WeekPlan*` actions in
  `src/app/tutor/_actions.ts`. Students and parents see it as "For students
  this week" on their week view; the old "What's coming up" banner and the
  lesson-page plan editor were removed. Publishing an attachment to the
  library now requires the class's own tutor.

- [x] Admin glass redesign foundation (12 October 2026, from the
  `taiyo-admin-design` handoff). Admin only while it is reviewed; tutor,
  student and parent keep their current shell. Known cross-role
  inconsistency: the admin shell, Figtree font, palette and glass side panel
  differ from the other roles until the redesign is rolled out to them.
  - Shell: `src/components/admin/glass-shell.tsx` (no desktop top bar; the
    glass sidebar holds brand, search, menu and the signed-in person; only the
    menu scrolls, with scroll shadows, and the current item scrolls into view).
    Sidebar adds a Curriculum group (Curriculum `/admin/subjects`, Quizzes,
    Terms) and a Reschedules badge (`getRescheduleBadgeCount`: pending
    reschedule requests + pending tutor leave + open cover requests).
  - Tokens: `.theme-admin` in `globals.css`, also applied through
    `body:has(.theme-admin)` so portalled overlays match. `--portal-header-h`,
    `--portal-sticky-top` and `--portal-fill-h` replace hard-coded sticky
    offsets (0 / 20px / 100dvh-40px in admin). `.glass` and `.panel` live in
    `@layer components` so utilities can override them.
  - Kit (`src/components/admin/ui`): `PageHeader` (glass bar, optional back
    button), `GlassPanel` (bezel), `buttonVariants` (primary ink / glass /
    outline / ghost), `Pill`, `SegmentedLinks`, `TabLinks`, `MetricTile`,
    `Avatar`, `SubjectDot`; subject colours in `src/lib/subject-tone.ts`.
  - Shared `SidePanel` renders as a floating glass sheet in admin only
    (`.side-panel-*` rules); `sections` lets a form supply its own white panels.
  - Inputs use the `line-field` border (3:1) instead of the design's
    `#DCDEE9`, which is only about 1.3:1 on white.
  - Availability and tutor bank-detail actions now return
    `{ ok: false, error }` instead of throwing, so production shows the real
    message.
  - Verified (12 October 2026): `tsc`, 270 unit tests, production build;
    screenshots of every admin page at 1440px and 390px (no page scrolls
    sideways); users split view selection, New class glass panel, sidebar
    active-item scroll; shared messages, notifications, discussions and
    curriculum checked as tutor, student and parent at 1440px.
    Not yet checked: reception (PIN-locked) views and real form submissions. Scroll panes now contain their `sr-only` labels
    (they had stretched the attendance page to 2600px).
  - Fixed (12 October 2026): intermittent request hangs, worst on
    `/admin/users`. Cause: postgres-js pipelined queries over Supabase's
    transaction pooler (Supavisor, port 6543, used by dev and production);
    when a page fired more parallel queries than the pool size, the pooler
    left backends "active / ClientRead" forever. `src/db/client.ts` now uses
    two clients: ordinary queries with pipelining off (`max_pipeline: 0`), and
    a separate small client for `begin()` (postgres-js cannot reserve a
    transaction's connection with pipelining off; it fails
    UNSAFE_TRANSACTION). Drizzle's parser overrides are mirrored onto both, so
    values read inside a transaction keep the same shape (checked). Verified:
    users loaders stalled 8/8 with any pipelining and 0/8 after, with and
    without concurrent transactions; 15 concurrent page loads including
    tutor check-ins all completed in 0.3-2.5s. This likely explains the earlier unresolved "dev /admin/users
    hang" note too; check production for the same symptom after deploy.

- [x] Admin Attendance glass split view (11 October 2026).
  - `/admin/attendance` and `/admin/attendance/[lessonId]` share one queue
    (`src/app/admin/attendance/_components/attendance-queue.tsx`) with
    To mark / Marked / Upcoming tabs (`?view=`), the day picker (`?date=`) and
    `?from=`. Desktop (xl) shows queue and marking pane side by side; phones
    show the queue, then the lesson on its own route with a back button.
  - "To mark" = started (Melbourne time) with an enrolled student lacking a
    row; rules and "Save & next lesson" order live in
    `src/app/admin/attendance/_lib/queue-logic.ts` (unit tested). Saving the
    last lesson returns to the queue with its filters.
  - One form saves the roll and make-up attendees; "All present" fills the
    class (not moved-out or make-up students). Make-up lessons no longer list
    the class roster the save action rejects. Notes open read-only in a side
    panel from "View lesson notes".
- [x] Admin Reschedules glass tabs (11 October 2026).
  - `?tab=` Cover board (default, keeps `#tutor-cover`), Leave requests,
    Class credits, Term usage. Cover board columns Under 24 hours / Needs
    cover / Covered come from `src/app/admin/reschedules/_lib/cover-columns.ts`
    (Melbourne time, unit tested). Pending leave shows as banners with the
    affected class count; the Leave tab adds the last 20 decisions.
  - Any still-pending student reschedule request (retired queue, but counted
    in the sidebar badge) is listed for approve/decline above the tabs.

- [x] Admin glass redesign: Payments, Revenue, Reports, Settings
  (11 October 2026).
  - Payments (`src/app/admin/payments/page.tsx`): status tiles (`MetricTile`)
    filter by `?status=`; All / Refunded / Cancelled sit beside the Families
    heading; `?q=` searches parent, email, and children.
    Invoices are grouped by billed parent (`invoices.parent_id` is NOT NULL,
    so every invoice has a family) by the tested pure
    `src/app/admin/payments/_lib/families.ts`.
    Each family shows its open balance and one "Send reminder".
    "New invoice" opens a side panel whose student list is filtered to the
    chosen parent's linked children; `createInvoice` now runs the same
    parent/student link validation as `updateInvoice`.
    The status pill is the status select; Mark paid and Edit stay per row.
  - Payment reminders: `sendPaymentReminder` in
    `src/app/admin/_lib/actions-invoices.ts` sends an in-app "Payment
    reminder" to the parent (`/parent/payments`), one per family per
    Melbourne day via `dedupe_key` `payment-reminder:<parentId>:<date>`.
    "Last reminded" is read from those notifications.
    The type is classified as Action needed in `src/lib/notification-groups.ts`.
  - Locked reception sees no dollar figures on Payments (12 October 2026,
    owner decision): tiles show counts, family headers show "N open
    invoices", invoice amounts show a lock, and Edit is hidden (its form shows
    the amount). Mark paid, status changes and reminders still work, and the
    page has an inline admin PIN prompt to unlock.
  - Revenue keeps the PIN gate unchanged; tiles and a new six-month
    `RevenueBars` chart both use Melbourne-month `getMonthlyRevenue`, so they
    agree with the dashboard. `getRevenueSummary` became `getOverdueSummary`
    (Melbourne today). Recent payments show student and description.
  - Reports: meters per tile and per class, subject dots (class rows now carry
    `subjectName`), class names link to the class page.
  - Settings stays owner only (`requireUnrestrictedAdmin`); PIN form is one
    row, shortcut rows carry subject dots.
  - Verified with `tsc` and `vitest` only; manual QA below is open.
- [x] Glass messaging and notification inbox redesign (11 October 2026),
  applied to all four roles through the shared components. Cross-role manual
  QA is still open (see the two 11 October items under Manual QA).
  - Messages are a two-pane workspace: `src/components/dm/messages-layout.tsx`
    renders the inbox list (`inbox-compose.tsx`, with people search and the
    `New` contact picker) beside the open conversation
    (`conversation-panel.tsx`). Each role's `messages/page.tsx` and
    `messages/[threadId]/page.tsx` render it; the per-role thread list and
    contacts load from `src/app/<role>/messages/_lib/inbox.ts`, after the
    thread is marked read so the list never shows the open thread as unread.
  - The old per-role `PageHero` above Messages was removed; the inbox pane
    carries the `Messages` heading. Admin conversations get a `View profile`
    link to `/admin/users/[id]`; other roles have no profile link.
  - Messages show Melbourne-time stamps and day dividers
    (`inboxStamp`, `conversationDayLabel`, `formatClockTime` in
    `src/lib/format.ts`). They previously used the server's UTC clock.
  - A failed send now keeps the draft and shows an inline error instead of
    throwing; the draft is keyed to its thread.
  - Notifications (`src/components/notifications/inbox-view.tsx`) now render
    one glass section per kind via `notificationSections` in
    `src/lib/notification-groups.ts`, so Messages and Action needed sit above
    Announcements and Other updates as the notification rule requires. The
    Today / This week / Earlier buckets and `notificationTimeBucket` were
    removed. The redundant `Action needed` row chip was dropped inside the
    Action needed section; `Urgent` stays.
- [x] Admin Announcements glass redesign (11 October 2026, admin only).
  - `src/app/admin/announcements/page.tsx`: glass header with a "N tutor announcements to approve" chip linking to `#awaiting-approval`; compose bezel (`id="compose"`, still the dashboard's quick-action target) beside a rail with Awaiting approval and History.
  - `create-announcement-form.tsx`: role cards, and the subject / year / class / tutor filters are compact multi-select pickers (still multi-value, same server action and validation); a live "To: ..." line from `targetSummary` shows the audience and whether it is in-app only or in-app + email.
  - Pending and history items keep their `announcement-<id>` anchors (tutor submission notifications link to them); history rows expand to the full message and keep Delete and rejection reasons.
- [x] Admin Resources glass redesign (11 October 2026, admin only).
  - `src/app/admin/resources/page.tsx`: header status chips (live / unpublished / removed counts) are the status filter (`?status=`, toggles off on a second click) and respect the subject/type filters; the Library bezel uses `UrlLabelledSelect` for Subject and Type, so `resource-filters.tsx` was removed.
  - Promoted resources show "Promoted from homework" under the title instead of a Source column.
  - Remove now opens an inline reason field and a "Remove resource" confirm instead of firing on one click (`resource-row-actions.tsx`).
  - The student/parent library browser (`src/components/resources/library-browser-client.tsx`) is not behind this admin page and was not changed; it is still on the older style.
- [x] Discussions glass redesign, shared by admin, tutor, and student (11 October 2026).
  - One implementation in `src/components/discussions/` restyled in place, using theme tokens so each role keeps its palette: `boards-view.tsx` (landing), `board-detail.tsx` (board), `thread-detail.tsx`, `reply-list.tsx`, `reply-composer.tsx`, `thread-list-panel.tsx` (searchable thread list used by both the landing's Recent activity and a board), `thread-row.tsx`, and `new-thread-panel.tsx`.
  - Every role now starts a thread from a "New thread" header button that opens a side panel (board picker on the landing, fixed board on a board page); the inline Ask prompt, the hero, the decorative thread backdrop, and `board-threads.tsx` were removed.
  - The reply box is always open at the end of the replies.
  - Role labels and staff highlighting now collapse tiered roles (`admin_unrestricted`, `student_restricted`, ...) through `coarseRole`; previously those showed raw enum text and admin replies were not highlighted as staff (`role-tone.ts`, covered by `role-tone.test.ts`).
  - The role pages (`src/app/{admin,tutor,student}/discussions/**`) only lost the now-unused `title` and `userFirstName` props; admin's moderation rail (`Admin controls`) shows a snippet per reply so two replies by the same person are distinguishable.
  - Parents have no discussions route, unchanged.
- [ ] **Manual QA (11 October 2026 redesigns):** As admin, open `/admin/announcements#compose` from the dashboard, publish to a filtered audience (subject + year), and approve and reject a tutor announcement.
  Open `/admin/resources`, filter by each status chip, unpublish, remove with a reason, and restore.
  As admin, tutor, and student, open Discussions, a board, and a thread at 1440px and 390px; post a thread from the landing and from a board, reply, and reply to a reply; as admin remove a reply and a thread.
  Confirm the three roles look and behave the same apart from their own colour theme and the admin moderation rail.
- [x] Admin Users split view from the "UsersGlass" design (11 October 2026).
  - `src/app/admin/users/layout.tsx` renders the list pane once
    (`_components/user-directory-pane.tsx`) and keeps it mounted while the
    admin moves between profiles; `/admin/users/[id]` renders the profile on
    the right and `/admin/users` shows a "Select a person" resting pane.
  - Below 1280px (xl) only one pane shows: the list on `/admin/users`, the
    profile with a back button on `/admin/users/[id]`.
    The split starts at xl rather than lg because at 1024px the profile pane
    would be under 400px wide.
  - Role tabs (All / Admins / Tutors / Parents / Students), search, and a
    Filters menu (Status, School, Sort) stay in the URL
    (`role`, `q`, `status`, `school`, `name`); every row, tab, back, and
    family link carries them (`_lib/directory-list.ts`, `_components/list-link.tsx`).
    Search and filters write the URL with `history.replaceState` and filter on
    the client, so typing does not re-render the open profile.
  - Students group by year through `normaliseYearLevel`, so "10", "Year 10",
    and "Yr 10" share one "Year 10" group (fixes the duplicated year group and
    "Yr Year 10" label); unit tests in `_lib/directory-list.test.ts`.
    Everyone groups by role; a single non-student role groups by initial.
  - Row flags come from real data only (`_lib/directory-data.ts`): absences
    and overdue homework use the dashboard "Students to watch" thresholds,
    plus current break/leave and current free trial.
  - Profile header: role-coloured initials, name, role, Active /
    Discontinued / Deactivated status, schedule and trial pills, year, school,
    email, phone, and linked parents or children; Message
    (`/admin/messages/with/[userId]`) and the account menu
    (`_components/user-account-actions.tsx`, formerly `user-row-actions.tsx`).
  - Quick facts (`_lib/profile-facts.ts`): students get Attendance and
    Homework (last 30 days), Invoices (overdue or open count), and active
    make-up Credits; tutors get Classes and Students; parents get Invoices;
    admins get none.
  - Every existing section stays reachable as a `?tab=` tab; the internal note
    is the amber "admins only" block at the top of the Profile tab.
  - Removed: `user-table-row.tsx`, `user-note-button.tsx`, `user-tabs.tsx`,
    `at-a-glance.tsx` (the list no longer has row note or Open controls).
  - Not built from the design: the Overview tab's "Recent activity" feed (no
    per-person activity query exists) and its class list with Move / Add leave
    buttons (those live on the Lessons & leave tab).
  - Verified with `tsc --noEmit` and `vitest`; no browser QA yet.

- [x] Glass messaging, narrower sidebar, and body-portal positioning fix
  (10 October 2026).
  - Messages inboxes, contact pickers, and conversations use the shared
    `portal-glass-*` surfaces (aliases of the calendar glass values in
    `src/app/globals.css`).
  - All four roles render conversations through one shared
    `src/components/dm/conversation-panel.tsx`; the per-role thread pages had
    drifted to different card components and padding.
  - A classmates strip was considered and declined: `canDM` blocks
    student-to-student messages and that safeguarding rule is unchanged.
  - The desktop sidebar is 220px (was 240px) in every role; 208px clipped
    the tutor `Schedule & availability` label.
  - The global `body > *` stacking rule now lives in `@layer base`.
    As an unlayered rule it overrode Tailwind `fixed`/`z-*` on every body
    portal, so admin search (and the PDF, video, and file viewers) rendered
    below the page and focus scrolled the user down to them.
    Admin search also carries its theme class so its dialog is white.
  - Sidebar and phone-menu highlighting share `src/lib/nav-active.ts`; a
    portal root such as `/admin` no longer stays highlighted on every page.
  - The compact Admin Users note control has a 20px top margin and no
    longer wraps its label.

- [x] Admin dashboard redesign from the owner's "Admin dashboard - Glass"
  reference (10 October 2026). `src/app/admin/page.tsx` now has a greeting
  header with quick actions (`/admin/announcements#compose`,
  `/admin/users?new=1`, `/admin/classes?new=1`, which open the existing create
  panels), a To do list built from real backlogs in
  `src/app/admin/_lib/dashboard-queries.ts` (unmarked attendance, overdue
  invoices, pending reschedules, tutor announcements to approve, last week's
  unapproved tutor check-ins for the owner, lessons without notes), a six-month
  revenue chart, a time-grid week calendar with week navigation and a live
  Melbourne "now" line (`src/components/data/week-time-grid.tsx`), Students to
  watch (2+ absences in the last four marked lessons, or 2+ overdue homework
  tasks), and the existing announcements and activity lists. Sections use the
  frosted `GlassPanel` frame with solid white content. Money stays behind the
  revenue PIN: locked reception sees a locked revenue card, overdue counts
  without totals, and no payment amounts in activity. Unused
  `getAtRiskStudents`, `getTutorsWithPendingNotes`, and `getOverdueInvoices`
  were removed. Verified with Playwright at 1440px and 390px on dev data.
- [x] Admin Users and Classes pages restyled to the same frosted design
  (11 October 2026). `/admin/users`: role stat tiles are the role filter
  (`?role=`, kept with search/status/school/sort), a single "All people"
  panel with search, Status, School, and Sort controls
  (`user-directory-controls.tsx`, shared `LabelledSelect` in
  `src/components/admin/ui/labelled-select.tsx`), rows with initials, email,
  year/school, family links, class chips, delivery, and status, and row
  actions of internal note (`user-note-button.tsx`, opens the existing note
  editor in a side panel), account menu, and Open. No CSV import, subtitle,
  or "Showing X of Y" (microcopy rule). The old column-header filters and
  mobile filter sheet were removed. `/admin/classes`: header keeps Manage
  terms and New class (Tutor availability removed from the header; it stays
  in the sidebar), subjects are mini blocks with their calendar colour and a
  Curriculum link, and the weekly schedule is now built from the week's real
  lessons on `WeekTimeGrid` (detailed mode: time range, tutor, enrolled /
  capacity) with Today, week/month navigation, a Tutor filter, and a
  Week/Month switch. Year levels now render through `yearLevelLabel`, fixing
  "Year Year 10" and "Yr Year 11". Verified with Playwright at 1440px and
  390px on dev data.
- [x] Admin Classes, New class panel, and class detail on the glass kit
  (11 October 2026, handoff designs ClassesGlass / NewClassDrawer /
  ClassDetailGlass). `/admin/classes` uses `PageHeader`, `buttonVariants`,
  `SegmentedLinks` (Week/Month), `SubjectDot`/`subjectTone` (no more
  `getAccentTokens`), and a subject-colour legend under the schedule; the
  month view now defaults to the Melbourne month, not the server's UTC one.
  The New class and class detail forms share
  `src/app/admin/classes/_components/class-fields.tsx` (segmented class type,
  capacity stepper, Repeats weekly switch, day picker, start/end with a live
  "Every Tuesday, 4:00 - 5:30 pm · 1 h 30 m" summary and inline
  `classTimeRangeError`). `/admin/classes/[id]` has a back-button header with
  subject/schedule/enrolled/location chips, Enrolled students (add from the
  title row, styled withdraw confirm) beside Class details. Automated checks
  only (tsc, vitest); not yet viewed in a browser.
- [x] Bug: New class defaulted start and end to the same (empty) value
  (11 October 2026). Start now defaults to 4:00 pm and end to start + the
  most common lesson length among existing classes (1 hour if none); moving
  the start keeps the length. `src/app/admin/classes/_lib/class-time.ts`,
  tested in `class-time.test.ts`.
- [x] Bug: a class time showing "2:10am" for 2:10 pm (11 October 2026). The
  formatters read 24h correctly (`formatTime`/new `formatTimeRange` tests in
  `src/lib/format.test.ts`); the cause is a 12-hour time picker left on AM
  storing 02:10. The forms now default to PM, always spell out am/pm in the
  live summary, and the detail header uses `formatTimeRange`. Existing rows
  saved as 02:10 still need correcting by hand.
- [ ] **Manual QA (classes, 11 October 2026):** at 1440px and 390px open
  `/admin/classes` (prev/next/Today, Tutor filter, Week/Month, "Without a
  recurring slot"), `/admin/classes?new=1` (defaults, change start, day
  toggle, capacity stepper, create), and a class detail page (add, delivery,
  admin note, withdraw, save details).
- [x] Admin Tutor check-ins glass redesign (2026-10-11).
  - Owner decision (12 October 2026): admins check hours but never approve
    them; only the tutor approves. Admins can correct any row, including in a
    week the tutor already approved; saving sends the week back to the tutor
    to approve again, and the side panel says so before saving.
  `/admin/tutor-checkins` is now a week matrix (tutors x Mon-Sun) inside its own horizontal scroller, with the tutor column sticky on phones.
  Cells are coloured by status (approved, waiting on tutor, issue reported, admin corrected, removed from pay), derived by the tested pure helpers in `src/app/admin/tutor-checkins/_lib/matrix.ts`, which also compute row totals, rate labels, and the header's approved pay and awaiting count.
  Clicking a cell opens a `SidePanel` with that tutor's rows for the day and the existing correction editor (`_components/entry-editor.tsx`, restyled); disputed weeks show in a "Needs your decision" card and a row Review button that open the whole week with the tutor's note.
  Tutor and Class filters are `UrlLabelledSelect` (`?tutor=`, `?class=`); week navigation, the missing-rate link, and monthly payroll history (`?month=`) are unchanged.
  Approval stays with the tutor: the design's per-row "Approve" and "Keep / Approve" buttons were not built because no admin approval action exists, and adding one would remove the tutor's sign-off on their own hours.
  Verified with `tsc` and `vitest` only.
- [ ] **Manual QA (tutor check-ins matrix):** At 1440px and 390px, open a week with approved, pending, disputed, corrected, and removed rows.
  Confirm the cell colours, row totals, header approved pay, and awaiting count match the rows, the matrix scrolls inside its card on a phone, and correcting or removing a row from a cell's panel refreshes the cell and keeps the row visible in the panel.
- [x] Admin Tutors and Tutor availability glass redesign (2026-10-11).
  `/admin/tutors` (still `requireUnrestrictedAdmin`) is one "Active tutors" panel of expandable rows with initials, contact, subject chips, and Details / Close; the expanded row holds the class schedule and the restyled `TutorBankForm`, which now checks the hourly rate range before saving and shows the reason when it is rejected.
  `/admin/tutors/availability` keeps the read-only week board and per-tutor editors, adds a Subject filter (`?subject=`; shows that subject's slots plus any-subject slots, logic in `_lib/board.ts` with tests), colours each day's free count, and shows the "All tutors" link to owners only.
  Verified with `tsc` and `vitest` only.
- [ ] **Manual QA (tutors and availability):** As owner and as reception, open both pages at 1440px and 390px.
  Confirm reception is bounced from `/admin/tutors` and sees no "All tutors" link, saving bank details still reports reopened weeks, the Subject filter narrows the board and its free counts, and adding and removing slots still works.
- [ ] **Known gap:** `addTutorAvailabilityRule`, `removeTutorAvailabilityRule` (`src/app/admin/_lib/actions-availability.ts`), and `setTutorBankDetails` (`actions-tutor-bank.ts`) still throw on validation errors, which production masks into a generic message.
  Convert them to return `{ ok: false, error }` like the check-in actions.
- [ ] **Known gap:** a tutor's "incorrect hours" report can only be cleared by an admin correction (which sends the week back to the tutor) or by the tutor approving; there is no admin "no change needed" reply.
- [ ] **Known cross-role inconsistency, owner-approved preview:** the floating
  frosted sidebar (`sidebarVariant="floating"` on `CollapsiblePortalShell`),
  the dark active nav pill, `GlassPanel`, `WeekTimeGrid`, and the restyled
  dashboard, Users, and Classes pages are admin-only while the owner reviews
  the design. Tutor, student, and parent still use the
  flat sidebar and `MiniWeekCalendar`. Roll out to all roles or revert once
  the owner decides.
- [ ] **Manual QA:** Sign in as Admin - reception without the PIN and confirm
  the revenue card is locked and no dollar figure appears anywhere on the
  dashboard; then unlock and confirm the figures appear.
- [x] Admin dashboard glass content surfaces - reverted 10 October 2026 at
  the owner's request. The dashboard cards are back to solid white surfaces,
  `divide-line` dividers, and `hover:bg-surface-2` rows, with the calendar's
  original faint brand gradient; the `.admin-dashboard-glass-*` classes were
  removed from `src/app/globals.css`. The phone layout from the same commit
  (`21a3d98`) is kept. The shared calendar and messaging glass is unchanged.

- [x] Phone-compatible portal layout without desktop layout changes.
  - Admin, tutor, student, and parent portals share a compact expandable mobile
    menu while retaining their existing desktop sidebars.
  - Curriculum week navigation collapses behind a clear phone control and
    remains permanently visible on desktop.
  - Seven-day calendars and wide data tables scroll within their own regions
    instead of compressing columns or widening the entire page.
  - Mobile spacing, page headers, action groups, class-move controls, and file
    viewers use the available phone width while desktop breakpoints preserve
    the prior dimensions.

- [x] Connected calendar and permanent-class-time glass composition.
  - Student timetable now places the permanent weekly class-move section below
    the calendar inside the same outer glass card.
  - The class-move section uses a translucent footer surface and a soft glass
    divider rather than appearing as a separate solid card above the calendar.
  - Parent class schedules reuse the same shared composition for role parity.

- [x] Inline homework viewing and editable existing admin quizzes.
  - Homework attachments, solutions, and supported student submissions now
    use one shared in-portal viewer for PDFs, images, and videos.
  - Unsupported browser document formats retain an explicit Open file fallback.
  - Supabase signed PDF URLs are permitted by the portal frame policy.
  - Admin curriculum now labels every existing quiz action `Edit quiz`, and
    admins can modify approved quizzes without changing their published status.
  - Tutor quiz editing restrictions remain tied to the review lifecycle.

- [x] Empty-message drafts, tutor profile photos, and subject-only homework.
  - Shared inbox queries now require a real first message, so opening and
    abandoning a conversation does not add it to any role's inbox.
  - Tutors can upload a validated private profile photo or switch back to a
    controlled icon from `/tutor/profile`.
  - Admins can prepare homework and its solution on a curriculum week before
    any class exists; choosing a class retains the assignment and marking flow.

- [x] Admin homework authoring, homework solutions, and quiz-builder layout.
  - Admin can assign homework from a curriculum week to any class for that
    subject; the assigned class tutor retains the marking workflow and the
    creator is recorded separately.
  - Admin and the assigned tutor share one solution uploader with private-file
    validation, replacement, removal, and short-lived signed viewing links.
  - Students only receive a solution link after the homework due date.
  - The quiz builder now has one compact aligned header, an icon-sized back
    action, a full-width question flow, question-type controls below the
    questions, and a compact readiness row.

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
- [ ] Verify password-reset delivery end-to-end through Supabase custom SMTP and
  a normal external inbox. The owner confirmed a received reset email and
  successful password change on 18 September; custom-domain SMTP delivery to a
  non-team recipient remains unverified.

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

- [x] Open a user by clicking anywhere on their row in `/admin/users`
  (10 October 2026), not only `Open ->`.
  Superseded on 11 October 2026 by the split view: each list row is now a
  single link and `user-table-row.tsx` was removed. `UserTableRow`
  (`src/app/admin/users/_components/user-table-row.tsx`) ignores clicks on
  links, buttons, the note editor, the settings menu, portaled panels, and
  text selection; Cmd/Ctrl-click opens a new tab. The name link remains the
  keyboard path. `Open ->` no longer wraps onto two lines. Verified with
  Playwright: email and empty-cell clicks open the profile; the settings
  menu, class pills, and drag-to-select do not.
- [ ] Dev only: authenticated `/admin/users` intermittently hangs for
  minutes on the local dev server while `/admin` stays fast. Two dev DB
  connections sat in `ClientRead` mid-query with no locks. The same server
  rendered the page in under 2s earlier. Investigate `getUserDirectory`'s
  parallel queries over the transaction pooler before assuming production
  is unaffected.

- [x] Add an admin header search (button, `/`, or Command/Ctrl+K) for portal
  pages, users, classes, and subjects; directory searches keep existing role
  permissions and subject aliases.
- [ ] QA: Open admin global search on desktop and mobile, search for a portal
  page and navigate to it, then search a student's name, email, class, full
  subject name, and configured subject alias. Confirm each directory result is
  filtered correctly and reception cannot surface owner-only destinations.
- [x] Add subject-only information as compact status badges; class schedule
  details remain available through the badge link.
- [x] Move Reset and Deactivate actions into a labelled gear menu.
- [x] Display short admin-only preference notes beneath the relevant user row,
  with clear separation from the user's name and related details.
  Since 11 October 2026 the note shows on the selected person's Profile tab
  in the split view rather than on the list row.
- [x] Display `In person` and/or `Online` delivery status for students.
- [x] Display both delivery modes for tutors who teach both types.
- [x] Add admin-configurable quick-search aliases in Settings, such as `e1/2`
  for `English 1/2`.
- [x] Search continues matching the original subject/class name after an
  alias is added.

## Login entry page

- [x] Remove the public role/marketing landing page and redirect `/` directly
  to `/login`.
- [x] Simplify the login branding: keep `Taiyo Tuition Portal` together in the
  top-left wordmark and remove the duplicate centre logo and translation line.
- [x] **Manual QA:** Open the production root URL while signed out and confirm it
  reaches `/login` without flashing the old landing page.
- [x] Add a flowing wave field and rotating quotes to the right half of
  `/login` (desktop `lg+` only; mobile stays form-only). 10 October 2026.
  Waves are pure SVG + CSS in
  `src/app/(auth)/login/_components/login-waves.tsx` (no image asset, unlike
  the reverted Great Wave PNG); loop styles are `.login-wave*` in
  `src/app/globals.css`. Quotes rotate every 7s with word-by-word
  `TextSlideUp` (`src/components/ui/text-slide-up.tsx`) in
  `quote-rotator.tsx`, pause on hover, and skip while the tab is hidden.
  Reduced motion stops the waves and removes the slide transforms.
  The previous "Be That Cousin" line was replaced by the quote set.
  Verified with Playwright at 1440, 1280, 1024 and 390px wide.
- [ ] **Manual QA:** Watch `/login` on a real desktop browser through a full
  quote cycle and confirm the wave motion feels calm, not distracting.

## Announcements and email delivery

- [x] Add and publicly verify the portal CNAME plus Resend DKIM, SPF, and MX
  records without changing the existing website records. DNS was rechecked on
  6 October 2026.
- [x] Add the required Resend email variable names to Vercel Production. Their
  presence was rechecked on 6 October 2026; secret values are not documented.
- [ ] Configure/confirm Supabase custom SMTP with the verified Resend sender,
  then test new-account setup and password reset to a normal non-team inbox.
- [ ] Publish a DMARC record after the current sending flow is verified. No TXT
  policy resolved at `_dmarc.taiyotuition.com` on 6 October 2026.
- [ ] Send a narrowly targeted urgent announcement and confirm Resend delivery,
  idempotent retry behavior, and that no unrelated inbox receives it.

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
  `Create new class`, with a clear `Back to classes` link on the Terms page.
  (11 October 2026: Terms is back in the sidebar under Curriculum, so the
  page no longer has a back link. 12 October 2026: moved back under Classes
  with a back button; see Recently implemented.)
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
- [x] Play uploaded curriculum videos and supported lesson-recording links
  inside the portal, with an Open separately fallback instead of requiring a
  download.
- [x] Add manual payment editing controls with an audit trail and clear
  permissions.
- [x] Keep the curriculum weeks rail full height (10 October 2026).
  With only a week or two, the open rail stopped after `+ Add week` and left
  empty page background below it; on long pages it scrolled away instead of
  staying pinned. The rail block now fills its column
  (`src/components/subjects/curriculum-layout.tsx`) and pins under the 56px
  top bar. This is the shared admin, tutor, and student layout; the parent
  view keeps its rail inside the page card.
- [x] Restore `position: sticky` across every portal page (10 October 2026).
  Since `ad0af71` (20 Sep 2026) the portal `<main>` had `overflow-y-auto`
  while the window did the scrolling, so every sticky element pinned to a
  container that never scrolled. `<main>` now uses `overflow-x-clip`
  (still no sideways page scroll, no scroll container), and the sticky
  offsets that assumed the old container now clear the top bar at 76px:
  student progress aside, discussion question card, and the student
  timetable picking banner (72px on mobile). The desktop sidebar is now
  sticky under the top bar too, so the menu no longer scrolls away and
  leaves an empty white column. Offsets use explicit px: the app's 17px root
  font makes rem utilities such as `top-14` land at 59.5px, not 56px.
- [ ] **Manual QA:** Scroll the admin dashboard, student progress, a
  discussion thread, and the student timetable in pick mode on desktop and
  phone, and confirm each sticky element pins below the top bar without
  overlapping it.
- [x] Admin glass redesign: Quizzes, quiz editor, Curriculum, and Terms
  (11 October 2026).
  - `/admin/subjects` is new: the sidebar's Curriculum home, listing every
    subject as a block (dot, name, year level, weeks planned this term)
    linking to its curriculum. The block is shared with `/admin/classes` via
    `src/app/admin/_components/subject-block.tsx`.
  - `/admin/quizzes`: glass header, "Waiting on you" review cards, and the
    table with search, status segments, and subject filter on its title row
    (`_components/quiz-filters.tsx`).
  - The quiz editor (`src/components/quiz/quiz-maker.tsx`) is restyled in
    place for admin and tutor: glass header with title, status, Send back
    (admin, now a side panel needing a note) and Approve or Submit; a
    question outline with ready markers; one bezel per question with lettered
    options. The admin or tutor note is now an inline strip under the header;
    the docked `quiz-instruction-strip.tsx` was removed.
  - The shared curriculum rail and layout
    (`src/components/subjects/curriculum-layout.tsx`, `curriculum-rail.tsx`)
    are a glass bezel in every role. Admin passes `framed`, so the rail pins
    20px from the top and bottom of the glass shell; other roles keep the
    full-height rail under the top bar with the frame inset inside it.
    The admin week editor uses the glass header, ink overview card, materials
    tiles, and quiz and homework panels.
  - `/admin/terms`: glass add form and editable term rows (year and term
    number stay editable so a typo never forces a cascading delete), with a
    Now badge on the running term.
- [ ] **Manual QA:** Check `/admin/subjects`, `/admin/quizzes`, a quiz in
  review, a subject's curriculum (rail open and closed), and `/admin/terms`
  at 1440px and 390px. Then open the same curriculum rail as tutor, student,
  and parent, and a tutor quiz with an admin note, and confirm they look
  right in those shells.

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
- [x] Stop invalid class times from breaking Admin -> Tutor check-ins
  (10 October 2026). Production `/admin/tutor-checkins` crashed with
  "Finish time must be after start time." because class `ENG` (Mondays,
  Liam Tran) was saved as 12:00 to 02:10, and all 19 generated lessons copied
  it. Fix: `classTimeRangeError` in `src/lib/recurring-lesson-rules.ts` is
  returned (not thrown, so the message survives production) by
  `createClass` / `updateClass` and shown in both class forms;
  `supabase/migrations/0059_time_range_guards.sql` adds
  `end_time > start_time` checks on classes, lessons, tutor availability, and
  check-in entries. The ENG class and its 19 lessons were corrected to end at
  14:10 in Production; the admin should confirm that is the real finish time.
- [ ] **Manual QA:** Open Admin -> Tutor check-ins in Production for the weeks
  of 21 Sep, 28 Sep, and 5 Oct 2026 and confirm Liam Tran's ENG rows show
  2h 10m each.
- [ ] Editing a recurring class's time does not update its already generated
  upcoming lessons (`ensureRecurringLessons` only inserts missing dates), so
  an admin cannot repair a wrong class time from the form alone. Decide how
  edits should propagate to future upcoming lessons without overwriting
  one-off lesson changes.

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
- [x] Show each student's selected profile icon, with initials as a fallback,
  on both Taiyo Blitz leaderboard views.
- [x] Add year-level and whole-of-Taiyo leaderboard views.
- [x] Add stronger correct-answer feedback, optional sound, and visual effects.
- [x] Add an in-game Close button that exits without opening another tab.
- [x] Let students choose a profile icon from a controlled icon library.
- [x] Show those profile icons to assigned tutors.
- [x] Let tutors choose their own profile icon from the top-right profile chip
  on desktop and mobile.
- [ ] QA: Sign in as a tutor, open the top-right avatar, choose several icons,
  and confirm the selected icon persists in both desktop and mobile headers.
- [x] Remove the `Open` and `Due this week` summary blocks from Student
  Homework.
- [x] Add clear colour-coded effort levels to Student Progress, with accessible
  text labels as well as colour.

## Production deployment and acceptance

- [x] Reconcile the current README, engineering handoff, feature reference,
  deployment/DNS guides, and security status with the codebase and visible
  infrastructure on 6 October 2026. See
  `docs/changes/2026-10-06-production-documentation-sync.md`.
- [x] Complete the full project documentation audit on 6 October 2026:
  inventory and classify all root, `docs/`, and generated SDD Markdown;
  correct stale current claims; add the authoritative `docs/README.md` index;
  and validate all relative documentation links. See
  `docs/changes/2026-10-06-full-documentation-audit.md`.
- [x] Verify `https://portal.taiyotuition.com` resolves to the configured Vercel
  CNAME and Vercel reports the Production deployment `Ready` with the custom
  alias attached. Code baseline at the start of the audit: `49801e0`.
- [x] Re-run `npm run typecheck`, all unit tests, and `npm run build` after
  moving the repository out of iCloud. All completed successfully on
  20 September. The documentation reconciliation pass on 6 October is also
  green: TypeScript passed, 167 tests passed across 29 files, and the Next.js
  15.5.18 production build generated all 51 static pages successfully.
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

- [x] Deploy the tutor redesign batch and apply migrations 0060, 0061 and
  0062 to Production (12 October 2026). Pushed `1fb0976`; once Vercel
  reported the Production build successful, the three migrations were applied
  (ledger 59 of 59, RLS check green). Subjects, classes, users and curriculum
  weeks were the same counts before and after (3, 3, 26, 4).
- [x] Apply `supabase/migrations/0053` through `0059` to Production
  (10 October 2026). Production had been deployed at `21a3d98` without them,
  so `/admin/subjects/[id]/curriculum` was failing with
  `column homework.solution_url does not exist`. `npm run db:status` against
  Production now reports up to date and `db:check-rls` passes.
  Dev had the 0054 index without a ledger row; it was stamped.
- [ ] Confirm the `profile-photos` bucket is private, then run the
  subject-only homework and tutor photo smoke tests with non-client accounts.
- [ ] Smoke-test admin homework creation and due-date-gated student solution
  access with non-client accounts.
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
