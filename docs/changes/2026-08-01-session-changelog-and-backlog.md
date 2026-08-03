# 2026-08-01 session - change log, revert guide, and backlog

Two parts:
- **Part A** logs everything changed this session so you can revert anything you dislike (git commits + database changes).
- **Part B** writes up the flagged-but-not-done ideas as concrete proposals.

Branch: `feat/reschedule-credits`. Session range: `de01c67` .. `dcae334`.
To undo a group: tell me the group and I will revert it surgically, or run the `git revert` shown (newest-first for a group).
Reverting a merge commit needs `-m 1`; I will handle the tricky ones.

---

## Part A - what changed (revert guide)

### A1. Admin credit + allowance management polish (earlier, pre-IA)
This predates this session's list but note: the admin credit-management on `/admin/users/[id]` was already built before today.

### A2. Admin tier gating + PIN model
- `4428e68` - per-feature admin gating: reception (`admin_restricted`) cannot create admin/tutor accounts or change roles; owner-only pages gated.
- `b32e326` - hide owner-only nav items (Revenue, Settings) from reception.
- `c77afd5` - **PIN model correction**: the PIN now gates *reception* from viewing Revenue; the owner has zero PIN friction anywhere.
- Revert: `git revert c77afd5 b32e326 4428e68`.
- What's lost on revert: reception would again be able to reach every admin action, and the owner would again be PIN-prompted for role changes. (Not recommended - this is the security boundary.)

### A3. Enrolment admin-notes, delivery-mode-to-tutors, all-tutors availability board
- `fb58220` - three features in one commit: per-enrolment admin notes on `/admin/classes/[id]`; the "Online/In person" pill for tutors on `/tutor/lessons/[id]`; the read-only `/admin/tutors/availability` board.
- Revert: `git revert fb58220` (removes all three).
- What's lost: those three features. `/admin/tutors/availability` route would 404.

### A4. Admin page width (fill the screen)
- `908d58d` - removed `max-w-[1400px]/[1100px]/[1200px]` caps on admin data/detail pages.
- `061da69` - widened the Settings page.
- Revert: `git revert 061da69 908d58d` to restore the capped/left-aligned layout.

### A5. Per-student leave/holiday tracking
- `af6b576` - the `student_leave` table feature (admin manages on `/admin/users/[id]`; tutor sees "On leave" pill).
- **Database (not in git):** migration `0033_student_leave.sql` was applied to Supabase (created the `student_leave` table + RLS).
- Revert code: `git revert af6b576`.
- Revert database: `DROP TABLE public.student_leave;` (and remove `student_leave` from `scripts/check-rls.mjs`). Ask me and I will do it.

### A6. Timetable data cleanup + timezone date fix  (has DATABASE changes)
- `c2e10e8` - seed `isoDate` uses local calendar date (fixes wrong-weekday lessons on re-seed).
- `73cbc05` - tutor + shared calendar date helpers use local dates (fixes "today" off-by-one on your AEST machine).
- **Database (not in git), NOT auto-reversible:**
  - Deleted 15 "QA-SEED" test lessons + their dependents (attendance, reschedules, cancellation, test credits).
  - Regenerated 91 upcoming lessons from the class slots (correct local weekday/time).
  - Shifted 107 historical lessons +1 day onto their correct weekday (attendance preserved).
- Reverting the code commits is safe. The database lesson data cannot be un-done by git; it would need a re-seed. Tell me if you want the lessons re-seeded from scratch.

### A7. CLAUDE.md intuitive-navigation rule
- `0610245` - added the "Intuitive navigation & information architecture" section to CLAUDE.md (+ the tutor IA spec).
- Revert: `git revert 0610245` removes the rule from CLAUDE.md (and the tutor spec). The tutor code changes below are separate.

