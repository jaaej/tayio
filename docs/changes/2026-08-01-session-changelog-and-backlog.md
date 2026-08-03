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

---

## Part B - potential fixes (flagged, NOT done)

Each is optional. For each: the problem, the proposed fix, effort, risk, and my recommendation.

### B1. Dead search box in all shells  (DONE - commit 6903fc3)
- Problem: the top-bar "Search... Cmd+K" input in the admin, tutor, parent, and student shells does nothing. It is a dead affordance - the exact "gate, don't dangle" case the new CLAUDE.md rule names.
- Proposed fix (minimal): hide the search box until it is wired. One small edit per shell (4 shells), or a shared change if the shells share a header (they mostly do not).
- Proposed fix (full): build real search - a feature, larger, needs a design.
- Effort: hide = ~15 min. Build = a separate project.
- Risk: hiding is near-zero. Recommendation: **hide now**, build later if wanted.

### B2. Student's two homework homes  (recommended: decide, then I implement)
- Problem: `/student/subjects` and `/student/homework` are both full homework surfaces - duplicate "homes" for one task, which the "one home per task" rule says to resolve.
- Proposed fix: pick a canonical homework page, point all "homework" links + the nav at it, and either retire or repurpose the other (e.g. `/student/subjects` becomes purely subject/progress, `/student/homework` owns homework).
- Effort: ~1-2 hrs once you pick the canonical page.
- Risk: medium - changes what students click; needs your choice of which page wins.
- Recommendation: make `/student/homework` the homework home; make `/student/subjects` subjects-only. Confirm and I will do it.

### B3. Student restyle follow-up  (recommended: do when convenient)
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

## Part C - suggested next steps (my recommended order)
1. **You QA** the merged changes (tutor 5-tab nav + class hub + "View class" + correct "today"; admin "Dashboard"; student Resources nav; parent Attendance-in-Classes). Tell me anything off.
2. **B1 (hide dead search)** + **B6 (date sweep)** - two low-risk correctness/consistency fixes I can do without decisions.
3. **B2 + B3 (student homework home + restyle)** - after you pick the canonical homework page.
4. **B7 (remaining tutor features)** - lesson plan first (cleanest), once the portal work is settled.
5. Leave B4 (admin) and B5 (parent route) unless you want them.
</content>
