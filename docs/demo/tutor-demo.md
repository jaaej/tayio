# Tutor portal demo

A runthrough for showing a new tutor how to use the portal, with demo data behind every step.
The data lives on the **dev** database only and is built by `scripts/tutor-demo/seed.mjs`.
No real family, no email and nothing in production is involved.

## Before the demo

### The morning of

1. Run the seed from the repo root:

   ```sh
   node scripts/tutor-demo/seed.mjs
   ```

   It takes about a minute.
   It wipes the previous demo data and rebuilds it around today's date, so today's lesson, the overdue homework and the to-do list are always current.
   It finishes with a summary of what it built.
2. Re-running is also the reset.
   Everything done in a rehearsal (marking, attendance, notes, replies, claims) is wiped and rebuilt.
3. Every run resets the demo passwords, which signs all demo accounts out.
   Sign in again after a run.
4. Start the app (see "Which browser" below) and sign in as `tutor@taiyo.com` / `demo1234`.

`node scripts/tutor-demo/seed.mjs --wipe` removes the demo data without rebuilding it.

### Which browser

Present from a production build in **Chrome**:

```sh
npm run build
npm run start
```

Then open http://localhost:3000.
Stop `npm run dev` first; the build and the dev server share the `.next` folder.

Why: on the dev server every page compiles the first time it opens, which takes 30 seconds to 3 minutes per page on an 8 GB Mac, and pages left idle for a minute are compiled again.
A production build opens every page in about a second.

Why not Safari: the production build sends `upgrade-insecure-requests`, and Safari applies it to `http://localhost`, so scripts load over https, fail, and the page never becomes interactive.
Chrome exempts localhost.
The deployed site is https, so this only affects a local build.

### The date window

The seed builds inside the dev term that covers today.
Dev **Term 4 2026 runs 12 October to 13 November**.
For a demo after 13 November, add or extend a term at `/admin/terms` (signed in as an admin), then re-run the seed.
The seed stops with that instruction if no term covers today.

### Accounts

| Who | Sign in as | Password |
| --- | --- | --- |
| Tom Tutor, the demo tutor | `tutor@taiyo.com` | `demo1234` |
| Maya Collins, a colleague (her class is on the cover board) | `maya.collins@example.com` | `demo1234` |
| Any demo student or parent | `first.last@example.com`, e.g. `ethan.lim@example.com`, `grace.lim@example.com` | `demo1234` |
| Admin | your usual dev admin account | unchanged |

The old dev `tutor@taiyo.com` account, with all its QA classes and history, was moved to `qa.tutor@taiyo.com` on 29 October 2026.
Its password did not change.

Sign-in allows 5 attempts per email in 15 minutes.
Re-running the seed clears the limit for the demo accounts.

## The cast

Tom teaches three classes.

| Class | When | Students |
| --- | --- | --- |
| Y8 Mathematics · Thursday PM (or the weekday the seed runs) | **today**, 4:30 - 6 pm, Room 1 | Ethan Lim, Olivia Park, Noah Williams, Ava Thompson, Lucas Nguyen, Zara Ahmed |
| Y9 English · Tuesday PM | two days ago, 4:30 - 6 pm, Room 2 | Mia Rossi, Jack O'Brien, Sophie Chen, Leo Martin |
| VCE Methods 1/2 · Friday PM | tomorrow, 5 - 6 pm, online, one-on-one | Chloe Tan |

The class names follow the weekday the seed runs on: the Y8 class is always today, Y9 two days back and VCE tomorrow.

Who is who in the stories:

- **Ethan** keeps forgetting to multiply into brackets.
  His worksheet has Q4 and Q7 wrong for that reason, he asked about Q4 on the discussion board, and his mum **Grace Lim** messaged Tom about it.
- **Olivia** and **Mia** are strong students; their term reports are already written.
- **Noah** hands work in late; last fortnight's homework is waiting on a resubmission.
- **Ava** missed a lesson two weeks ago and typed her answers instead of uploading a file.
- **Lucas** has not started this week's homework.
- **Zara** is on a free trial that started a week ago.
- **Leo** has leave booked for next week.
- **Chloe** is the one-on-one VCE student; her factor-theorem working goes wrong in the last step of Q4, and she messaged Tom to ask for exam practice.

## The runthrough

The order follows a tutor's working day: see what needs doing, teach, follow up, then the admin side of the job.
Each step says what to click, what to point out, and what the demo data shows.

### 1. Today: the tutor's home

**Today** in the sidebar.

- The **To do** list is everything waiting on Tom, each with one button that goes straight to it: submissions to mark, a lesson to finish, a requested quiz, a quiz sent back for changes, hours to confirm, term reports, and a class that needs cover.
- The **Today** card is today's lesson, with this week's topic and **Open lesson**.
- **This week** is the timetable for the week.
- Below it: students with overdue homework (with **Send reminder**) and the most recent lesson notes.

Point out: nothing needs hunting through menus; the home page routes to the work.

### 2. Teach today's lesson

**Open today's lesson** (top right, or on the Today card).

- **Attendance**: **All present**, then change one student (for example Lucas to **Late**), then **Save attendance**.
- **Class recording**: paste a video link and **Save link**; students watch it from Class recordings.
- **Lesson notes**: one student at a time, picked from the name pills.
  The green box is the **Comment** the **parent and student** see; the amber box is the **Internal note**, **only you and admin**.
  Both are optional: write Ethan's comment, then **Save & next student**.
  Saving both boxes empty removes the note.
- The header's **Week N plan** (this week's number) opens that week of the class's course.

