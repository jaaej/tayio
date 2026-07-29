# Tutor Curriculum Sections (Part 2) - Design Spec

**Date:** 2026-07-01
**Status:** Draft, pending user review
**Part 2 of 3** - depends on Part 1 (`subject_topics` + `subject_weeks.topic_id`, merged in `ca7f9a6`). Part 3 (automated mastery) is separate.

## Problem

The admin defines a locked base curriculum per subject (Part 1: topics → weeks). Tutors need to layer **their own** supplementary material on top - notes and files - **without changing the base**. Each tutor's additions are private to that tutor's own students.

The codebase currently has a *different* model: `class_week_overrides`, where a tutor could **replace** the base content (title/video/booklet) for one class. That contradicts "base is locked" and is being retired. It has **no data** (nothing seeded, nothing created).

## Goals

- A tutor can add a **note** and **file attachments** to any week of a subject they teach.
- That content is scoped **per `(tutor, subject-week)`** - shared across all of that tutor's classes of the subject, separate from other tutors, separate from the same tutor's other subjects.
- Students and parents see the **locked base** plus **their enrolled class's tutor's** section for each week ("From your tutor").
- Students/parents see the curriculum **grouped by topic** (Part 1's `topic_id`).
- The old per-class override feature and its table are removed.

## Non-goals

- Part 3: tests, scores, automated mastery.
- Tutor editing the base curriculum (base stays admin-only, locked).
- Rich-text/markdown in the note (plain multiline text for now).
- Per-attachment access controls beyond "the tutor's own students".
- Threaded comments / student replies on a section.

## Scope key - how `(tutor, subject-week)` resolves

- A `subject_weeks` row belongs to one subject (via `subject_id`).
- A tutor teaches a subject through one or more `classes` (`classes.tutor_id`, `classes.subject_id`).
- A student is in exactly one class per subject (via `enrollments`).
- So: **student → enrollment → class → `tutor_id` + `subject_id` → the tutor's section for each week of that subject.** Two tutors teaching the same subject have independent sections; one tutor's two classes of the same subject share one section (per the agreed per-tutor scope).

## Schema

Append to `src/db/schema.ts` (Drizzle owns table DDL).

```ts
tutorWeekSections (
  id uuid pk,
  tutorId uuid fk -> profiles.id (onDelete cascade),
  subjectWeekId uuid fk -> subject_weeks.id (onDelete cascade),
  note text,                     // nullable; plain multiline
  createdAt, updatedAt,
  unique(tutorId, subjectWeekId),
  index(subjectWeekId)
)

tutorWeekAttachments (
  id uuid pk,
  sectionId uuid fk -> tutor_week_sections.id (onDelete cascade),
  fileName text not null,        // original name, for display
  storagePath text not null,     // path in the curriculum storage bucket
  contentType text,              // client-reported MIME (best-effort)
  sizeBytes integer,
  uploadedAt timestamptz default now,
  index(sectionId)
)
```

**Removed:** `classWeekOverrides` table (dropped) and its `ClassWeekOverride` type.

## Migration

Apply order per `docs/SECURITY.md`: Drizzle (`db:push`) first, then raw SQL for RLS. (This repo uses `db:push`, not `db:generate` - see [[schema-apply-dbpush-not-generate]].)

1. **Drizzle (`db:push`):** create `tutor_week_sections` + `tutor_week_attachments`; **drop** `class_week_overrides`. `db:push` will report the table drop - expected (empty table, no data lost).
2. **Raw SQL (`supabase/migrations/0010_tutor_week_sections_rls.sql`):**
   - Enable RLS on both new tables.
   - `tutor_week_sections`: tutor can write/read own rows (`tutor_id = auth.uid()`); admin all; authenticated `SELECT` (students/parents read their tutor's section - server-side Drizzle bypasses RLS anyway, this is defense-in-depth).
   - `tutor_week_attachments`: same posture, gated through the parent section's tutor (via a `SECURITY DEFINER` helper `is_owner_of_section(section_id)` to avoid RLS recursion, following the 0004 helper pattern).
   - Drop the `class_week_overrides` RLS policies (table is gone).
   - Log in `docs/SECURITY.md` (migration entry + access-matrix rows; remove the `class_week_overrides` row).
3. **Storage:** reuse the existing curriculum storage bucket + `src/lib/curriculum-storage.ts` upload helper. Attachment path: `tutor-sections/{sectionId}/{uuid}.{ext}`.
4. **Seed (optional):** seed one or two tutor sections (a note + no file) for a demo class so the "From your tutor" block is visible in the demo. Files not seeded.

## Tutor authoring - reshape `/tutor/classes/[id]/curriculum`

Replace the override editor with a **section editor**. The page is reached per-class; the class gives `subjectId` + confirms `tutorId = user.id`. For the selected week, show:

- **Base (read-only):** the admin's title/description/video/booklet for the week - clearly labelled "Set by admin", not editable.
- **Your section (editable):** a note textarea + an attachments list (upload / remove). Saves target `tutor_week_sections (user.id, subjectWeekId)`.

Because the section is keyed by `(tutorId, subjectWeekId)`, editing it from any of the tutor's classes of that subject edits the **same** shared section - surface a small hint ("Shared across all your {subject} classes").

### Tutor server actions (`src/app/tutor/_actions.ts`)

- **Add:** `upsertTutorWeekNote(subjectWeekId, note)` - upsert the section row for `(user.id, subjectWeekId)`.
- **Add:** `addTutorWeekAttachment(subjectWeekId, file)` - ensure section exists, upload to storage, insert an attachment row.
- **Add:** `removeTutorWeekAttachment(attachmentId)` - delete the attachment row (and its storage object).
- **Remove:** `upsertClassWeekOverride`, `resetClassWeekOverride`, and any tutor override upload actions.

**Permission on every action:** `requireRole("tutor")` + verify the tutor teaches the subject that owns `subjectWeekId` (a class with `tutor_id = user.id` and matching `subject_id`). Reuse or add a `tutorTeachesSubjectWeek(tutorId, subjectWeekId)` guard. Attachment size/type limits enforced server-side (align with existing curriculum upload caps).

**Removed components:** `override-editor.tsx`; adapt `week-sidebar-tutor.tsx` / `week-strip-tutor.tsx` to the read-base + edit-section layout.

## Student / parent read view - `/student|parent/subjects/[id]`

- **Group by topic:** the week sidebar/strip groups weeks under their `subject_topics.name` (Part 1's `topic_id`); unassigned weeks fall under an "Other" / ungrouped heading.
- **Base content:** render `subject_weeks` fields directly - **remove `mergeOverride`** and all `class_week_overrides` reads.
- **"From your tutor" block:** resolve the tutor for this student+subject (enrollment → class → `tutor_id`), then load `tutor_week_sections` for `(that tutorId, selected week)` + its attachments. Render the note and downloadable attachments (signed URLs via existing storage helper). Parent mirrors this for the selected child.
- If the student's tutor has no section for a week: show nothing (no empty block).

**Files touched:** `student/subjects/[id]/_queries.ts` + `page.tsx` + `_actions.ts`; `parent/subjects/[id]/_queries.ts` + `page.tsx`; `src/lib/curriculum.ts` (remove `mergeOverride`/`ClassWeekOverride`); the week sidebar/content components.

## Permissions summary

| Table | Student | Parent | Tutor | Admin |
|---|---|---|---|---|
| `tutor_week_sections` | read own tutor's (server-side) | read child's tutor's (server-side) | read/write own | all |
| `tutor_week_attachments` | read (server-side) | read (server-side) | read/write own (via section) | all |

Writes always run through server actions with `requireRole` + ownership checks; RLS is defense-in-depth (server Drizzle uses the `postgres` role and bypasses it).

## Edge cases

- **Tutor teaches two classes of the same subject:** one shared section (per-tutor scope). Editing from either class edits the same rows.
- **Student not enrolled / no tutor resolvable:** show base only, no tutor block.
- **Attachment storage object missing:** show the row with an "unavailable" state; don't break the page.
- **Deleting a section** (e.g. tutor clears everything): allowed; attachments cascade-delete (DB) + storage cleanup in the action.
- **Week has no `topic_id`:** grouped under "Other".

## Test plan (manual; no automated suite - verify via `npm run typecheck` = 0 src errors + browser)

1. Admin curriculum unchanged (base still editable by admin, Part 1 intact).
2. Tutor A opens `/tutor/classes/{A's Year 9 Maths}/curriculum`, adds a note + a file to Week 1's section. Sees "shared across your Year 9 Maths classes" hint.
3. Student in Tutor A's Year 9 Maths class sees base (admin) + "From your tutor" note/file on Week 1; weeks are grouped by topic.
4. Student in Tutor B's Year 9 Maths class sees base but **not** Tutor A's note.
5. Tutor A's Year 10 English section is empty/independent of the Maths section.
6. Parent of the student in step 3 sees the same tutor block for that child.
7. `class_week_overrides` table no longer exists; no override editor in the tutor UI; no `mergeOverride` references remain.
8. RLS probe: a non-admin `authenticated` JWT cannot write another tutor's section rows.

## File layout

```
src/db/schema.ts                                    (modified: +2 tables, -classWeekOverrides)
supabase/migrations/0010_tutor_week_sections_rls.sql (new)
docs/SECURITY.md                                    (modified: log + matrix; remove class_week_overrides)
scripts/seed-demo.mjs                               (modified: optional demo section)

src/lib/curriculum.ts                               (modified: remove mergeOverride/ClassWeekOverride)
src/lib/curriculum-storage.ts                       (reused for attachment uploads)

src/app/tutor/_actions.ts                           (modified: +section actions, -override actions)
src/app/tutor/classes/[id]/curriculum/page.tsx      (modified: read-base + section editor)
src/app/tutor/classes/[id]/curriculum/_queries.ts   (modified)
src/app/tutor/classes/[id]/curriculum/_components/section-editor.tsx     (new; replaces override-editor.tsx)
src/app/tutor/classes/[id]/curriculum/_components/week-sidebar-tutor.tsx (modified)
src/app/tutor/classes/[id]/curriculum/_components/week-strip-tutor.tsx   (modified)

src/app/student/subjects/[id]/_queries.ts           (modified: topic grouping + tutor section, -override)
src/app/student/subjects/[id]/page.tsx              (modified)
src/app/student/subjects/[id]/_actions.ts           (modified)
src/app/student/subjects/[id]/_components/*         (modified: group-by-topic + tutor block)
src/app/parent/subjects/[id]/_queries.ts            (modified: mirror)
src/app/parent/subjects/[id]/page.tsx               (modified)
src/app/parent/subjects/[id]/_components/*          (modified: mirror)
```
