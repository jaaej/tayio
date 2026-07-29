# Tutor Curriculum Sections - Part 2a (write side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tutor add a per-`(tutor, subject-week)` note + file attachments (their own additive material) to any week of a subject they teach, authored on the reshaped `/tutor/classes/[id]/curriculum` page.

**Architecture:** Two new tables (`tutor_week_sections`, `tutor_week_attachments`); the tutor curriculum page shows the admin base **read-only** plus an editable note + attachments block. The old per-class override (empty, unused) is left in place - it and its table are removed in Part 2b along with the student/parent read-view changes. Writes go through tutor-gated server actions; RLS is defense-in-depth.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle/Postgres, Supabase (Storage + raw-SQL RLS), Zod, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-01-tutor-sections-design.md` (Part 2). This plan is **2a of 2** - the write side. 2b does the student/parent read views + removes the override + drops `class_week_overrides`.

## Global Constraints

- **No automated test suite.** Per-task verification is `npm run typecheck 2>&1 | grep -cE "^src/.*error"` printing **0** (ignore pre-existing `.next/types/...d 2.ts` "Duplicate identifier" errors - iCloud artifacts). End-to-end is the manual plan in the final task.
- **Schema is applied with `db:push`, never `db:generate`** (repo tracks no `drizzle/` migration files; generate emits a full-schema baseline). RLS lives in `supabase/migrations/` applied via `node scripts/apply-sql.mjs <file>` (uses `DIRECT_URL`).
- **DB-apply steps are gated:** the controller decides when to run `db:push`, the RLS apply, and the seed. Implementer tasks write code/SQL and commit; they do **not** run DB commands unless the task explicitly says so (this plan marks each DB step `[DB - controller-gated]`).
- **Server-action pattern:** `"use server"`, `await requireRole("tutor")` (or admin) first, Zod-validate, ownership check, return `{ ok: true, ... } | { ok: false, error: string }`, `revalidatePath` the curriculum page.
- **2a keeps the old override in place** (`class_week_overrides`, `mergeOverride`, override actions). Do NOT remove them here - student/parent reads still depend on them until 2b.
- **Branch:** feature branch off `main`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 0: Branch

- [ ] **Step 1:** `git checkout -b feat/tutor-sections-2a`
- [ ] **Step 2:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`

---

## Task 1: Schema - `tutor_week_sections` + `tutor_week_attachments`

**Files:** Modify `src/db/schema.ts`.

**Interfaces produced:**
- `tutorWeekSections { id, tutorId, subjectWeekId, note, createdAt, updatedAt }`, unique `(tutorId, subjectWeekId)`
- `tutorWeekAttachments { id, sectionId, fileName, storagePath, contentType, sizeBytes, uploadedAt }`
- types `TutorWeekSection`, `TutorWeekAttachment`

- [ ] **Step 1:** Add both tables after `subjectWeeks` (so the `subjectWeekId` FK resolves). `integer`, `uniqueIndex`, `index` are already imported.

```ts
export const tutorWeekSections = pgTable(
  "tutor_week_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subjectWeekId: uuid("subject_week_id")
      .notNull()
      .references(() => subjectWeeks.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tutor_week_sections_tutor_week_idx").on(t.tutorId, t.subjectWeekId),
    index("tutor_week_sections_week_idx").on(t.subjectWeekId),
  ],
);

export const tutorWeekAttachments = pgTable(
  "tutor_week_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => tutorWeekSections.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tutor_week_attachments_section_idx").on(t.sectionId)],
);
```

- [ ] **Step 2:** Export types near the other `$inferSelect` exports:

```ts
export type TutorWeekSection = typeof tutorWeekSections.$inferSelect;
export type TutorWeekAttachment = typeof tutorWeekAttachments.$inferSelect;
```

- [ ] **Step 3:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`
- [ ] **Step 4:** Commit (schema.ts only; no `drizzle/` files):

```bash
git add src/db/schema.ts
git commit -m "feat(curriculum): tutor_week_sections + tutor_week_attachments tables

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: RLS migration + SECURITY.md

**Files:** Create `supabase/migrations/0010_tutor_week_sections_rls.sql`; modify `docs/SECURITY.md`.

- [ ] **Step 1 [DB - controller-gated]:** apply the schema - `npm run db:push`. (Controller runs this; implementer skips.)

- [ ] **Step 2:** Write `supabase/migrations/0010_tutor_week_sections_rls.sql`:

