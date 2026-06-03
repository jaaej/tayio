# Implementation Checklist

Cross-references the role spec against the actual codebase.
Last audit: 2026-05-27.

**Tick legend** (the `FE` and `BE` columns):

- ✅ done — wired end-to-end, real data, usable
- 🔶 partial — UI exists but stub, OR backend exists but no UI, OR feature works for one case but not the spec'd full case
- ⬜ not built

Things marked **(extra)** are implemented in the portal but weren't in the original role spec — keeping them visible so you don't accidentally retire them.

---

## Admin

| Feature | Function | FE | BE | Notes |
|---|---|---|---|---|
| Attendance marking | UI to mark presence/late/absent | ⬜ | ✅ | Admin has no attendance UI. Tutors mark attendance (`/tutor/lessons/[id]`). Admin can only see it in reports — and reports is a stub. |
| Class management | Create class slots | ✅ | ✅ | `/admin/classes` + `/admin/classes/[id]` |
| Enrolment management | Onboard students | ✅ | ✅ | `/admin/enrolments` |
| Payment management | Manage payments | ✅ | ✅ | `/admin/payments` (manual mark-as-paid; no Stripe yet) |
| Announcements | Portal-wide announcements with audience scoping | ✅ | ✅ | `/admin/announcements` |
| Reporting to parents/tutors | Attendance + payment reports | 🔶 | 🔶 | `/admin/reports` is a stub ("Coming in Phase 3"). Underlying data (attendance, invoices) is queryable; nothing aggregates it yet. |
| Resource control | Manage uploaded resources, approval workflow | ⬜ | ⬜ | No `resources` table, no upload pipeline, no approval queue. |
| Create accounts | Role-specific account creation | ✅ | ✅ | `/admin/users` + `/admin/users/[id]` |
| Tutor management — availability | View / coordinate tutor availability | 🔶 | ✅ | Tutors set their own availability at `/tutor/timetable` ("Manage availability" toggle on the monthly grid). Backend: `tutor_weekly_availability` table + `getAvailableSlots` query, already consumed by the parent reschedule flow + admin one-off reschedule UI. **Gap:** admin has no UI to view/edit *other* tutors' availability across the roster — needs a `/admin/tutors/availability` board so reception can spot gaps + coordinate cover. |
| Tutor management — auto-find replacements | Auto-message + replacement on tutor leave | ⬜ | ⬜ | Not built. Would need messaging layer + matching logic. |
| `admin_restricted` (reception) | Lower-tier admin with no access to sensitive financials | ⬜ | ⬜ | `userRoleEnum` has only one `admin` value. See [Role Tiering](#role-tiering-student--admin) for full permission matrix. |
| `admin_unrestricted` (owner) | Full admin with all access | ⬜ | ⬜ | Same — current single `admin` role is effectively "full" by default. See [Role Tiering](#role-tiering-student--admin). |
| **(extra) Operations dashboard** | Stat tiles, alerts, recent activity | ✅ | ✅ | `/admin` |
| **(extra) Family links UI** | Parent ↔ child relationship editor | ✅ | ✅ | On user detail page |
| **(extra) Direct messaging** | 1:1 DMs with anyone via directory | ✅ | ✅ | `/admin/messages` — categorized directory (parents/tutors/students) + "Message" button on `/admin/users/[id]` (shipped 2026-05-27) |
| **(extra) Discussions oversight** | View + soft-delete on every subject board | ✅ | ✅ | `/admin/discussions` (shipped 2026-05-27) |

---

## Tutor

| Feature | Function | FE | BE | Notes |
|---|---|---|---|---|
| Class timetable | Show enrolled class times | ✅ | ✅ | `/tutor` dashboard + `/tutor/classes` (weekly snapshot) + `/tutor/timetable` (monthly grid: classes as amber pills, availability as green pills, "Manage availability" toggle for edit mode). Consolidated 2026-06-03 — previously split across `/tutor/schedule` + `/tutor/availability`. |
| Student discussion page | Answer post-class questions | ✅ | ✅ | `/tutor/discussions` — per-subject Q&A boards (shipped 2026-05-27) |
| Lesson plan | Update what's *going* to be covered | ⬜ | ⬜ | `lesson_notes.nextLessonFocus` exists (per-lesson, *retroactive* — "what to focus on next time"). No forward-looking class-level plan field. |
| Class test / booklet mark | Update marks for parents/students to see | 🔶 | 🔶 | Homework marking (with `score`, `feedback`) covers most of this. No distinct "test" entity separate from homework. |
| Resource page | Upload booklets for students/parents | ⬜ | ⬜ | No resource library schema. |
| Homework marking | Mark submissions, leave feedback, request resubmission | ✅ | ✅ | `/tutor/homework`, `/tutor/homework/[id]` |
| Upload videos | Class recordings auto-uploaded | ⬜ | ⬜ | No upload pipeline, no Storage bucket for videos. |
| Discussion page (separate row in your spec) | Homework-help inbox | ✅ | ✅ | Covered by `/tutor/discussions` (shipped 2026-05-27) |
| Tutor → student announcements | Mass-message own students | ⬜ | ⬜ | Only admins can post announcements; no per-tutor channel. |
| **(extra) Attendance marking** | Mark per-lesson attendance + notes | ✅ | ✅ | `/tutor/lessons/[id]` |
| **(extra) Lesson notes** | Parent-visible + internal split | ✅ | ✅ | `/tutor/notes`, `/tutor/lessons/[id]`. Strict separation enforced in queries. |
| **(extra) Student profile** | Attendance / homework / lesson-note history per student | ✅ | ✅ | `/tutor/students/[id]` |
| **(extra) Tutor availability** | Weekly recurring slot picker, used by parent reschedule flow | ✅ | ✅ | `/tutor/timetable` "Manage availability" toggle. Sync verified: same rows feed parent reschedule + admin one-off reschedule (`src/lib/availability.ts` → `getAvailableSlots`). Per-day "isolate" button on each cell detaches that specific date from the recurring weekly rules — once isolated, the day's pills edit a date-specific availability set that doesn't ripple back to other weeks, and weekly rule changes won't reach the isolated date until it's re-linked. Both states (recurring + per-date) surface identically to admins/parents via the same query. |
| **(extra) Direct messaging** | 1:1 DMs with admin + students + parents of taught students | ✅ | ✅ | `/tutor/messages` (shipped 2026-05-27). Entry: "Message student" on `/tutor/students/[id]`. |

---

## Student

| Feature | Function | FE | BE | Notes |
|---|---|---|---|---|
| Upcoming classes | Timetable view | ✅ | ✅ | `/student/timetable` + dashboard "This week" calendar |
| Homework upload | Submit due homework | ✅ | ✅ | `/student/homework`, `/student/homework/[id]` with file submission to Supabase Storage |
| Grade page | Track score, compare between students | 🔶 | 🔶 | `/student/progress` shows mastery + per-subject + per-topic. **No peer comparison / leaderboard** — that piece of the goal is not built. |
| Resources page | Booklets, recorded videos, past papers | 🔶 | ⬜ | `/student/resources` exists with **hardcoded** category cards. No `resources` table; nothing to populate the page with real material. |
| Discussion page | Ask homework questions | ✅ | ✅ | `/student/discussions` — per-subject + general help board (shipped 2026-05-27) |
| `student_restricted` (parent-dependent) | Younger students — parent owns payments, reschedules, admin contact | ⬜ | ⬜ | One `student` role. No tiering. See [Role Tiering](#role-tiering-student--admin) for full permission matrix. |
| `student_unrestricted` (self-managed) | Older / independently enrolled — gets parent-style features on own account | ⬜ | ⬜ | Same — single student role. Currently independent students still can't see payments. See [Role Tiering](#role-tiering-student--admin). |
| **(extra) Student dashboard** | Next class, due homework, mastery, recent grades, announcements | ✅ | ✅ | `/student` |
| **(extra) Lesson recap viewer** | Read parent-visible tutor note for a past lesson | ✅ | ✅ | `/student/lessons/[id]` |
| **(extra) Subject deep-dive** | Per-subject mastery + topic list | ✅ | ✅ | `/student/subjects/[id]` |
| **(extra) Direct messaging** | 1:1 DMs with tutors + admin | 🔶 | ✅ | `/student/messages` (shipped 2026-05-27). Inbox + thread view work; **no entry point on student dashboard yet** to initiate from (memory: project_pending_student_dm_entry). |
 
---

## Parent

You didn't include a parent table — adding it so the picture is complete.

| Feature | Function | FE | BE | Notes |
|---|---|---|---|---|
| Dashboard overview | Child's attendance, homework, latest feedback, payment status | ✅ | ✅ | `/parent` |
| Child switcher | Switch between multiple linked children | ✅ | ✅ | Uses `family_links` |
| Classes view | Calendar + attendance log + reschedule entry point | ✅ | ✅ | `/parent/classes` (combined attendance + bookings on 2026-05-26) |
| Reschedule a class | In-calendar flow: pick lesson → pick slot from same-subject tutors → optional reason | ✅ | ✅ | Submits to admin as in-app notification. No actual lesson-swap automation. |
| Homework view (read-only) | Track child's homework completion | ✅ | ✅ | `/parent/homework` |
| Tutor feedback feed | Parent-visible comments only; localStorage read/unread | ✅ | ✅ | `/parent/feedback` + "From the tutor" block on dashboard |
| Progress page | Per-subject mastery + topics + attendance + homework | ✅ | ✅ | `/parent/progress` (added 2026-05-26) |
| Payments | View invoices, statuses | ✅ | ✅ | `/parent/payments` (read-only; no online pay yet) |
| Online payment | Pay invoice via Stripe/etc. | ⬜ | ⬜ | Stub link exists; no payment processor wired. |
| Direct message tutor / admin | Per PRD §11 — message categories routed to right person | ✅ | ✅ | `/parent/messages` — 1:1 DMs with kids' tutors + admin (shipped 2026-05-27). Entry points on parent dashboard contact block. Student dashboard contact card still pending (memory: project_pending_student_dm_entry) |
| **(extra) Outstanding-balance stat** | Surfaced on dashboard | ✅ | ✅ | |

---

## Cross-cutting (not in your role spec, worth tracking)

| Feature | FE | BE | Notes |
|---|---|---|---|
| Auth (Supabase) | ✅ | ✅ | Login, password reset, role-gated middleware |
| Role-based routing | ✅ | ✅ | `middleware.ts` + `requireRole` per layout |
| Notifications inbox | ⬜ | 🔶 | `notifications` table exists, write helpers exist (reschedule fires one). No in-app inbox UI to read them. |
| Email delivery | ⬜ | ⬜ | No Resend/SES wired. Notifications stay in-app only. |
| RLS policies | ⬜ | ⬜ | Every table is currently readable by anon JWT. Brief exists at `docs/briefs/security-rls-brief.md` but unbuilt. **Security risk** until built. |
| Audit logs | ⬜ | ⬜ | No `audit_log` table. Admin destructive actions are untracked. |

---

## From the 2026-05-26 Excel-vs-portal audit

These are operational admin gaps where the admin still relies on the spreadsheet. Roughly in priority order.

| Gap | FE | BE | Notes |
|---|---|---|---|
| Per-enrolment admin notes (`T3INV`, `MOVE CLASS BY NW`, `HOLS 03/07 - 10/07`) | ⬜ | ⬜ | **P0.** Single-column add to `enrollments` + admin edit UI replaces ~80% of Excel daily use. |
| `school` field on student profiles | ⬜ | ⬜ | **P0.** Excel tracks Wesley, Mount Waverly Secondary, Glen Waverly Secondary, etc. |
| Students Leaving admin view | ⬜ | 🔶 | `enrollments.withdrawnAt` exists; no admin list view + follow-up note flow. |
| Primary-contact toggle on `family_links` | ⬜ | ⬜ | VCE student vs younger student — who's the main contact differs by age. |
| Per-student delivery mode within shared class (online/in-person) | ⬜ | ⬜ | One student joins online while others same lesson are in-person — currently not expressible. |
| Per-student leave/holiday tracking | ⬜ | ⬜ | Excel encodes as `HOLS 03/07 - 10/07 + 10/08`. Without it tutors mark absent every day during a known holiday. |

---

## Role Tiering (student & admin)

Drafted 2026-05-27. The current `userRoleEnum` has flat values: `admin | tutor | parent | student`. This section specs splitting `admin` and `student` into two tiers each. **Not yet implemented.** Tutor and parent are unchanged.

Target enum: `admin_unrestricted | admin_restricted | tutor | parent | student_unrestricted | student_restricted`.

### Student tiers

- **`student_restricted`** — younger students still dependent on a parent. Current student-portal scope is correct for this tier (no payments, no rescheduling, no admin contact). Parent owns those flows via their own account.
- **`student_unrestricted`** — older / independently enrolled students (typically VCE or post-secondary) who manage their own account. Gets selected parent-portal features on the student account itself. A linked parent may still exist if the student wants — see "Coexistence with linked parent" below.

| Feature | `student_restricted` | `student_unrestricted` | Source |
|---|---|---|---|
| Homework view + submit | ✅ | ✅ | existing |
| Timetable | ✅ | ✅ | existing |
| Lesson recap viewer | ✅ | ✅ | existing |
| Resources / progress / subject deep-dive | ✅ | ✅ | existing |
| Discussion / homework help | ✅ (when built) | ✅ (when built) | existing |
| **Payments view (own invoices)** | ❌ | ✅ | from parent portal |
| **Online payment** | ❌ | ✅ | from parent portal |
| **Reschedule own lesson** | ❌ | ✅ | currently parent-only |
| **DM admin / tutor** | ❌ | ✅ | from parent portal |
| **Outstanding-balance stat on dashboard** | ❌ | ✅ | from parent portal |
| Tutor feedback feed (parent-visible only) | ✅ | ✅ | already visible to student |
| Switch between other children's profiles | ❌ | ❌ | parent's child-switcher does NOT carry over — students only ever see self |

#### Coexistence with linked parent

A `student_unrestricted` account can still have a parent linked via `family_links` if both parties want. When both exist:

- Both see the same invoices, reschedules, attendance, feedback.
- `family_links.is_primary_contact` (proposed — see gap row above) decides who receives billing notifications and who admin contacts first.
- Either party can act on a reschedule / payment; admin sees who initiated.

If no parent is linked, the student is the de facto primary contact.

### Admin tiers

- **`admin_restricted`** — reception / front-desk / lower-tier admin. Daily operations only; no access to financial controls, role escalation, or audit logs.
- **`admin_unrestricted`** — owner and high-level employees. All access including financials, role management, audit logs.

| Feature | `admin_restricted` (reception) | `admin_unrestricted` (owner) |
|---|---|---|
| Operations dashboard | ✅ but **revenue tile hidden** | ✅ full |
| Create student / parent accounts | ✅ | ✅ |
| Password reset (student / parent / tutor) | ✅ | ✅ |
| Edit `family_links` | ✅ | ✅ |
| **Create / promote admin or tutor accounts** | ❌ | ✅ |
| **Change a user's role** | ❌ | ✅ |
| Class / schedule management | ✅ | ✅ |
| View tutor availability | ✅ | ✅ |
| Attendance views | ✅ | ✅ |
| Enrolment: enrol / move / waitlist / trial | ✅ | ✅ |
| **Withdraw student** (triggers refund logic) | initiate only — flags for review | finalize / approve |
| **Mark cash payment received** (manual mark-as-paid) | ✅ | ✅ |
| **Create invoice** | ❌ | ✅ |
| **Apply discount** | ❌ | ✅ |
| **Process refund** | ❌ | ✅ |
| Payment list view (who has paid) | ✅ read-only | ✅ |
| **Revenue / retention / churn reports** | ❌ | ✅ |
| Attendance / homework / tutor-note reports | ✅ | ✅ |
| Announcements | ✅ | ✅ |
| Make-up class approval | ✅ | ✅ |
| Resource approval | ✅ | ✅ |
| **Audit log access** | ❌ | ✅ |
| **Bulk export of personal data** | ❌ | ✅ |

#### Judgment calls (worth revisiting)

- **Cash payment receipt** is in `admin_restricted` because parents pay at the desk and reception needs to mark it. It is a write to `payments`, but the *amount* is fixed by the invoice — reception can't alter the figure.
- **Withdraw student** is split: reception can initiate (flag the student as leaving), `admin_unrestricted` finalizes (which is what releases any refund). Avoids reception being blocked on common ops while keeping money decisions gated.
- **Payment list view (read-only)** is allowed for reception so they can answer "is this family up to date?" without seeing revenue aggregates.

### Implementation notes (not yet coded)

- Enum migration: `userRoleEnum` grows to six values. Existing `admin` rows migrate to `admin_unrestricted` (safe default — preserves current capabilities); existing `student` rows migrate to `student_restricted` (safe default — most students are still parent-dependent).
- `requireRole` helper should accept a *set* of acceptable tiers so route guards can express "either admin tier" without enumerating.
- Middleware route gates need per-feature checks, not just per-portal — e.g. `/admin/payments/refund` must reject `admin_restricted` even though `/admin/payments` accepts it.
- `app_metadata.role` flip in Supabase auth (per `security:` commit 124bfb7) needs to handle the new values.
- Dashboard tiles for `admin_restricted` filter out revenue at the data layer, not just hide in UI.