### A8. Tutor IA redesign
- `08a6915` - nav trimmed 8 -> 5 (removed Attendance/Quizzes/Notes tabs).
- `35bba6a` - new single-page class hub `/tutor/classes/[id]`.
- `463f34d` - "Today's classes" + "View class" callout on the tutor dashboard.
- `7829564` - quiz editing moved into the curriculum week, locked until admin-requested.
- `0a482d2`, `b3f9364` - checklist + plan docs.
- Revert the whole tutor IA: `git revert 7829564 463f34d 35bba6a 08a6915`.
- What's lost: the 5-tab nav returns to 8 (Attendance/Quizzes/Notes tabs come back), the class hub route goes away, and quiz editing returns to the (dormant) Quizzes tab. The underlying pages were never deleted, only unlinked, so this reverts cleanly.

### A9. Student / Parent / Admin IA redesign (conservative, review-gated)
- Merged: `6fe76d4` (admin: "Operations"->"Dashboard" nav label), `78c0327` (student: Resources in nav + fixed "All homework" link), `26a814d` + `aef2e58` (parent: Attendance tab folded into Classes + scroll-offset fix).
- `dcae334` - checklist record.
- Revert one portal:
  - Admin label only: `git revert 6fe76d4 -m 1`.
  - Student: `git revert 78c0327 -m 1`.
  - Parent: `git revert aef2e58` then `git revert 26a814d -m 1`.
- What's lost: the respective nav tweak. All are tiny; ask me and I will revert cleanly.

### A10. Test account (database, not in git)
- Created `reception@taiyo.com` / `reception` (role `admin_restricted`) so you can QA the reception tier.
- Remove it any time from `/admin/users` (deactivate) or ask me to delete it.

### A11. Remove dead search box from all shells (B1)
- `6903fc3` - removed the non-functional "Search... Cmd+K" input from the admin/tutor/parent/student shells (+ each unused `Search` import).
- Revert: `git revert 6903fc3` restores the (dead) search boxes.

### A12. Date-convention sweep - student/parent/admin/curriculum (B6)
- `a543242` - "today"/date-range query keys now use local calendar dates instead of `toISOString().slice(0,10)` (off-by-one on AEST). Files: admin queries/reports/attendance, parent/_data, student queries, shared `curriculum.ts` term resolution. `reports-queries.dayAfter` left as intentional UTC arithmetic.
- Revert: `git revert a543242` restores the old UTC-keyed convention (dev-only off-by-one on AEST).

### A13. Student homework consolidation (B2)
- `abd3cd2` - added a "Homework" item to the student nav pointing at `/student/homework` (previously the actionable homework list had no nav entry). Removed the duplicate Overdue + Marked homework list cards from `/student/subjects`; that page keeps its due-date calendar as an at-a-glance overview (relabelled "Homework due dates", links to the homework list).
- Revert: `git revert abd3cd2`. Restores the old state (no Homework nav item; duplicate homework lists back on My subjects).

### A14. Lesson plan - tutor edit + student display (B7)
- `a6f79ad` - tutors edit a per-class forward-looking plan on /tutor/classes/[id] (wires the dead classes.lesson_plan column; updateLessonPlan action; no migration).
- `(this commit)` - students see it as a "What.s coming up" banner on /student/subjects/[id].
- Parent display deferred (needs a considered slot). Revert: `git revert` the two commits.

---

## Part B - potential fixes (flagged, NOT done)

Each is optional. For each: the problem, the proposed fix, effort, risk, and my recommendation.

### B1. Dead search box in all shells  (DONE - commit 6903fc3)
- Problem: the top-bar "Search... Cmd+K" input in the admin, tutor, parent, and student shells does nothing. It is a dead affordance - the exact "gate, don't dangle" case the new CLAUDE.md rule names.
- Proposed fix (minimal): hide the search box until it is wired. One small edit per shell (4 shells), or a shared change if the shells share a header (they mostly do not).
- Proposed fix (full): build real search - a feature, larger, needs a design.
- Effort: hide = ~15 min. Build = a separate project.
- Risk: hiding is near-zero. Recommendation: **hide now**, build later if wanted.