```sql
begin;

alter table public.tutor_week_sections enable row level security;
drop policy if exists tutor_week_sections_select_authenticated on public.tutor_week_sections;
drop policy if exists tutor_week_sections_tutor_all on public.tutor_week_sections;
drop policy if exists tutor_week_sections_admin_all on public.tutor_week_sections;

create policy tutor_week_sections_select_authenticated on public.tutor_week_sections
  for select to authenticated using (true);
create policy tutor_week_sections_tutor_all on public.tutor_week_sections
  for all to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());
create policy tutor_week_sections_admin_all on public.tutor_week_sections
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SECURITY DEFINER helper: does the current user own the section this attachment hangs off?
-- Pinned search_path defeats search-path injection; returns bool only (no data leak).
create or replace function public.is_owner_of_tutor_section(p_section_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.tutor_week_sections s
    where s.id = p_section_id and s.tutor_id = auth.uid()
  );
$$;

alter table public.tutor_week_attachments enable row level security;
drop policy if exists tutor_week_attachments_select_authenticated on public.tutor_week_attachments;
drop policy if exists tutor_week_attachments_tutor_all on public.tutor_week_attachments;
drop policy if exists tutor_week_attachments_admin_all on public.tutor_week_attachments;

create policy tutor_week_attachments_select_authenticated on public.tutor_week_attachments
  for select to authenticated using (true);
create policy tutor_week_attachments_tutor_all on public.tutor_week_attachments
  for all to authenticated
  using (public.is_owner_of_tutor_section(section_id))
  with check (public.is_owner_of_tutor_section(section_id));
create policy tutor_week_attachments_admin_all on public.tutor_week_attachments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.tutor_week_sections from anon;
revoke all on public.tutor_week_attachments from anon;
grant select on public.tutor_week_sections to authenticated;
grant select on public.tutor_week_attachments to authenticated;

commit;
```

- [ ] **Step 3 [DB - controller-gated]:** `node scripts/apply-sql.mjs supabase/migrations/0010_tutor_week_sections_rls.sql`.

- [ ] **Step 4:** Add a `### 0010 - tutor_week_sections + attachments RLS` entry to `docs/SECURITY.md` (status, low risk, what-it-does incl. the `is_owner_of_tutor_section` helper, reversible-by: `disable row level security` on both tables + `drop function public.is_owner_of_tutor_section`). Add read + write access-matrix rows for both tables (read: all authenticated; write: tutor-own / admin).

- [ ] **Step 5:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0` (unchanged; SQL + md only).
- [ ] **Step 6:** Commit:

```bash
git add supabase/migrations/0010_tutor_week_sections_rls.sql docs/SECURITY.md
git commit -m "feat(curriculum): RLS for tutor week sections + attachments

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Attachment storage helpers

**Files:** Modify `src/lib/curriculum-storage.ts`.

**Interfaces produced:**
- `uploadTutorAttachment(sectionId: string, fileId: string, file: File): Promise<{ok:true,path:string}|{ok:false,error:string}>`
- `removeCurriculumObject(path: string): Promise<void>`
- consts `ATTACHMENT_MAX_BYTES`, `ATTACHMENT_MIMES`

- [ ] **Step 1:** Append to `curriculum-storage.ts` (reuses `BUCKET`, `createClient` already imported):

```ts
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ATTACHMENT_MIMES = [
  "application/pdf",
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

export async function uploadTutorAttachment(
  sectionId: string,
  fileId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: "File exceeds max size (25 MB)" };
  }
  if (!ATTACHMENT_MIMES.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type}` };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `tutor-sections/${sectionId}/${fileId}.${ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function removeCurriculumObject(path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
```

- [ ] **Step 2:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`
- [ ] **Step 3:** Commit:

```bash
git add src/lib/curriculum-storage.ts
git commit -m "feat(curriculum): storage helpers for tutor attachments

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Tutor section server actions

**Files:** Modify `src/app/tutor/_actions.ts`.

**Interfaces produced:**
- `upsertTutorWeekNote(formData): Promise<{ok:true}|{ok:false,error}>` - form fields `classId`, `subjectWeekId`, `note`
- `addTutorWeekAttachment(formData): Promise<{ok:true}|{ok:false,error}>` - form fields `classId`, `subjectWeekId`, `file`
- `removeTutorWeekAttachment(attachmentId: string, classId: string): Promise<{ok:true}|{ok:false,error}>`

**Interfaces consumed:** `uploadTutorAttachment`, `removeCurriculumObject` (Task 3); `tutorWeekSections`, `tutorWeekAttachments` (Task 1).

> Leave the existing override actions (`upsertClassWeekOverride`, `resetClassWeekOverride`, `uploadTutorOverride*`) untouched - removed in 2b.