Point out: a lesson is finished once attendance is saved for the whole class; notes are optional.
Until then it stays on the to-do list.

### 3. Finish a lesson you missed

From **To do**, "1 lesson needs finishing" → **Mark attendance**.
It opens the Y9 English lesson from two days ago with no attendance.
Mark it and **Save attendance** to show the to-do clearing.

### 4. Mark homework

**Marking** in the sidebar (the badge is the number waiting).

- **Ethan, Linear equations practice set**: his PDF opens in the marking viewer.
  Circle Q4 and Q7 with the pen or add a comment, then give a score and feedback and mark it.
  The worksheet and the solutions are attached to the homework, so the answers are one click away.
- **Noah**: handed in late, shows how lateness is flagged; use it to show **request resubmission**.
- **Ava**: a typed answer instead of a file.
- **Y9 essays** (Jack, Sophie, Leo late) and **Chloe's** VCE problem set (Q4 is wrong) are there too.

Point out: marked work and feedback go back to the student and parent straight away.

### 5. Set homework

**Classes** → **Y8 Mathematics** → **Week plan** → **Add homework**.
Give it a title and a due date, attach a file if you like, and save.
Homework belongs to a week of the course, next to that week's booklet and quiz, and sits on top of the homework admin set.

### 6. Classes and students

**Classes** → **Y8 Mathematics**.

- **Week plan**: this week's overview, booklet and video, the quiz and homework.
- **Lessons**: every lesson with its attendance; past lessons open with **View**.
- **Students**: the roll with attendance rates.
  Open **Ethan** for his attendance, homework, scores and notes on one page, with **Message student** and **Message parent**.
  Open **Zara** to show the **Free trial** tag.
- **Announcements**: post to the class; admin approves each one before it is sent.
  "Bring your booklet this week" is already published.

### 7. Quizzes

Two quizzes are waiting on Tom, both on the to-do list.

- **Quiz requested: Y8 Mathematics, Week 4** ("Unknowns on both sides"): admin asked Tom to write it, with instructions at the top.
  Add a few multiple-choice questions, then **Submit for review**.
- **Quiz changes requested: VCE Methods 1/2, Week 4** ("Solving cubic equations"): admin's note says Question 3 has two correct options.
  Fix it and submit again.

Point out: tutors write quizzes, admin reviews them, and students only see a quiz once it is approved.

### 8. Resources

**Resources**: the shared library by subject (a formula sheet, a TEEL essay planner, a Khan Academy video from Maya).
The **+** beside a subject adds a resource to it: pick **Upload file** or **Paste link** as the source.
The **Shared** switch controls whether students see it, and the search box finds a resource by name.

### 9. Term reports

**Term reports**: one short summary per student per term, grouped by class.
Olivia's, Mia's and Chloe's are written; write Ethan's to show it.
Reports open three weeks before the term ends.

### 10. Schedule and time away

**Schedule & availability** in the sidebar.

- The month calendar shows every lesson.
- **Your regular week** is when Tom can teach; **Edit hours** changes it, and it decides which cover requests fit him.
- **Request time away** puts a lesson on the cover board for another tutor.
  One is already there: Fri 13 Nov, VCE, "Family wedding interstate", marked **Needs cover**.

### 11. Cover board

**Cover board**: lessons other tutors need covered.
Maya's Y8 class on Sunday needs cover, with her handover note.
Claim it to show it moving onto Tom's timetable on Today and Schedule.
The board lists every tutor's open covers in every subject; one that clashes with Tom's own lessons has no claim button.
Tom has already covered one of her lessons the week after (it shows as confirmed in Notifications).

### 12. Weekly check-in

**Weekly check-in**: each week's lessons and hours, which payroll uses.
19 - 25 Oct is waiting: $180 for 4 hours over 3 lessons, with each lesson on the week's calendar.
**Approve these hours**, or **Something's wrong** to tell admin what to fix.
A lesson admin corrected is outlined and marked **Corrected**, and the footer says what changed.

### 13. Discussions

**Discussions**: a board per subject, plus General help.
Two questions have no reply: Ethan's brackets question (Y8) and Sophie's "Can we use 'I' in a persuasive essay?" (Y9).
Reply to Ethan's; a tutor's reply is tagged **Tutor answer** and Ethan gets a notification that opens the thread.
**Other questions** beside the thread lists the board's other questions; **Unanswered** shows the ones still waiting, and the arrow folds the list away.

### 14. Messages

**Messages**: direct messages with students, parents and admin.
Grace Lim and Chloe Tan are unread.
Reply to Grace about Ethan's brackets.

### 15. Notifications

**Notifications**: everything in date order (Today, This week, Earlier), each labelled Message, Action needed, Learning, Announcement or Update.
The pills filter by kind.

### 16. Profile

The name chip at the bottom of the sidebar → profile: photo or icon, and the teaching details admin set.

## What a tutor should leave knowing

- You see only your own classes and students, plus lessons you cover.
- The green comment goes to families; the amber internal note stays with you and admin.
- A lesson is done when attendance is saved; notes are optional.
- Announcements and quizzes go to admin for approval first.
- Your pay comes from the hours you approve in Weekly check-in.
- Away? Request time away; the lesson goes on the cover board and admin confirms who covers it.

## Known demo-data quirks

- The General help board also shows an older dev QA thread ("portal help" from Sarah Student).
- On a class's **Lessons** tab, older lessons that fall outside any dev term show their time where the term week would be.
  Dev has no Term 3, so everything before 12 October is between terms.
  The app schedules weekly classes all year, so this matches how real data looks.
