# Subject Curriculum - Design Spec

**Date:** 2026-05-30
**Status:** Approved, ready for implementation plan
**Replaces:** current `student/subjects/[id]` overview page

## Problem

Taiyo's tuition curriculum is fixed week-by-week per subject (e.g., Year 9 English Term 2 Week 5 = "Romeo and Juliet - Act 2"). Today there is no way for students to see what's coming, parents to see what's being taught, or tutors/admins to publish weekly content. The current subject page shows homework + lessons but no curriculum structure.

## Goals

- Students can browse their subject's weekly content (recorded lesson video, booklet, homework due that week, completion progress) week by week, with a sidebar of weeks.
- Parents can read the same curriculum for their linked children.
- Tutors can override per-class content (video, booklet, title, description) on top of an admin-defined template.
- Admins define the canonical curriculum per subject per term.

## Non-goals (out of scope for this spec)

- Bulk CSV import of curriculum.
- Curriculum versioning / archive UI (terms naturally archive themselves).
- Quiz blocks per week (separate feature).
- Notifications when a week is updated.
- Per-week analytics dashboard.

## Roles and what they do

| Role | Capability |
|---|---|
| Admin | Create terms; create/edit/delete subject_weeks for any subject+term |
| Tutor | Override video/booklet/title/description on a per-class basis for weeks in subjects they teach; reset overrides |
| Student | Read curriculum for subjects they are enrolled in; their video-watch and booklet-open events are tracked |
| Parent | Read curriculum for subjects their linked children are enrolled in (read-only) |

## Schema

Append to `src/db/schema.ts`. All ids are uuid.

```ts
terms (
  id pk,
  year int,                  // 2026
  termNumber int,            // 1 | 2 | 3 | 4
  startDate date,
  endDate date,
  unique(year, termNumber)
)

subjectWeeks (               // admin template, per subject per term
  id pk,
  subjectId fk -> subjects.id,
  termId fk -> terms.id,
  weekNumber int,            // 1, 2, ... within the term
  title text,
  description text nullable,
  videoUrl text nullable,    // supabase storage path
  bookletUrl text nullable,  // supabase storage path
  createdAt, updatedAt,
  unique(subjectId, termId, weekNumber)
)

classWeekOverrides (         // tutor's per-class deltas; null fields fall through to template
  id pk,
  classId fk -> classes.id,
  subjectWeekId fk -> subjectWeeks.id,
  title text nullable,
  description text nullable,
  videoUrl text nullable,
  bookletUrl text nullable,
  createdAt, updatedAt,
  unique(classId, subjectWeekId)
)

studentWeekProgress (        // per-student tracking
  studentId fk -> profiles.id,
  subjectWeekId fk -> subjectWeeks.id,
  videoWatchedAt timestamptz nullable,
  bookletOpenedAt timestamptz nullable,
  pk(studentId, subjectWeekId)
)

// existing table modified
homework: + weekId fk -> subjectWeeks.id, nullable
```

**Read pattern:** for a student-class viewing week N, query `subjectWeeks` and LEFT JOIN `classWeekOverrides ON (classId, subjectWeekId)`. Use `COALESCE(override.field, template.field)` per displayed field.

**Empty override cleanup:** if all override fields are null after an edit, delete the row in the same server action.

## Storage

Supabase Storage bucket `curriculum/`, private:
- `curriculum/videos/{subjectWeekId-or-classOverrideId}.{ext}` - admin or tutor uploads.
- `curriculum/booklets/{subjectWeekId-or-classOverrideId}.{ext}` - same.

Signed URLs minted server-side at render time after the read-permission check. Booklet opens are tracked via a server action that mints the URL and writes `bookletOpenedAt` in the same transaction. Video watches recorded via a client-side `<video>` `onPlay` callback that hits a server action.

**File size caps:** video 500 MB, booklet 25 MB. Enforce in client `<input>` and server action.

## Routes