- [ ] **Step 1:** Read `src/app/tutor/_actions.ts` to confirm imports (`db`, `requireRole`, `revalidatePath`, `z`, `and`, `eq`, drizzle tables, `classes`, `subjectWeeks`). Add imports as needed: `tutorWeekSections`, `tutorWeekAttachments` from `@/db/schema`; `randomUUID` from `node:crypto`; `uploadTutorAttachment`, `removeCurriculumObject` from `@/lib/curriculum-storage`.

- [ ] **Step 2:** Add the guard + actions:

```ts
async function tutorTeachesSubjectWeek(tutorId: string, subjectWeekId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: classes.id })
    .from(subjectWeeks)
    .innerJoin(
      classes,
      and(eq(classes.subjectId, subjectWeeks.subjectId), eq(classes.tutorId, tutorId)),
    )
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  return Boolean(row);
}

async function ensureTutorSection(tutorId: string, subjectWeekId: string): Promise<string> {
  const [existing] = await db
    .select({ id: tutorWeekSections.id })
    .from(tutorWeekSections)
    .where(and(eq(tutorWeekSections.tutorId, tutorId), eq(tutorWeekSections.subjectWeekId, subjectWeekId)))
    .limit(1);
  if (existing) return existing.id;
  const [row] = await db
    .insert(tutorWeekSections)
    .values({ tutorId, subjectWeekId })
    .returning({ id: tutorWeekSections.id });
  return row.id;
}

const tutorNoteSchema = z.object({
  classId: z.string().uuid(),
  subjectWeekId: z.string().uuid(),
  note: z.string().max(5000).optional(),
});

export async function upsertTutorWeekNote(formData: FormData) {
  const user = await requireRole("tutor");
  const parsed = tutorNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  if (!(await tutorTeachesSubjectWeek(user.id, parsed.data.subjectWeekId))) {
    return { ok: false as const, error: "Not your subject" };
  }
  const note = parsed.data.note?.trim() || null;
  await db
    .insert(tutorWeekSections)
    .values({ tutorId: user.id, subjectWeekId: parsed.data.subjectWeekId, note })
    .onConflictDoUpdate({
      target: [tutorWeekSections.tutorId, tutorWeekSections.subjectWeekId],
      set: { note, updatedAt: new Date() },
    });
  revalidatePath(`/tutor/classes/${parsed.data.classId}/curriculum`);
  return { ok: true as const };
}

const attachmentMetaSchema = z.object({
  classId: z.string().uuid(),
  subjectWeekId: z.string().uuid(),
});

export async function addTutorWeekAttachment(formData: FormData) {
  const user = await requireRole("tutor");
  const parsed = attachmentMetaSchema.safeParse({
    classId: formData.get("classId"),
    subjectWeekId: formData.get("subjectWeekId"),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "No file provided" };
  }
  if (!(await tutorTeachesSubjectWeek(user.id, parsed.data.subjectWeekId))) {
    return { ok: false as const, error: "Not your subject" };
  }
  const sectionId = await ensureTutorSection(user.id, parsed.data.subjectWeekId);
  const up = await uploadTutorAttachment(sectionId, randomUUID(), file);
  if (!up.ok) return { ok: false as const, error: up.error };
  await db.insert(tutorWeekAttachments).values({
    sectionId,
    fileName: file.name,
    storagePath: up.path,
    contentType: file.type || null,
    sizeBytes: file.size,
  });
  revalidatePath(`/tutor/classes/${parsed.data.classId}/curriculum`);
  return { ok: true as const };
}

export async function removeTutorWeekAttachment(attachmentId: string, classId: string) {
  const user = await requireRole("tutor");
  const [row] = await db
    .select({ path: tutorWeekAttachments.storagePath, tutorId: tutorWeekSections.tutorId })
    .from(tutorWeekAttachments)
    .innerJoin(tutorWeekSections, eq(tutorWeekSections.id, tutorWeekAttachments.sectionId))
    .where(eq(tutorWeekAttachments.id, attachmentId))
    .limit(1);
  if (!row || row.tutorId !== user.id) return { ok: false as const, error: "Not found" };
  await db.delete(tutorWeekAttachments).where(eq(tutorWeekAttachments.id, attachmentId));
  await removeCurriculumObject(row.path);
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const };
}
```

- [ ] **Step 3:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`
- [ ] **Step 4:** Commit:

```bash
git add src/app/tutor/_actions.ts
git commit -m "feat(curriculum): tutor week section note + attachment actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Tutor curriculum query - base + section (drop override usage)

**Files:** Rewrite `src/app/tutor/classes/[id]/curriculum/_queries.ts`.

