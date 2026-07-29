# Tutor Curriculum Sections - Part 2b (read side + cleanup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students and parents see the locked admin base grouped by topic plus a "From your tutor" block (their enrolled class's tutor's note + attachments); the old per-class override is removed; and the tutor-section read policy is tightened so only a tutor's own students/parents can read their sections.

**Architecture:** Rewrite the student and parent curriculum read queries to drop `mergeOverride`/`classWeekOverrides` and instead load the enrolled class's tutor's `tutor_week_sections` (+ attachments, server-signed). Group weeks by `subject_topics` (Part 1's `topicId`). Then delete the override entirely (table, `mergeOverride`, override actions) and replace the 2a `using(true)` read policies with per-student/parent scoped RLS helpers.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle/Postgres, Supabase (Storage + raw-SQL RLS), Zod, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-01-tutor-sections-design.md` (Part 2). This is **2b of 2** - the read side + cleanup. 2a (write side) is merged (`97ed25d`).

## Global Constraints

- **No automated test suite.** Per-task verification is `npm run typecheck 2>&1 | grep -cE "^src/.*error"` printing **0** (ignore `.next/types/...d 2.ts` errors). End-to-end is the manual task at the end.
- **Schema applied with `db:push`, never `db:generate`.** RLS in `supabase/migrations/` via `node scripts/apply-sql.mjs`.
- **DB-apply steps are controller-gated** (marked `[DB - controller-gated]`): `db:push` (which will DROP `class_week_overrides`) and applying `0011`. Implementers write code/SQL and commit only.
- **Build-green order:** the student (Task 1) and parent (Task 2) queries must stop using `mergeOverride`/`classWeekOverrides` BEFORE Task 3 removes them. Do not remove the override until Tasks 1–2 land.
- **Branch:** feature branch off `main`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 0: Branch

- [ ] **Step 1:** `git checkout -b feat/tutor-sections-2b`
- [ ] **Step 2:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`

---

## Task 1: Student curriculum read - base + topic grouping + tutor section

**Files:** Rewrite `src/app/student/subjects/[id]/_queries.ts`; modify `page.tsx` + `_components/*` (week sidebar/strip/content) to group by topic and render the tutor block.

**Interfaces produced:** `StudentCurriculumWeek` gains `topicId: string | null`, `topicName: string | null`, `tutorNote: string | null`, `tutorAttachments: Array<{ id: string; fileName: string; url: string | null }>`; loses the `MergedWeek`/`hasOverride` shape (base fields become plain).

- [ ] **Step 1:** In `_queries.ts`, add `classes.tutorId` to the enrollment select (the section's owner). Remove the `classWeekOverrides` import + query + `mergeOverride`/`MergedWeek` import. Base fields come straight from `templateWeeks` (tpl.title/description/videoUrl/bookletUrl). Add `subjectTopics` to the schema import and `tutorWeekSections`/`tutorWeekAttachments`.

- [ ] **Step 2:** Load topic names for the term's weeks (join `subjectWeeks.topicId → subjectTopics`), and the enrolled tutor's sections + attachments over `weekIds`:

```ts
  const topicRows = await db
    .select({ id: subjectTopics.id, name: subjectTopics.name })
    .from(subjectTopics)
    .where(eq(subjectTopics.subjectId, subjectId));
  const topicName = new Map(topicRows.map((t) => [t.id, t.name]));

  const sections = await db.select().from(tutorWeekSections).where(and(
    eq(tutorWeekSections.tutorId, enrollment.tutorId),
    inArray(tutorWeekSections.subjectWeekId, weekIds),
  ));
  const sectionByWeek = new Map(sections.map((s) => [s.subjectWeekId, s]));
  const sectionIds = sections.map((s) => s.id);
  const attRows = sectionIds.length
    ? await db.select().from(tutorWeekAttachments).where(inArray(tutorWeekAttachments.sectionId, sectionIds))
    : [];
```

- [ ] **Step 3:** Build each `StudentCurriculumWeek` from `tpl` directly (no merge): set `title/description/videoUrl/bookletUrl` from `tpl`; add `topicId: tpl.topicId`, `topicName: tpl.topicId ? (topicName.get(tpl.topicId) ?? null) : null`, `tutorNote: sectionByWeek.get(tpl.id)?.note ?? null`, and `tutorAttachments` (map the section's attachments; **sign each `storagePath`** with `signCurriculumUrl` - do the signing here in this server module, producing `{ id, fileName, url }`). Keep `videoWatchedAt`/`bookletOpenedAt`/`homework`/`recaps` exactly as now.

- [ ] **Step 4:** In `page.tsx` + the week sidebar/strip components: group the weeks list by `topicName` (weeks with `topicId = null` under an "Other" heading), preserving week order within each topic. In the week content panel, add a "From your tutor" block (rendered only when `tutorNote` or `tutorAttachments.length`) showing the note + attachment download links. Read each component before editing; match existing style. (The base video/booklet already render; keep them, now always from base.)

- [ ] **Step 5:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0` (mergeOverride still exists in curriculum.ts, so the repo stays green even though this file no longer imports it).
- [ ] **Step 6:** Commit:

```bash
git add "src/app/student/subjects/[id]/_queries.ts" "src/app/student/subjects/[id]/page.tsx" "src/app/student/subjects/[id]/_components"
git commit -m "feat(curriculum): student curriculum grouped by topic + tutor section

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Parent curriculum read - mirror of Task 1

**Files:** Rewrite `src/app/parent/subjects/[id]/_queries.ts`; modify `page.tsx` + `_components/*`.

**Interfaces:** same additions as Task 1, scoped to the selected child (resolved via `familyLinks`).

- [ ] **Step 1:** Apply the same changes as Task 1 to the parent query: it already resolves the child's enrollment via `familyLinks` - add the child's class `tutorId`, drop `classWeekOverrides`/`mergeOverride`, load topic names + the tutor's sections/attachments (`tutorWeekSections.tutorId = child's class tutorId`), sign attachment URLs, and add `topicId`/`topicName`/`tutorNote`/`tutorAttachments` to each week.

- [ ] **Step 2:** Mirror the view changes in the parent `page.tsx` + components (group by topic + "From your tutor" block). If the parent view shares components with the student view, reuse them; otherwise apply the same edits. Read before editing.

- [ ] **Step 3:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`
- [ ] **Step 4:** Commit:

```bash
git add "src/app/parent/subjects/[id]/_queries.ts" "src/app/parent/subjects/[id]/page.tsx" "src/app/parent/subjects/[id]/_components"
git commit -m "feat(curriculum): parent curriculum grouped by topic + tutor section

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Remove the old per-class override

**Files:** `src/lib/curriculum.ts`, `src/app/tutor/_actions.ts`, `src/db/schema.ts`.

**Interfaces:** removes `mergeOverride`, `MergedWeek`, `ClassWeekOverride`, the override server actions, and the `classWeekOverrides` table.

- [ ] **Step 1:** Confirm no remaining references first:
```bash
grep -rn "mergeOverride\|classWeekOverrides\|ClassWeekOverride\|upsertClassWeekOverride\|resetClassWeekOverride\|uploadTutorOverride" src
```
Expected after Tasks 1–2: hits only in `curriculum.ts`, `tutor/_actions.ts`, and `schema.ts` (the definitions themselves). If any student/parent/tutor consumer remains, STOP - it must be migrated first.

- [ ] **Step 2:** In `src/lib/curriculum.ts`: remove `mergeOverride`, the `MergedWeek` type, and the `ClassWeekOverride`/`SubjectWeek` imports that are now unused. Keep `resolveCurrentTerm`, `resolveMostRecentPastTerm`, `currentWeekNumber`.

- [ ] **Step 3:** In `src/app/tutor/_actions.ts`: remove `upsertClassWeekOverride`, `resetClassWeekOverride`, `uploadTutorOverrideVideo`, `uploadTutorOverrideBooklet`, the `overrideSchema`, `isEmptyOverride`, and the `classWeekOverrides` import - and `assertTutorOwnsClass` **only if** it's now unused (grep it first; it may be used by other tutor actions). Leave all non-override actions intact.

- [ ] **Step 4:** In `src/db/schema.ts`: remove the `classWeekOverrides` table definition and its `ClassWeekOverride` type export.

- [ ] **Step 5:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`. Re-run the Step-1 grep - expected: **no hits**.
- [ ] **Step 6:** Commit:

```bash
git add src/lib/curriculum.ts src/app/tutor/_actions.ts src/db/schema.ts
git commit -m "refactor(curriculum): remove per-class override (superseded by tutor sections)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Tighten tutor-section read RLS + retire override policies

**Files:** Create `supabase/migrations/0011_tutor_section_read_scope.sql`; modify `docs/SECURITY.md`.

- [ ] **Step 1 [DB - controller-gated]:** `npm run db:push` - applies the schema, which **DROPS** `class_week_overrides` (empty table; no data lost). The controller runs this after confirming the table is empty.

- [ ] **Step 2:** Write `supabase/migrations/0011_tutor_section_read_scope.sql` - replace the 2a `using(true)` read policies with per-viewer scoping via SECURITY DEFINER helpers:

```sql
begin;

-- Who may READ a tutor's section for a given (tutor, subject-week)?
-- The tutor themselves, an admin, a student enrolled with that tutor for that
-- subject, or a parent of such a student. SECURITY DEFINER + pinned search_path;
-- returns bool only.
create or replace function public.can_read_tutor_section(p_tutor_id uuid, p_subject_week_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select
    p_tutor_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.subject_weeks sw
      join public.classes c on c.subject_id = sw.subject_id and c.tutor_id = p_tutor_id
      join public.enrollments e on e.class_id = c.id
      where sw.id = p_subject_week_id and e.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.subject_weeks sw
      join public.classes c on c.subject_id = sw.subject_id and c.tutor_id = p_tutor_id
      join public.enrollments e on e.class_id = c.id
      join public.family_links fl on fl.student_id = e.student_id
      where sw.id = p_subject_week_id and fl.parent_id = auth.uid()
    );
$$;

create or replace function public.can_read_tutor_section_att(p_section_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.tutor_week_sections s
    where s.id = p_section_id
      and public.can_read_tutor_section(s.tutor_id, s.subject_week_id)
  );
$$;

drop policy if exists tutor_week_sections_select_authenticated on public.tutor_week_sections;
create policy tutor_week_sections_select_scoped on public.tutor_week_sections
  for select to authenticated
  using (public.can_read_tutor_section(tutor_id, subject_week_id));

drop policy if exists tutor_week_attachments_select_authenticated on public.tutor_week_attachments;
create policy tutor_week_attachments_select_scoped on public.tutor_week_attachments
  for select to authenticated
  using (public.can_read_tutor_section_att(section_id));

commit;
```

(The `tutor_all` + `admin_all` write policies from 0010 stay. Server-side Drizzle still bypasses RLS; this hardens the direct-SDK path.)

- [ ] **Step 3 [DB - controller-gated]:** `node scripts/apply-sql.mjs supabase/migrations/0011_tutor_section_read_scope.sql`.

- [ ] **Step 4:** In `docs/SECURITY.md`: add a `### 0011 - tutor section read scoping` migration-log entry (what/why/reversible-by: drop the two functions + recreate the `select_authenticated using(true)` policies). Update the read access-matrix rows for `tutor_week_sections`/`tutor_week_attachments` from "all authenticated" to "own tutor's (student/parent), own (tutor), all (admin)". **Remove** the `class_week_overrides` rows/log references (table dropped) - or add a note that it was dropped in Part 2b.

- [ ] **Step 5:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`
- [ ] **Step 6:** Commit:

```bash
git add supabase/migrations/0011_tutor_section_read_scope.sql docs/SECURITY.md
git commit -m "feat(security): scope tutor-section reads to the tutor's own students/parents

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Manual verification (+ controller DB apply)

- [ ] **Step 1:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`
- [ ] **Step 2 [DB - controller-gated]:** run `db:push` (drops `class_week_overrides`) + apply `0011`.
- [ ] **Step 3:** On the dev server (user starts it):
  1. Student in Tutor A's class opens `/student/subjects/<id>` → weeks grouped by topic; base content shows; a "From your tutor" block shows Tutor A's note/attachments on the seeded week.
  2. Student in a different tutor's class of the same subject does NOT see Tutor A's note.
  3. Parent of the step-1 student sees the same tutor block for that child.
  4. No override UI/behavior remains anywhere.
- [ ] **Step 4:** RLS probe: a student `authenticated` JWT selecting `tutor_week_sections` for a tutor who does NOT teach them returns 0 rows (previously would have returned rows under `using(true)`).
- [ ] **Step 5:** Report results (no success claim until 3.1–3.4 + 4 pass).

---

## Self-Review

- **Spec coverage:** student read view + topic grouping + tutor block (T1); parent mirror (T2); override removal - table, mergeOverride, actions (T3); read-RLS tightening + drop override policies (T4); manual test incl. cross-tutor isolation probe (T5). Matches the Part 2 spec's read-side + the user's decision to tighten reads in 2b.
- **Placeholder scan:** the view/component edits (T1 Step 4, T2 Step 2) are described rather than fully coded because they depend on the exact existing components (sidebar/strip/content) the implementer reads; the query rewrites and the RLS SQL are concrete. T3 is precise removals guarded by a grep gate.
- **Type consistency:** `StudentCurriculumWeek` additions (`topicId`/`topicName`/`tutorNote`/`tutorAttachments`) are introduced in T1 and mirrored in T2; the RLS helpers use the verified column names (`family_links.parent_id/student_id`, `enrollments.class_id/student_id`, `classes.subject_id/tutor_id`, `subject_weeks.id/subject_id`).