| Route | Purpose | Notes |
|---|---|---|
| `/student/subjects/[id]` | Replaces existing page. Sidebar of weeks for current term, main panel shows selected week. Default week = current calendar week. | URL search param `?week=N` makes the selected week deep-linkable. |
| `/parent/subjects/[id]?child=X` | New. Read-only mirror of student view, scoped to selected child via existing `resolveSelectedChild`. | Parent cannot trigger watch/open tracking. |
| `/tutor/classes/[id]/curriculum` | New. Same shell as student view but with inline override editors per content block. "Reset to template" deletes the override row. | Tutor can only access classes where `classes.tutorId = user.id`. |
| `/admin/subjects/[id]/curriculum` | New. Pick a term; list weeks; add/edit/delete `subjectWeeks` rows. | Admin only. |
| `/admin/terms` | New. CRUD for terms. | Admin only. |

## Permissions

All enforced in Drizzle query `WHERE` clauses; no shared middleware (matches existing repo style).

- **Student:** subject must match an `enrollments` row for this user (joined via `classes.subjectId`).
- **Parent:** child must match a `familyLinks` row for this user, and child must be enrolled in the subject.
- **Tutor:** class must have `tutorId = user.id`.
- **Admin:** no scope filter.
- **Permission failure:** `notFound()` rather than 403, so we don't leak existence of other subjects/classes.

## File layout

```
src/db/schema.ts                                                    (modified)
src/lib/curriculum.ts                                               (new)
    - resolveCurrentTerm(date): Term | null
    - mergeOverrides(template, override): MergedWeek
    - signCurriculumUrl(path): Promise<string>

src/app/student/subjects/[id]/page.tsx                              (rewritten)
src/app/student/subjects/[id]/_components/week-sidebar.tsx          (new, client)
src/app/student/subjects/[id]/_components/week-content.tsx          (new, server)
src/app/student/subjects/[id]/_components/video-player.tsx          (new, client)
src/app/student/subjects/[id]/_actions.ts                           (new)
    - markVideoWatched(subjectWeekId)
    - markBookletOpened(subjectWeekId) returns signed URL

src/app/parent/subjects/[id]/page.tsx                               (new)
src/app/parent/subjects/[id]/_components/*                          (mirror of student)

src/app/tutor/classes/[id]/curriculum/page.tsx                      (new)
src/app/tutor/classes/[id]/curriculum/_components/override-editor.tsx (new)
src/app/tutor/_actions.ts                                           (extended)
    - upsertClassWeekOverride(...)
    - resetClassWeekOverride(classId, subjectWeekId)
    - uploadCurriculumVideo / uploadCurriculumBooklet (tutor scope)

src/app/admin/terms/page.tsx                                        (new)
src/app/admin/terms/_components/term-form.tsx                       (new)
src/app/admin/subjects/[id]/curriculum/page.tsx                     (new)
src/app/admin/subjects/[id]/curriculum/_components/week-editor.tsx  (new)
src/app/admin/_lib/actions-curriculum.ts                            (new)
    - createTerm, updateTerm, deleteTerm
    - createSubjectWeek, updateSubjectWeek, deleteSubjectWeek
    - uploadCurriculumVideo / uploadCurriculumBooklet (admin scope)
```

## UI layout

### Student / parent

Two-column on `lg`+, single-column with horizontal week strip on smaller widths.

```
┌────────────┬──────────────────────────────────────────────────┐
│  WEEKS     │  WEEK 5 · Romeo and Juliet - Act 2              │
│  Term 2 ▾  │  ─────────────────────────────────────           │
│            │                                                  │
│  ● Week 1  │  ▶ Recorded lesson   [thumbnail, 32 min]        │
│  ● Week 2  │     watched · 3d ago                             │
│  ● Week 3  │                                                  │
│  ● Week 4  │  📘 Week booklet      [Open PDF →]               │
│ ▶● Week 5  │     not opened yet                               │
│  ○ Week 6  │                                                  │
│   ...      │  Homework due this week                          │
│            │  ─────────────────                               │
│            │  • Annotation exercise  Fri  [Marked 8/10]      │
│            │  • Soliloquy analysis   Sun  [Not started]      │
│            │                                                  │
│            │  Progress                                        │
│            │  ✓ Video  ✓ Booklet  1/2 homework               │
└────────────┴──────────────────────────────────────────────────┘
```