**Interfaces produced:** `TutorCurriculumWeek` (new shape) + `getTutorCurriculum(tutorId, classId, selectedTermId)` returning `TutorCurriculumData`.

New week shape (replaces the override/template split):
```ts
export type TutorSectionAttachment = { id: string; fileName: string; storagePath: string };
export type TutorCurriculumWeek = {
  subjectWeekId: string;
  weekNumber: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  bookletUrl: string | null;
  note: string | null;               // the tutor's section note
  attachments: TutorSectionAttachment[];
  hasSection: boolean;               // note or ≥1 attachment
  homework: Array<{ id: string; title: string; dueDate: Date }>;
};
```

- [ ] **Step 1:** Rewrite the file: keep the class lookup, terms resolution, `templates` (subjectWeeks) and `homework` queries. **Remove** the `classWeekOverrides` import + query + `mergeOverride` import/usage. Add queries for the tutor's sections and their attachments over `weekIds`, keyed by `subjectWeekId`:

```ts
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes, homework, subjectWeeks, subjects, terms,
  tutorWeekSections, tutorWeekAttachments,
} from "@/db/schema";
import { resolveCurrentTerm, resolveMostRecentPastTerm } from "@/lib/curriculum";
```

For the section data (after computing `weekIds`):
```ts
  const sections = weekIds.length
    ? await db.select().from(tutorWeekSections).where(and(
        eq(tutorWeekSections.tutorId, tutorId),
        inArray(tutorWeekSections.subjectWeekId, weekIds),
      ))
    : [];
  const sectionByWeek = new Map(sections.map((s) => [s.subjectWeekId, s]));
  const sectionIds = sections.map((s) => s.id);
  const atts = sectionIds.length
    ? await db.select({
        id: tutorWeekAttachments.id,
        sectionId: tutorWeekAttachments.sectionId,
        fileName: tutorWeekAttachments.fileName,
        storagePath: tutorWeekAttachments.storagePath,
      }).from(tutorWeekAttachments).where(inArray(tutorWeekAttachments.sectionId, sectionIds))
    : [];
  const attBySection = new Map<string, TutorSectionAttachment[]>();
  for (const a of atts) {
    if (!attBySection.has(a.sectionId)) attBySection.set(a.sectionId, []);
    attBySection.get(a.sectionId)!.push({ id: a.id, fileName: a.fileName, storagePath: a.storagePath });
  }
```

Build each week from the template + its section:
```ts
  const weeks: TutorCurriculumWeek[] = templates.map((tpl) => {
    const s = sectionByWeek.get(tpl.id) ?? null;
    const attachments = s ? (attBySection.get(s.id) ?? []) : [];
    return {
      subjectWeekId: tpl.id,
      weekNumber: tpl.weekNumber,
      title: tpl.title,
      description: tpl.description,
      videoUrl: tpl.videoUrl,
      bookletUrl: tpl.bookletUrl,
      note: s?.note ?? null,
      attachments,
      hasSection: Boolean(s?.note) || attachments.length > 0,
      homework: hwByWeek.get(tpl.id) ?? [],
    };
  });
```

`TutorCurriculumData` is unchanged except `weeks: TutorCurriculumWeek[]`.

- [ ] **Step 2:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → will FAIL until Task 6 (the page/components still reference the old shape). That's expected mid-task; do not commit yet. If you want an isolated green commit, do Task 6 in the same commit - see Task 6 Step 4.

---

## Task 6: Tutor curriculum UI - section editor

**Files:** Create `src/app/tutor/classes/[id]/curriculum/_components/section-editor.tsx`; modify `page.tsx` and `_components/week-strip-tutor.tsx`; **delete** `_components/override-editor.tsx`.

**Interfaces consumed:** `TutorCurriculumWeek` (Task 5); actions `upsertTutorWeekNote`, `addTutorWeekAttachment`, `removeTutorWeekAttachment` (Task 4); `signCurriculumUrl` from `@/lib/curriculum-storage` for base video/booklet + attachment download links; `createHomework` (existing) for the kept homework block.

- [ ] **Step 1:** Create `section-editor.tsx` (client). Three parts: (a) **base, read-only** - week title/description + base video/booklet links, labelled "Set by admin"; (b) **your section** - a note `<textarea>` posting `upsertTutorWeekNote` (hidden `classId`, `subjectWeekId`), plus an attachments list (each with a remove button calling `removeTutorWeekAttachment(att.id, classId)`) and a file `<input>` posting `addTutorWeekAttachment`; (c) **homework block** - copy the existing homework list + `createHomework` form verbatim from `override-editor.tsx` (lines 150–244) so that functionality is preserved. Add a hint line: "Shared across all your {subjectName} classes." Use `useTransition` + inline error, matching the existing editor's patterns. Signed URLs for base files/attachments are minted server-side - pass them in as props from the page (see Step 2), or render download links that hit an existing signing route; simplest: have the page pre-sign and pass `attachments` with a `url` field. (Implementer: pre-sign in the page Server Component and extend the prop with `url`.)

