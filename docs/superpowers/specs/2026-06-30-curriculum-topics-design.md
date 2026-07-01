# Curriculum Topics (Foundation) — Design Spec

**Date:** 2026-06-30
**Status:** Draft, pending user review
**Part 1 of 3** — see "Roadmap" below. This spec covers ONLY the curriculum + topics foundation.

## Problem

Taiyo's curriculum is organised as **Subject → Topic → Week**: a subject (e.g. "Year 9 Maths") has topics ("Algebra", "Geometry"), and each topic is taught across several weeks ("linear equations", "fractions" are weeks under Algebra). Today the curriculum has only the week layer (`subject_weeks`, per subject per term) — there is no topic grouping above it. Topics are needed as the organising layer for two downstream features (per-tutor sections, automated mastery), so they must exist first.

Separately, the student progress tracker currently shows topic mastery from a free-text `progress_topics` table seeded with fake data. That table is replaced by computed mastery in Part 3; this spec does **not** touch it.

## Roadmap (context, not scope)

Three connected pieces, built in dependency order. This spec is Part 1.

1. **Curriculum + topics (this spec)** — topic layer above weeks; admin authoring. Gates the rest.
2. **Per-(tutor, subject) additive section** — reshape `class_week_overrides` into a per-tutor additive notes/materials section, visible only to that tutor's students. Includes the student/parent curriculum read-view changes (grouping weeks by topic, showing the tutor section).
3. **Automated mastery** — admin-defined tests attached to weeks; a student's test scores roll up by topic into a Strong/Improving/Needs-work band; replaces seed `progress_topics`. Score-capture + thresholds decided there.

## Goals (this spec)

- Admins can define a list of **topics** per subject.
- Admins can assign each **week** to a topic.
- The topic layer is queryable so Parts 2 and 3 can build on it.
- No regression to the existing week-by-week admin curriculum authoring.

## Non-goals (deferred to later parts)

- Per-tutor additive section (Part 2).
- Student/parent curriculum view grouped by topic (Part 2 — that view is reshaped there anyway).
- Tests, test scores, mastery computation, thresholds (Part 3).
- Reordering UX beyond simple up/down.
- Bulk import of topics/curriculum.

## Roles

| Role | Capability (this spec) |
|---|---|
| Admin | Create / rename / reorder / delete topics for any subject; assign a week to a topic |
| Tutor / Student / Parent | No new capability in Part 1 |

## Schema

Append to `src/db/schema.ts` (Drizzle owns table DDL only — see `docs/SECURITY.md` migration boundary).

```ts
subjectTopics (
  id uuid pk default random,
  subjectId uuid fk -> subjects.id (onDelete cascade),
  name text not null,
  position int not null default 0,   // ordering within the subject
  createdAt timestamptz default now,
  updatedAt timestamptz default now,
  unique(subjectId, name),
  index(subjectId)
)

// existing table modified
subjectWeeks: + topicId uuid fk -> subjectTopics.id (onDelete set null), nullable
```

**Why `topicId` nullable + `onDelete set null`:** existing weeks have no topic until an admin assigns one (non-destructive migration), and deleting a topic must not delete curriculum content — its weeks fall back to "unassigned" and the admin reassigns. A week with `topicId = null` simply does not roll into any topic's mastery later (Part 3).

**Why topics are subject-level (not term-level):** a topic like "Algebra" belongs to the subject and can be taught across weeks in any term. Weeks remain term-scoped; the topic is the cross-term grouping.

## Migration

Apply order per `docs/SECURITY.md`: Drizzle Kit first, then raw SQL.

