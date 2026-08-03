# 2026-08-03 session - backlog clearing (B7 parent display + B3 + tutor/parent features)

Branch: `feat/reschedule-credits`.
Everything below is typecheck + `npm run build` + `npm test` (72/72) green.
None of it is browser-verified yet - that is your manual QA (see the bottom).

## One thing to do before runtime testing

**Apply migration `supabase/migrations/0034_lesson_recording.sql` to Supabase.**
It adds one nullable column `lessons.recording_url`.
Until it is applied, the lesson-recording feature will error at runtime (the column does not exist).
It is additive and inherits the existing `lessons` RLS - no policy change, and it does NOT touch any other table.
Do NOT run `drizzle-kit push` (it wipes all RLS); apply this one SQL file directly.

## What shipped (newest first)

| Commit | What |
|---|---|
| `afea6df` | **Parent per-class detail page** `/parent/classes/[classId]` - class-scoped view (tutor + this child's attendance in this class + this class's feedback) + link out to the subject curriculum. Reached via a new "View class →" link on each `/parent/feedback` card. Closes the old 2026-05-27 feedback-to-class TODO. |
| `db04a22` | **B5 + cleanup** - attendance-rate / absences / lessons-logged stat strip added to the `/parent/classes` Attendance section; the dormant `/parent/attendance` route deleted. |
| `5b5f52a` | **Lesson recordings (link-based)** - tutors paste a video URL on `/tutor/lessons/[id]`; students get a "▶ Recording" marker in Recorded lessons and an inline YouTube/Vimeo player (nocookie host, added to `frame-src` CSP) with a link fallback on the recap page. **Needs migration 0034.** |
| `bb13754` | **Tutor → student announcements (per-class)** - "Announcements" card on the class hub; posts to the shared `announcements` table (class audience) and notifies every enrolled student. Notification lands in the inbox Announcements group (new `notification-groups.test.ts` case). No migration. |
| `b69f480` | **Homework edit flow** - inline "Edit homework details" form on `/tutor/homework/[id]` (`updateHomework`); edits title/due/description/flags + replace/remove attachment. Assignments + submissions untouched, so safe after submission. No migration. |
| `c6e8e4d` | **B3 restyle** - `/student/homework` + `/student/resources` migrated onto the v2 card kit + `PageHead` (the last two student pages on the legacy kit). Bespoke gradient homework cards + stat tiles left as-is. |
| `03d62a1` | **B7 parent lesson-plan display** - "What's coming up" banner on `/parent/subjects/[id]` for the selected child (mirrors the student page). No migration. |

## Decisions you made this session (for the record)

- Announcements scope: **per-class channel, students-only** (parents intentionally not notified).
- Video: **link-based embed**, not Supabase upload (free-tier storage/egress is a poor fit for video).
- Optional items: did **B5 strip**, **retire /parent/attendance**, **build /parent/classes/[classId]**; skipped **B4** (admin bolder IA cuts - no real redundancy found).

## Pending manual QA (browser - none verified yet)

Log in with the seed accounts (owner `admin@taiyo.com`/`admin`, tutor `tutor@taiyo.com`/`tutor`, student `student@taiyo.com`/`student`, parent `parent@taiyo.com`/`parent`).

### Parent
- [ ] `/parent/subjects/[id]` (reached from `/parent/classes` timetable → a lesson → "Go to subject"): when the tutor set a lesson plan, a "What's coming up" band shows above the week grid.
- [ ] `/parent/classes`: the Attendance section now has a 3-stat strip (rate / absences / logged) above the log.
- [ ] `/parent/feedback`: each card has a "View class →" link → `/parent/classes/[classId]` opens the per-class detail (header, attendance, feedback, "Curriculum & homework" link). Confirm a class the child is NOT enrolled in 404s.
- [ ] `/parent/attendance` now 404s (route retired).

### Tutor
- [ ] `/tutor/classes/[id]`: the "Announcements" card posts a title + message; it appears in the list; Delete removes it. As the class's student, confirm a notification arrives (Announcements group) and the announcement shows on the student dashboard.
- [ ] `/tutor/homework/[id]`: "Edit homework details" expands, saves title/due/description/flags, and can replace/remove the attachment; reload persists.
- [ ] `/tutor/lessons/[id]`: paste a YouTube link in the Recording card, save. **(Needs migration 0034.)**

### Student
- [ ] `/student/homework` + `/student/resources`: v2 look (eyebrow + H1 header, v2 cards); no visual regressions vs the rest of the portal.
- [ ] `/student/resources` Recorded lessons: a lesson with a recording shows "▶ Recording"; opening it plays the inline video (YouTube/Vimeo) or shows a "Watch recording ↗" link for other hosts. **(Needs migration 0034.)**

## Not done (still open in the backlog)
- B4 (admin bolder IA cuts) - left as-is per your call.
- Parent display of the lesson recording (student-only for now).