- [ ] **Step 2:** In `page.tsx`, replace the `OverrideEditor` import + usage with `SectionEditor`, pass `classId`, `week={selected}`, and `subjectName={data.subjectName}`. Pre-sign attachment + base file URLs in the Server Component before passing down (use `signCurriculumUrl`). The `WeekStripTutor` prop `hasOverride` becomes `hasSection` - update the `.map` (`hasOverride: w.hasOverride` → `hasSection: w.hasSection`).

- [ ] **Step 3:** In `week-strip-tutor.tsx`, rename the `hasOverride` field/label to `hasSection` (and any "override" wording → "your notes"/"section"). Read the file first; keep its layout.

- [ ] **Step 4:** Delete `override-editor.tsx`:
```bash
git rm "src/app/tutor/classes/[id]/curriculum/_components/override-editor.tsx"
```

- [ ] **Step 5:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0` (Tasks 5 + 6 together make it green).
- [ ] **Step 6:** Commit Tasks 5 + 6 together (they are one green unit):

```bash
git add "src/app/tutor/classes/[id]/curriculum/_queries.ts" \
        "src/app/tutor/classes/[id]/curriculum/page.tsx" \
        "src/app/tutor/classes/[id]/curriculum/_components/section-editor.tsx" \
        "src/app/tutor/classes/[id]/curriculum/_components/week-strip-tutor.tsx"
git commit -m "feat(curriculum): tutor curriculum shows read-only base + editable section

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Note for the controller: Tasks 5 and 6 share one commit because the query shape change (5) and its consumers (6) must land together to stay green. Review them as one unit.

---

## Task 7: Seed a demo tutor section

**Files:** Modify `scripts/seed-demo.mjs`.

- [ ] **Step 1:** After weeks are seeded, insert one `tutor_week_sections` row (note only, no attachment) for one class's tutor + one of that subject's weeks, so the demo shows a populated section. Reuse the file's `sql` client + `on conflict (tutor_id, subject_week_id) do update` for idempotency. Look up a real `tutor_id` (a class's tutor) + a `subject_week_id` for that class's subject.

- [ ] **Step 2:** `node --check scripts/seed-demo.mjs` parses; `npm run typecheck` → `0` src errors.
- [ ] **Step 3 [DB - controller-gated]:** `node scripts/seed-demo.mjs`.
- [ ] **Step 4:** Commit:

```bash
git add scripts/seed-demo.mjs
git commit -m "chore(seed): seed a demo tutor week section

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Manual verification

- [ ] **Step 1:** `npm run typecheck 2>&1 | grep -cE "^src/.*error"` → `0`
- [ ] **Step 2:** On the dev server (user starts it), as a tutor open `/tutor/classes/<a class>/curriculum`:
  1. Base content shows as read-only ("Set by admin").
  2. Write a note, save, reload → persists.
  3. Upload an attachment → appears with a download link; remove it → gone.
  4. The "shared across your {subject} classes" hint shows; the homework block still works (list + assign).
  5. The old "Override / Reset to template" UI is gone.
- [ ] **Step 3:** RLS probe: a non-admin `authenticated` JWT cannot insert a `tutor_week_sections` row for another tutor.
- [ ] **Step 4:** Report results (no success claim until 2.1–2.5 pass).

---

## Self-Review

- **Spec coverage (2a scope):** new tables (T1); RLS + helper + SECURITY.md (T2); storage (T3); tutor actions with ownership guard (T4); base-read-only + section editor + shared-scope hint (T5–T6); seed (T7); manual test (T8). Override removal + student/parent reads are correctly deferred to 2b.
- **Placeholder scan:** Task 6 pre-signing/URL prop is described (implementer pre-signs in the Server Component) rather than fully coded because it depends on the exact page render; all new tables, RLS, storage helpers, and actions are concrete. Task 7 seed insert is described (adapts to local seed vars).
- **Type consistency:** action form fields (`classId`, `subjectWeekId`, `note`, `file`) match the section-editor forms; `TutorCurriculumWeek` (T5) fields (`note`, `attachments`, `hasSection`) match the editor + strip consumers (T6); `uploadTutorAttachment`/`removeCurriculumObject` (T3) signatures match their callers (T4).