1. **Drizzle** (`drizzle/`): create `subject_topics`; add `subject_weeks.topic_id`.
2. **Raw SQL** (`supabase/migrations/000N_subject_topics_rls.sql`): enable RLS on `subject_topics`; policies `subject_topics_admin_all` (admin write+read) and a `SELECT` grant to `authenticated` (topics are non-sensitive curriculum metadata, same posture as `subjects`). No new policy needed on `subject_weeks` (its RLS is unchanged; adding a nullable column doesn't alter access). Log the migration in `docs/SECURITY.md` per the A10 discipline.
3. **Existing data:** `subject_weeks.topic_id` defaults null. No rows rewritten. Admins assign topics through the new UI.
4. **Seed** (`scripts/seed-demo.mjs`): create 2–4 topics per subject and assign the generated weeks under them, so the demo shows the grouped structure end-to-end.

## Authoring UI

Extend the existing `/admin/subjects/[id]/curriculum` page (per-subject, currently term-scoped week editing via `WeekStripAdmin` + `WeekEditor`).

- **Topics panel** (subject-level, above the term/week area): lists the subject's topics; each row has rename, up/down reorder, and delete. An "+ Add topic" input appends a topic.
- **Week → topic assignment:** add a topic `<select>` (the subject's topics, plus "Unassigned") to `WeekEditor`. Saving a week persists its `topicId`.
- **Delete-topic guard:** if the topic has weeks assigned, the delete confirm states "N week(s) will become unassigned" before proceeding (weeks' `topicId` set null). Destructive-action disclosure per project rules.

### Server actions

New file `src/app/admin/_lib/actions-topics.ts`, mirroring the existing `{ ok, error }` + Zod + `requireRole("admin")` + `revalidatePath` pattern in `actions-curriculum.ts`:

- `createSubjectTopic(formData)` — `{ subjectId, name }`; appends with `position = max+1`.
- `renameSubjectTopic(id, formData)` — `{ name }`.
- `reorderSubjectTopic(id, direction)` — swaps `position` with the adjacent topic.
- `deleteSubjectTopic(id, subjectId)` — deletes; weeks' `topicId` set null via FK.

Extend `weekInputSchema` in `actions-curriculum.ts` with optional `topicId: z.string().uuid().nullable()` so `createSubjectWeek` / `updateSubjectWeek` persist the assignment.

All revalidate `/admin/subjects/${subjectId}/curriculum`.

## Permissions

- Writes go through admin server actions (`requireRole("admin")`). Server-side Drizzle connects as the `postgres` role and bypasses RLS — RLS is defense-in-depth.
- `subject_topics` RLS: admin all; `authenticated` SELECT only; `anon` none. Matches the `subjects` posture (curriculum metadata, not student PII).

## Validation & error handling

- Zod: `name` `min(1).max(200)`; `position` int. Duplicate `(subjectId, name)` violates the unique index → surface a friendly "A topic with that name already exists" inline error.
- Server actions return `{ ok: true } | { ok: false, error }`; the panel renders the error inline (existing pattern).

## Edge cases

- **Week left unassigned** (`topicId = null`): allowed; shown as "Unassigned" in the admin editor; excluded from mastery in Part 3.
- **Deleting a topic with weeks:** weeks become unassigned (FK set null), not deleted; confirm dialog discloses the count.
- **Reorder at list ends:** up on the first / down on the last is a no-op (button disabled).
- **Two subjects with same topic name:** allowed — uniqueness is per subject.

## Test plan (manual; repo has no test suite)

1. Admin opens `/admin/subjects/{Year 9 Maths}/curriculum`; Topics panel renders (empty initially).
2. Add "Algebra" and "Geometry"; reorder so Geometry is first, then back; rename "Geometry" → "Geometry & Measurement".
3. In the week editor, assign Week 1 "linear equations" → Algebra, Week 2 "fractions" → Algebra. Reload: assignments persist.
4. Delete "Algebra" → confirm shows "2 weeks will become unassigned" → after delete, those weeks show "Unassigned".
5. Add a duplicate topic name → friendly error, no row created.
6. RLS probe: with a non-admin `authenticated` JWT, `insert into subject_topics` is denied; `select` is allowed.

## File layout

```
src/db/schema.ts                                         (modified: subjectTopics + subjectWeeks.topicId)
drizzle/                                                 (generated migration)
supabase/migrations/000N_subject_topics_rls.sql          (new: RLS)
docs/SECURITY.md                                         (modified: migration log + access matrix row)
scripts/seed-demo.mjs                                    (modified: seed topics + assign weeks)

src/app/admin/_lib/actions-topics.ts                     (new: topic CRUD actions)
src/app/admin/_lib/actions-curriculum.ts                 (modified: weekInputSchema + topicId)
src/app/admin/subjects/[id]/curriculum/page.tsx          (modified: load topics, render panel)
src/app/admin/subjects/[id]/curriculum/_components/topics-panel.tsx   (new: client, list/add/rename/reorder/delete)
src/app/admin/subjects/[id]/curriculum/_components/week-editor.tsx    (modified: topic select)
```