- Term dropdown defaults to current term; user can browse past/future terms.
- For **student/parent**, dropdown only lists terms that have at least one `subjectWeeks` row for this subject. For **tutor/admin**, all terms appear (so empty terms can be seeded).
- Each week row: filled ● for past/current, empty ○ for future, ▶ marks selected.
- "Current week" within a term = `floor((today - terms.startDate) / 7) + 1`, clamped to `[1, max weekNumber for this subject in this term]`. If today is outside any term, current week = highest weekNumber in the most recent past term for this subject.
- Selected week persisted in URL (`?week=5`).
- Mobile: sidebar becomes a horizontal chip strip at the top of the content panel.

### Tutor

Same shell. Each content block has an "Override" pill. Clicking opens an inline editor (file picker, text inputs). "Reset to template" button shown when override row exists.

### Admin

Sidebar shows weeks for selected term + "+ Add week" button. Editing a week opens a form panel inline. No override concept - these rows are the source.

## Edge cases

- **No curriculum seeded for this term yet:** empty state - *"Curriculum coming soon - your tutor is preparing this term's content."*
- **Between terms:** default-select most recent past term; banner - *"Term 2 ended on X. Term 3 starts Y."*
- **Student enrolled in two classes for same subject:** pick first enrollment by `enrollments.createdAt asc`. Documented limitation, no UI for choosing yet.
- **Homework with `weekId = null`:** does not appear in any week's "due" list; still visible on `/student/homework`. Existing homework rows remain null.
- **Override row with all null fields after edit:** delete the override row in the same server action.
- **Tutor's override of a video the admin later updates:** override wins. Tutor must click "Reset to template" to adopt admin's new video.
- **Storage object deleted while DB still has the path:** signed URL fetch 404s; render *"Video unavailable - contact your tutor."* in place of the player; don't block rest of page.

## Error handling

- Server actions return `{ ok: true, ... } | { ok: false, error: string }`. Forms render the error inline.
- File upload limits enforced both client-side (`<input>`) and server-side (rejected before storage write).
- Permission failures → `notFound()` (no 403, no leak).

## Test plan (manual, repo has no test suite)

1. Admin: create Term 2 (2026), seed 3 weeks for Year 9 English with video URLs.
2. Student in Year 9 English: see the 3 weeks, current week highlighted in sidebar.
3. Tutor of class A overrides week 2 video. Student in class A sees override; student in class B (same subject) sees admin template.
4. Student plays video → progress dot updates → parent of that student sees the same progress.
5. Admin creates homework, assigns `weekId = week-2.id`. Homework appears under Week 2 "due" for affected students; does not appear under other weeks.
6. Permission probe: log in as student A, attempt `/student/subjects/{subject-id-student-A-is-not-enrolled-in}` → `notFound()`.
7. Tutor clicks "Reset to template" on week 2 → override row deleted, student in class A now sees admin template again.

## Implementation sequencing (informative, not binding)

This spec is one feature, but the natural build order is:

1. Schema + migration + `lib/curriculum.ts` helpers + Supabase storage bucket setup.
2. Admin: terms CRUD + subject curriculum CRUD (including upload). Lets you seed test data.
3. Student: read view (sidebar + week content + video/booklet/homework/progress).
4. Tutor: override editor + reset.
5. Parent: read-only mirror.

The implementation plan (next step) will decide whether to ship these as one branch or staged PRs.

## Out of scope (recap)

Bulk import, versioning UI, quizzes per week, change notifications, watch analytics. Each becomes its own spec/plan when prioritized.