### B2. Student.s two homework homes  (DONE - commit abd3cd2)
- Problem: `/student/subjects` and `/student/homework` are both full homework surfaces - duplicate "homes" for one task, which the "one home per task" rule says to resolve.
- Proposed fix: pick a canonical homework page, point all "homework" links + the nav at it, and either retire or repurpose the other (e.g. `/student/subjects` becomes purely subject/progress, `/student/homework` owns homework).
- Effort: ~1-2 hrs once you pick the canonical page.
- Risk: medium - changes what students click; needs your choice of which page wins.
- Recommendation: make `/student/homework` the homework home; make `/student/subjects` subjects-only. Confirm and I will do it.

### B3. Student restyle follow-up  (DEFERRED - see note)
- DEFERRAL NOTE: on inspection /student/homework is already an elaborate, intentional design (subject-coloured cards, stat tiles, custom title strip) - not a plain legacy page. Restyling it to the student v2 card kit is a design decision (which aesthetic wins), not a mechanical import swap, and needs visual review in a browser. Do it as a deliberate pass, not a rushed edit.
- Problem: `/student/resources` and `/student/homework` still use the legacy `@/components/ui/card` kit, not the restyled `@/components/student/card` - visible inconsistency now that both are promoted in the nav.
- Proposed fix: restyle both pages to the student v2 card kit.
- Effort: ~1 hr. Risk: low (visual only). Recommendation: bundle with B2.

### B4. Admin bolder IA cuts  (recommended: leave as-is unless you want it)
- The admin audit found no true tab redundancy. Bolder ideas exist (fold Quizzes authoring into curriculum like tutor; split the 7-item Operations section; move Settings out of "Insight") but all are opinionated.
- Recommendation: **leave admin as-is**; revisit only if a specific admin flow annoys you.

### B5. Parent - retire dormant route / add attendance strip  (recommended: optional)
- `/parent/attendance` is dormant (unlinked) after folding Attendance into Classes. Leaving it is harmless; deleting it is a cleanup.
- Optional: an attendance-rate summary strip on `/parent/classes` would make attendance fully discoverable there.
- Recommendation: optional; low priority.

### B6. Date-convention sweep (student/parent/admin)  (DONE - commit a543242)
- Problem: student/parent/admin query files still key "today"/date-ranges via `toISOString().slice(0,10)`, which is off-by-one on your AEST dev machine (correct on a UTC production server). Tutor + shared calendars are already fixed.
- Proposed fix: replace those sites with the local-date helper, consistent with the tutor fix.
- Effort: ~30-45 min. Risk: low-medium (touches query bounds; I will verify). Recommendation: **do it** for local-QA correctness and production-robustness.

### B7. Remaining tutor checklist features (not IA)
- **Lesson plan** (`classes.lesson_plan` dead column) - tutor edits a "what's coming up" per class; needs student/parent display (cross-portal). Effort: medium.
- **Tutor -> student announcements** - a per-tutor announcement channel; touches shared notifications. Effort: medium.
- **Upload videos** - needs a Storage bucket + upload pipeline. Effort: large, needs an infra decision.

---

## Part C - NEXT TASK (start here)

**Immediate next task: finish B7 - the PARENT display of the lesson plan.**
The tutor edit (`/tutor/classes/[id]`) and student display (`/student/subjects/[id]` "What's coming up" banner) are built (A14).
Only the parent view is left: surface a class's `classes.lesson_plan` to the parent for the selected child.
Suggested placement: a "What's coming up" card on the parent progress page or the parent classes view, per the selected child's class(es).
The data helper to model on: `getStudentCurriculum` (student side) threads `lessonPlan` from `classes.lessonPlan`; do the parent equivalent via the parent's child -> enrollment -> class.
No migration needed.

**After that, in rough priority:**
1. B3 - restyle `/student/homework` + `/student/resources` to the student v2 card kit (DEFERRED - do with the dev server up so you can see it; the homework page is already an elaborate design, so this is a judgment call, not a swap).
2. Other tutor checklist features (B7 group): tutor -> student announcements (touches shared notifications); homework EDIT flow (fully tutor-side, closes the "Class test/booklet mark" gap); video upload (needs a Storage-bucket + pipeline decision - do not start without that decision).
3. Optional / owner-choice: B4 (admin bolder IA cuts - agent found no real redundancy, leave unless wanted), B5 (retire dormant `/parent/attendance`; attendance-rate strip on Classes).
4. Old TODO unrelated to this session: `/parent/classes/[classId]` per-class page does not exist (parent feedback deep-link).

## Part D - PENDING MANUAL QA (browser checks - none of this is verified in a browser yet)

Run the dev server (owner starts it; do not start it unsolicited) and log in with the seeded accounts:
owner `admin@taiyo.com`/`admin`, reception `reception@taiyo.com`/`reception`, tutor `tutor@taiyo.com`/`tutor`, student `student@taiyo.com`/`student`, student-unrestricted `student.pro@taiyo.com`/`student`, parent `parent@taiyo.com`/`parent`.

### Tutor
- [ ] Nav shows exactly 5 main items: Today, Classes, Students, Marking, Resources (no Attendance/Quizzes/Notes; no search box in the top bar).
- [ ] Today: on a class day a "Today's classes" callout shows the class; "View class" opens the lesson to mark attendance. "Today" resolves correctly (date fix - was off by one on AEST).
- [ ] Classes -> a class opens the hub `/tutor/classes/[id]`: this-lesson attendance callout, a "Lesson plan" card (type -> blur -> "Saved" -> reload persists), Curriculum + Homework actions, and the student roster.
- [ ] Delivery mode: set a student to Online in `/admin/classes/[id]`; on `/tutor/lessons/[id]` that student shows an "Online" pill; a default student shows none.
- [ ] Leave: add a leave period on a student in `/admin/users/[id]` covering a lesson date; the tutor lesson page shows an amber "On leave" pill for that student.
- [ ] Quiz: a curriculum week with no requested quiz shows a greyed "Edit quiz". As admin, request a quiz for that subject-week -> tutor gets a "Quiz requested" notification -> that week's "Edit quiz" is now enabled and opens the maker.

### Admin
- [ ] Owner (`admin@taiyo.com`): set a PIN in `/admin/settings`; then view `/admin/revenue` (no prompt), change a user's role, deactivate/reactivate an account - all with NO PIN prompt.
- [ ] Reception (`reception@taiyo.com`): no "Settings" nav item; `/admin/settings` redirects to `/admin`; "Revenue" IS in nav and shows a PIN prompt (enter the owner's PIN to view); create-user form has no Admin/Tutor role options; a user's Role dropdown is disabled with the owner-only note (stays disabled even after entering the revenue PIN).
- [ ] Nav item for `/admin` reads "Dashboard" (not "Operations").
- [ ] Data pages (Users, Classes, etc.) fill the screen width (no big empty gap on the right).
- [ ] `/admin/classes/[id]`: per-enrolment "Admin notes" (type -> blur -> Saved -> reload persists; not visible to student/parent).
- [ ] `/admin/tutors/availability`: tutor x weekday board renders with per-day "N free" counts.
- [ ] `/admin/users/[id]` (student): "Leave / holidays" add/remove works.

### Student
- [ ] Nav has "Homework" (-> `/student/homework`) and "Resources" items; no search box.
- [ ] `/student/subjects` ("My subjects") no longer shows duplicate Overdue/Marked homework list cards; it has a "Homework due dates" calendar overview that links to the homework list.
- [ ] `/student/subjects/[id]`: when the tutor set a lesson plan, a "What's coming up" banner shows it.
- [ ] Timetable / "this week" and "today" resolve to the correct dates (date fix).

### Parent
- [ ] No "Attendance" nav tab; `/parent/classes` has an "Attendance" section; from Overview, clicking the attendance KPI scrolls to it with the "Attendance" heading fully visible (not clipped under the sticky header).

### Cross-cutting
- [ ] Tutor and admin timetables agree (same day + time per class; Year 9 Maths is Saturday 10:00). No off-grid times, no phantom lessons.
- [ ] Notification inbox renders the same grouped layout across all four roles.

### Database state already applied (no action needed, just be aware)
- Migration `0033_student_leave.sql` applied to Supabase; `db:check-rls` green (43/43).
- Lesson data cleaned + regenerated timezone-safe (see A6).
- Test account `reception@taiyo.com` created.
