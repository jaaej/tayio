# Subject Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship per-subject weekly curriculum (recorded video, booklet, homework due, completion progress) with admin template, tutor per-class override, student/parent read views.

**Architecture:** 4 new tables (`terms`, `subject_weeks`, `class_week_overrides`, `student_week_progress`) + `week_id` nullable column on `homework`. Admin defines the template per subject per term; tutor overrides per class; read path `COALESCE(override.field, template.field)`. Supabase Storage bucket `curriculum/` holds private video/booklet files; signed URLs minted server-side at render. Replaces existing `/student/subjects/[id]` page; new `/parent/subjects/[id]`, `/tutor/classes/[id]/curriculum`, `/admin/subjects/[id]/curriculum`, `/admin/terms` routes.

**Tech Stack:** Next.js 16 App Router (server components by default, client only where state is needed), React 19, Drizzle ORM over Postgres, Supabase auth + Storage, Tailwind v4, Zod for action validation, lucide-react for icons.

**Reference spec:** `docs/superpowers/specs/2026-05-30-subject-curriculum-design.md`

---

## Pre-flight

This project uses `db:push` (no `drizzle/` migration directory). The executor does **not** run `db:push` themselves — the user runs it after each schema change, after disclosure of effect. CLAUDE.md gates this.

The codebase has no test framework. Verification is `npm run typecheck` (passes `tsc --noEmit`) at each task boundary + a manual browser walkthrough at the end (Task 16). The user starts the dev server themselves (per memory `feedback_dev_server.md`).

Storage requires a one-time bucket creation in Supabase (Task 4). The executor asks the user to do this through the Supabase dashboard — admin credentials are needed.

Key gotchas:
- `db` lives at `@/db/client` (not `@/db`).
- `requireRole(role)` from `@/lib/auth` returns the Supabase user object (`.id`, `.email`). Use the role you passed in.
- Existing `homework` table has nullable `classId` and `lessonId`; adding `weekId` follows the same pattern (nullable, `onDelete: "set null"`).
- The existing `subjects` table has `id, name, ...`. The `classes` table has `subjectId` and `tutorId`. Use these for permission joins.
- Tailwind v4 arbitrary-value classes like `grid-cols-[minmax(0,1fr)_300px]` work; the scanner picks them up. Stick to existing UI patterns from `parent/subjects/[id]` (does not exist yet — model from `student/subjects/[id]` current state + `parent/page.tsx` two-column shell).
- Server actions go in `_actions.ts` per route (already established pattern). Admin actions go in `src/app/admin/_lib/actions-*.ts`.
- Supabase server client: `import { createClient } from "@/lib/supabase/server"` — returns a client that can call `.storage.from("curriculum").createSignedUrl(path, expiresIn)`.

---

## File map

**New files:**
- `src/lib/curriculum.ts` — *create* — `resolveCurrentTerm()`, `currentWeekNumber()`, `mergeOverride()`, types
- `src/lib/curriculum-storage.ts` — *create* — `signCurriculumUrl()`, `uploadCurriculumFile()`, size constants
- `src/app/admin/_lib/actions-terms.ts` — *create* — `createTerm`, `updateTerm`, `deleteTerm`
- `src/app/admin/_lib/actions-curriculum.ts` — *create* — `createSubjectWeek`, `updateSubjectWeek`, `deleteSubjectWeek`, `uploadAdminVideo`, `uploadAdminBooklet`
- `src/app/admin/terms/page.tsx` — *create*
- `src/app/admin/terms/_components/term-form.tsx` — *create*, **client**
- `src/app/admin/subjects/[id]/curriculum/page.tsx` — *create*
- `src/app/admin/subjects/[id]/curriculum/_components/week-editor.tsx` — *create*, **client**
- `src/app/admin/subjects/[id]/curriculum/_components/week-sidebar-admin.tsx` — *create*, **client**
- `src/app/admin/subjects/page.tsx` — *modify if exists, else create* — list subjects with link into `[id]/curriculum`
- `src/app/student/subjects/[id]/page.tsx` — *rewrite*
- `src/app/student/subjects/[id]/_components/week-sidebar.tsx` — *create*, **client**
- `src/app/student/subjects/[id]/_components/week-content.tsx` — *create* — server component
- `src/app/student/subjects/[id]/_components/video-player.tsx` — *create*, **client** — `<video>` + `onPlay` → server action
- `src/app/student/subjects/[id]/_components/booklet-link.tsx` — *create*, **client** — button that calls server action to record open + open URL
- `src/app/student/subjects/[id]/_actions.ts` — *create* — `markVideoWatched`, `markBookletOpened`
- `src/app/student/subjects/[id]/_queries.ts` — *create* — `getStudentCurriculum(userId, subjectId, weekParam)`
- `src/app/parent/subjects/[id]/page.tsx` — *create*
- `src/app/parent/subjects/[id]/_queries.ts` — *create* — `getParentCurriculum(parentId, subjectId, childId, weekParam)`
- `src/app/parent/subjects/[id]/_components/week-sidebar.tsx` — *create*, **client**
- `src/app/parent/subjects/[id]/_components/week-content.tsx` — *create* — server component
- `src/app/tutor/classes/[id]/curriculum/page.tsx` — *create*
- `src/app/tutor/classes/[id]/curriculum/_queries.ts` — *create* — `getTutorCurriculum(tutorId, classId, weekParam)`
- `src/app/tutor/classes/[id]/curriculum/_components/week-sidebar-tutor.tsx` — *create*, **client**
- `src/app/tutor/classes/[id]/curriculum/_components/override-editor.tsx` — *create*, **client**
- `src/app/tutor/_actions.ts` — *modify* — append `upsertClassWeekOverride`, `resetClassWeekOverride`, `uploadTutorOverrideVideo`, `uploadTutorOverrideBooklet`

**Modified files:**
- `src/db/schema.ts` — add `terms`, `subjectWeeks`, `classWeekOverrides`, `studentWeekProgress` + `weekId` column on `homework`
- `src/components/portal/shell.tsx` — add Terms nav for admin role
- `src/app/admin/classes/[id]/page.tsx` — add "Curriculum" link to `/admin/subjects/{subjectId}/curriculum` (helpful nav)
- `src/app/tutor/classes/page.tsx` — add Curriculum link per row
- `src/app/admin/_lib/actions-classes.ts` or wherever homework is created — add `weekId` to schema/form (Task 15)

---

## Task 1: Schema — terms, subject_weeks, class_week_overrides, student_week_progress, week_id on homework

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `weekId` column to existing `homework` table**

Locate the `homework` table definition (around line 211). Add the `weekId` column inside the columns object, just before `createdAt`:

```ts
export const homework = pgTable("homework", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  tutorId: uuid("tutor_id")
    .notNull()
    .references(() => profiles.id),
  title: text("title").notNull(),
  description: text("description"),
  attachmentUrl: text("attachment_url"),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  allowResubmission: boolean("allow_resubmission").notNull().default(false),
  weekId: uuid("week_id").references((): any => subjectWeeks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Note the `(): any => subjectWeeks.id` lazy reference — `subjectWeeks` is declared further down the file so we need the closure.

- [ ] **Step 2: Append `terms` table at the end of `src/db/schema.ts`**

Find the bottom of the file (after the last existing table definition). Append:

```ts
export const terms = pgTable(
  "terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    termNumber: integer("term_number").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("terms_year_term_idx").on(t.year, t.termNumber)],
);
```

- [ ] **Step 3: Append `subjectWeeks` table**

Below `terms`:

```ts
export const subjectWeeks = pgTable(
  "subject_weeks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    videoUrl: text("video_url"),
    bookletUrl: text("booklet_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subject_weeks_unique_idx").on(t.subjectId, t.termId, t.weekNumber),
    index("subject_weeks_subject_idx").on(t.subjectId),
    index("subject_weeks_term_idx").on(t.termId),
  ],
);
```

- [ ] **Step 4: Append `classWeekOverrides` table**

```ts
export const classWeekOverrides = pgTable(
  "class_week_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectWeekId: uuid("subject_week_id")
      .notNull()
      .references(() => subjectWeeks.id, { onDelete: "cascade" }),
    title: text("title"),
    description: text("description"),
    videoUrl: text("video_url"),
    bookletUrl: text("booklet_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("class_week_overrides_unique_idx").on(t.classId, t.subjectWeekId),
    index("class_week_overrides_class_idx").on(t.classId),
  ],
);
```

- [ ] **Step 5: Append `studentWeekProgress` table**

```ts
export const studentWeekProgress = pgTable(
  "student_week_progress",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subjectWeekId: uuid("subject_week_id")
      .notNull()
      .references(() => subjectWeeks.id, { onDelete: "cascade" }),
    videoWatchedAt: timestamp("video_watched_at", { withTimezone: true }),
    bookletOpenedAt: timestamp("booklet_opened_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.subjectWeekId] })],
);
```

- [ ] **Step 6: Export types**

At the bottom of the file (after the new tables):

```ts
export type Term = typeof terms.$inferSelect;
export type SubjectWeek = typeof subjectWeeks.$inferSelect;
export type ClassWeekOverride = typeof classWeekOverrides.$inferSelect;
export type StudentWeekProgress = typeof studentWeekProgress.$inferSelect;
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 8: Ask the user to push schema**

Say to the user:

> "Schema updated: adds 4 new tables (`terms`, `subject_weeks`, `class_week_overrides`, `student_week_progress`) and one nullable column (`week_id` on `homework`). Disclosure: no existing data is altered; the new column is nullable so existing homework rows stay valid. Please run `npm run db:push` and tell me when done."

Wait for user confirmation before continuing.

- [ ] **Step 9: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(curriculum): schema for terms, subject_weeks, overrides, progress"
```

---

## Task 2: Curriculum core lib

**Files:**
- Create: `src/lib/curriculum.ts`

- [ ] **Step 1: Create the file with types + helpers**

```ts
// src/lib/curriculum.ts
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { terms, type SubjectWeek, type ClassWeekOverride, type Term } from "@/db/schema";

export type MergedWeek = {
  subjectWeekId: string;
  weekNumber: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  bookletUrl: string | null;
  hasOverride: boolean;
};

/**
 * Resolve the term that contains `date`. Returns null if `date` is between terms.
 * If multiple terms match (shouldn't happen given unique constraints), returns the earliest.
 */
export async function resolveCurrentTerm(date: Date = new Date()): Promise<Term | null> {
  const isoDate = date.toISOString().slice(0, 10);
  const [row] = await db
    .select()
    .from(terms)
    .where(and(lte(terms.startDate, isoDate), gte(terms.endDate, isoDate)))
    .orderBy(terms.startDate)
    .limit(1);
  return row ?? null;
}

/** Most recent term whose endDate <= date. Used when we're between terms. */
export async function resolveMostRecentPastTerm(date: Date = new Date()): Promise<Term | null> {
  const isoDate = date.toISOString().slice(0, 10);
  const [row] = await db
    .select()
    .from(terms)
    .where(lte(terms.endDate, isoDate))
    .orderBy(desc(terms.endDate))
    .limit(1);
  return row ?? null;
}

/**
 * Compute current week number within a term, clamped to [1, maxWeek].
 * Week 1 = first 7 days starting at term.startDate.
 */
export function currentWeekNumber(
  term: Pick<Term, "startDate" | "endDate">,
  maxWeek: number,
  today: Date = new Date(),
): number {
  const start = new Date(`${term.startDate}T00:00:00`);
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  if (week < 1) return 1;
  if (week > maxWeek) return maxWeek;
  return week;
}

/**
 * Merge a SubjectWeek (template) with an optional ClassWeekOverride.
 * Override field wins when not null.
 */
export function mergeOverride(
  template: SubjectWeek,
  override: ClassWeekOverride | null,
): MergedWeek {
  return {
    subjectWeekId: template.id,
    weekNumber: template.weekNumber,
    title: override?.title ?? template.title,
    description: override?.description ?? template.description,
    videoUrl: override?.videoUrl ?? template.videoUrl,
    bookletUrl: override?.bookletUrl ?? template.bookletUrl,
    hasOverride: Boolean(override),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/curriculum.ts
git commit -m "feat(curriculum): term/week resolution + override merge helpers"
```

---

## Task 3: Storage helpers

**Files:**
- Create: `src/lib/curriculum-storage.ts`

- [ ] **Step 1: Create file with signed-URL + upload helpers**

```ts
// src/lib/curriculum-storage.ts
import { createClient } from "@/lib/supabase/server";

export const BUCKET = "curriculum";
export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export const VIDEO_MAX_BYTES = 500 * 1024 * 1024; // 500 MB
export const BOOKLET_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
export const BOOKLET_MIMES = ["application/pdf"];

/** Mint a short-lived signed URL for a stored path. Returns null if not found. */
export async function signCurriculumUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Upload a file under `kind/{ownerId}.{ext}`. Returns the stored path on success.
 * Caller must enforce permission before invoking.
 */
export async function uploadCurriculumFile(
  kind: "videos" | "booklets",
  ownerId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const maxBytes = kind === "videos" ? VIDEO_MAX_BYTES : BOOKLET_MAX_BYTES;
  const mimes = kind === "videos" ? VIDEO_MIMES : BOOKLET_MIMES;

  if (file.size > maxBytes) {
    return { ok: false, error: `File exceeds max size (${maxBytes / (1024 * 1024)} MB)` };
  }
  if (!mimes.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type}` };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${kind}/${ownerId}.${ext}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/curriculum-storage.ts
git commit -m "feat(curriculum): supabase storage helpers (sign + upload)"
```

---

## Task 4: Create Supabase storage bucket

**Files:** none (manual user step)

- [ ] **Step 1: Ask the user to create the bucket**

Say to the user:

> "I need a Supabase Storage bucket called `curriculum` (private, RLS enabled). In your Supabase dashboard:
>
> 1. Storage → New bucket → name `curriculum`, **Public** unchecked, click **Save**.
> 2. RLS for the bucket: Storage → Policies → New policy for `storage.objects` → name `curriculum-server-only` → for ALL operations → **WITH CHECK** `bucket_id = 'curriculum' AND auth.role() = 'service_role'`. (We sign URLs server-side; no client reads or writes.)
>
> Tell me when done."

Wait for user confirmation. No code change for this task.

---

## Task 5: Admin terms server actions

**Files:**
- Create: `src/app/admin/_lib/actions-terms.ts`

- [ ] **Step 1: Create the actions file**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";

const termInputSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  termNumber: z.coerce.number().int().min(1).max(4),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createTerm(formData: FormData) {
  await requireRole("admin");
  const parsed = termInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  try {
    await db.insert(terms).values(parsed.data);
    revalidatePath("/admin/terms");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function updateTerm(id: string, formData: FormData) {
  await requireRole("admin");
  const parsed = termInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  try {
    await db.update(terms).set(parsed.data).where(eq(terms.id, id));
    revalidatePath("/admin/terms");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function deleteTerm(id: string) {
  await requireRole("admin");
  try {
    await db.delete(terms).where(eq(terms.id, id));
    revalidatePath("/admin/terms");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_lib/actions-terms.ts
git commit -m "feat(admin-terms): server actions for term CRUD"
```

---

## Task 6: Admin terms page + form

**Files:**
- Create: `src/app/admin/terms/page.tsx`
- Create: `src/app/admin/terms/_components/term-form.tsx`

- [ ] **Step 1: Create the term form (client component)**

```tsx
// src/app/admin/terms/_components/term-form.tsx
"use client";

import { useState, useTransition } from "react";
import { createTerm, updateTerm, deleteTerm } from "@/app/admin/_lib/actions-terms";
import type { Term } from "@/db/schema";

export function TermForm({ existing }: { existing?: Term }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = existing
        ? await updateTerm(existing.id, formData)
        : await createTerm(formData);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <form action={submit} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
      <label className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">Year</div>
        <input
          name="year"
          type="number"
          defaultValue={existing?.year ?? new Date().getFullYear()}
          className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
          required
        />
      </label>
      <label className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">Term</div>
        <select
          name="termNumber"
          defaultValue={existing?.termNumber ?? 1}
          className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>Term {n}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">Start</div>
        <input
          name="startDate"
          type="date"
          defaultValue={existing?.startDate ?? ""}
          className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
          required
        />
      </label>
      <label className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">End</div>
        <input
          name="endDate"
          type="date"
          defaultValue={existing?.endDate ?? ""}
          className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
          required
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : existing ? "Save" : "Add"}
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this term? Curriculum rows referencing it will cascade.")) {
                startTransition(async () => {
                  const res = await deleteTerm(existing.id);
                  if (!res.ok) setError(res.error);
                });
              }
            }}
            className="rounded-md border border-red-300 text-red-700 px-3 py-2 text-sm"
          >
            Delete
          </button>
        )}
      </div>
      {error && <div className="col-span-full text-sm text-red-700">{error}</div>}
    </form>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
// src/app/admin/terms/page.tsx
import { db } from "@/db/client";
import { terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { desc } from "drizzle-orm";
import { TermForm } from "./_components/term-form";

export default async function AdminTermsPage() {
  await requireRole("admin");
  const allTerms = await db.select().from(terms).orderBy(desc(terms.year), desc(terms.termNumber));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-medium tracking-tight text-ink uppercase">Terms</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Define academic terms. Curriculum is organised per subject per term.
        </p>
      </header>

      <section className="rounded-2xl border border-hairline/60 bg-card p-5">
        <div className="text-base font-medium text-ink mb-3">Add term</div>
        <TermForm />
      </section>

      <section className="rounded-2xl border border-hairline/60 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline/60 text-base font-medium text-ink">
          All terms
        </div>
        {allTerms.length === 0 ? (
          <div className="p-6 text-sm text-ink-soft">No terms yet.</div>
        ) : (
          <div className="divide-y divide-hairline/60">
            {allTerms.map((t) => (
              <div key={t.id} className="px-5 py-4">
                <TermForm existing={t} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add Terms nav entry for admin in shell**

In `src/components/portal/shell.tsx`, find the `admin: [...]` array inside `NAV_BY_ROLE`. Add a new entry after Announcements (matching existing format):

```ts
{ label: "Terms", href: "/admin/terms", icon: <CalendarDays className={ICON_CLASS} /> },
```

`CalendarDays` is already imported at the top — no new import needed.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/terms/ src/components/portal/shell.tsx
git commit -m "feat(admin-terms): CRUD page + nav entry"
```

---

## Task 7: Admin curriculum server actions

**Files:**
- Create: `src/app/admin/_lib/actions-curriculum.ts`

- [ ] **Step 1: Create the actions file**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subjectWeeks } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { uploadCurriculumFile } from "@/lib/curriculum-storage";

const weekInputSchema = z.object({
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
  weekNumber: z.coerce.number().int().min(1).max(20),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  bookletUrl: z.string().optional(),
});

export async function createSubjectWeek(formData: FormData) {
  await requireRole("admin");
  const parsed = weekInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  try {
    const [row] = await db.insert(subjectWeeks).values(parsed.data).returning();
    revalidatePath(`/admin/subjects/${parsed.data.subjectId}/curriculum`);
    return { ok: true as const, id: row.id };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function updateSubjectWeek(id: string, formData: FormData) {
  await requireRole("admin");
  const parsed = weekInputSchema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  try {
    await db
      .update(subjectWeeks)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(subjectWeeks.id, id));
    if (parsed.data.subjectId) {
      revalidatePath(`/admin/subjects/${parsed.data.subjectId}/curriculum`);
    }
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function deleteSubjectWeek(id: string, subjectId: string) {
  await requireRole("admin");
  try {
    await db.delete(subjectWeeks).where(eq(subjectWeeks.id, id));
    revalidatePath(`/admin/subjects/${subjectId}/curriculum`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function uploadAdminVideo(subjectWeekId: string, formData: FormData) {
  await requireRole("admin");
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "No file" };

  const result = await uploadCurriculumFile("videos", subjectWeekId, file);
  if (!result.ok) return result;

  await db
    .update(subjectWeeks)
    .set({ videoUrl: result.path, updatedAt: new Date() })
    .where(eq(subjectWeeks.id, subjectWeekId));
  return { ok: true as const, path: result.path };
}

export async function uploadAdminBooklet(subjectWeekId: string, formData: FormData) {
  await requireRole("admin");
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "No file" };

  const result = await uploadCurriculumFile("booklets", subjectWeekId, file);
  if (!result.ok) return result;

  await db
    .update(subjectWeeks)
    .set({ bookletUrl: result.path, updatedAt: new Date() })
    .where(eq(subjectWeeks.id, subjectWeekId));
  return { ok: true as const, path: result.path };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_lib/actions-curriculum.ts
git commit -m "feat(admin-curriculum): server actions for subject week CRUD + uploads"
```

---

## Task 8: Admin subject curriculum page + week editor

**Files:**
- Create: `src/app/admin/subjects/[id]/curriculum/page.tsx`
- Create: `src/app/admin/subjects/[id]/curriculum/_components/week-sidebar-admin.tsx`
- Create: `src/app/admin/subjects/[id]/curriculum/_components/week-editor.tsx`

- [ ] **Step 1: Create the admin week sidebar (client)**

```tsx
// src/app/admin/subjects/[id]/curriculum/_components/week-sidebar-admin.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SubjectWeek, Term } from "@/db/schema";

export function WeekSidebarAdmin({
  weeks,
  terms,
  currentTermId,
  subjectId,
}: {
  weeks: SubjectWeek[];
  terms: Term[];
  currentTermId: string;
  subjectId: string;
}) {
  const params = useSearchParams();
  const selectedWeek = params.get("week");

  return (
    <aside className="space-y-3">
      <label className="block text-xs uppercase tracking-wide text-muted">Term</label>
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `/admin/subjects/${subjectId}/curriculum?term=${e.target.value}`;
        }}
        className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
      >
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · Term {t.termNumber}
          </option>
        ))}
      </select>

      <div className="space-y-1">
        {weeks.map((w) => (
          <Link
            key={w.id}
            href={`/admin/subjects/${subjectId}/curriculum?term=${currentTermId}&week=${w.id}`}
            className={
              "block rounded-md px-3 py-2 text-sm " +
              (selectedWeek === w.id
                ? "bg-brand-100 text-ink font-medium"
                : "text-ink-soft hover:bg-brand-50")
            }
          >
            Week {w.weekNumber} · {w.title}
          </Link>
        ))}
        <Link
          href={`/admin/subjects/${subjectId}/curriculum?term=${currentTermId}&new=1`}
          className="block rounded-md px-3 py-2 text-sm text-brand-700 border border-dashed border-brand-300 hover:bg-brand-50"
        >
          + Add week
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create the week editor (client)**

```tsx
// src/app/admin/subjects/[id]/curriculum/_components/week-editor.tsx
"use client";

import { useState, useTransition } from "react";
import {
  createSubjectWeek,
  updateSubjectWeek,
  deleteSubjectWeek,
  uploadAdminVideo,
  uploadAdminBooklet,
} from "@/app/admin/_lib/actions-curriculum";
import type { SubjectWeek } from "@/db/schema";

export function WeekEditor({
  existing,
  subjectId,
  termId,
}: {
  existing?: SubjectWeek;
  subjectId: string;
  termId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formData.set("subjectId", subjectId);
    formData.set("termId", termId);
    setError(null);
    startTransition(async () => {
      const res = existing
        ? await updateSubjectWeek(existing.id, formData)
        : await createSubjectWeek(formData);
      if (!res.ok) setError(res.error);
    });
  }

  async function handleUpload(kind: "video" | "booklet", file: File) {
    if (!existing) {
      setError("Save the week first, then upload files.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    setError(null);
    startTransition(async () => {
      const res =
        kind === "video"
          ? await uploadAdminVideo(existing.id, fd)
          : await uploadAdminBooklet(existing.id, fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      <form action={submit} className="space-y-3">
        <label className="block text-sm">
          <div className="text-xs uppercase tracking-wide text-muted mb-1">Week number</div>
          <input
            name="weekNumber"
            type="number"
            defaultValue={existing?.weekNumber ?? 1}
            className="w-32 rounded-md border border-hairline/60 bg-card px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <div className="text-xs uppercase tracking-wide text-muted mb-1">Title</div>
          <input
            name="title"
            defaultValue={existing?.title ?? ""}
            className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <div className="text-xs uppercase tracking-wide text-muted mb-1">Description</div>
          <textarea
            name="description"
            defaultValue={existing?.description ?? ""}
            rows={3}
            className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Saving…" : existing ? "Save" : "Create week"}
          </button>
          {existing && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this week and all related overrides + progress?")) {
                  startTransition(async () => {
                    const res = await deleteSubjectWeek(existing.id, subjectId);
                    if (!res.ok) setError(res.error);
                    else window.location.href = `/admin/subjects/${subjectId}/curriculum?term=${termId}`;
                  });
                }
              }}
              className="rounded-md border border-red-300 text-red-700 px-3 py-2 text-sm"
            >
              Delete
            </button>
          )}
        </div>
      </form>

      {existing && (
        <div className="space-y-4 border-t border-hairline/60 pt-5">
          <div className="text-base font-medium text-ink">Files</div>
          <FileSlot
            label="Recorded lesson video"
            currentPath={existing.videoUrl}
            accept="video/*"
            onPick={(f) => handleUpload("video", f)}
          />
          <FileSlot
            label="Week booklet (PDF)"
            currentPath={existing.bookletUrl}
            accept="application/pdf"
            onPick={(f) => handleUpload("booklet", f)}
          />
        </div>
      )}

      {error && <div className="text-sm text-red-700">{error}</div>}
    </div>
  );
}

function FileSlot({
  label,
  currentPath,
  accept,
  onPick,
}: {
  label: string;
  currentPath: string | null;
  accept: string;
  onPick: (f: File) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="text-xs uppercase tracking-wide text-muted mb-1">{label}</div>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
        className="text-sm"
      />
      {currentPath && (
        <div className="mt-1 text-xs text-ink-soft truncate">Stored: {currentPath}</div>
      )}
    </label>
  );
}
```

- [ ] **Step 3: Create the page**

```tsx
// src/app/admin/subjects/[id]/curriculum/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subjectWeeks, subjects, terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolveCurrentTerm } from "@/lib/curriculum";
import { WeekSidebarAdmin } from "./_components/week-sidebar-admin";
import { WeekEditor } from "./_components/week-editor";

type SearchParams = Promise<{ term?: string; week?: string; new?: string }>;

export default async function AdminSubjectCurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const { id: subjectId } = await params;
  const { term: termParam, week: weekParam, new: isNew } = await searchParams;

  const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
  if (!subject) notFound();

  const allTerms = await db.select().from(terms).orderBy(desc(terms.year), desc(terms.termNumber));
  const currentTerm = termParam
    ? allTerms.find((t) => t.id === termParam)
    : (await resolveCurrentTerm()) ?? allTerms[0];

  if (!currentTerm) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-medium text-ink">{subject.name} — Curriculum</h1>
        <p className="text-sm text-ink-soft">
          No terms defined yet.{" "}
          <Link href="/admin/terms" className="text-brand-700 hover:underline">
            Create one →
          </Link>
        </p>
      </div>
    );
  }

  const weeks = await db
    .select()
    .from(subjectWeeks)
    .where(and(eq(subjectWeeks.subjectId, subjectId), eq(subjectWeeks.termId, currentTerm.id)))
    .orderBy(asc(subjectWeeks.weekNumber));

  const selectedWeek = weekParam ? weeks.find((w) => w.id === weekParam) : weeks[0];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/admin/subjects"
          className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-ink"
        >
          ← All subjects
        </Link>
        <h1 className="text-3xl font-medium text-ink">{subject.name} — Curriculum</h1>
        <p className="text-sm text-ink-soft">
          {currentTerm.year} · Term {currentTerm.termNumber} · {currentTerm.startDate} to{" "}
          {currentTerm.endDate}
        </p>
      </header>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
        <WeekSidebarAdmin
          weeks={weeks}
          terms={allTerms}
          currentTermId={currentTerm.id}
          subjectId={subjectId}
        />
        <section className="rounded-2xl border border-hairline/60 bg-card p-5">
          {isNew || !selectedWeek ? (
            <WeekEditor subjectId={subjectId} termId={currentTerm.id} />
          ) : (
            <WeekEditor existing={selectedWeek} subjectId={subjectId} termId={currentTerm.id} />
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/subjects/
git commit -m "feat(admin-curriculum): subject curriculum editor page"
```

---

## Task 9: Add curriculum links in admin

**Files:**
- Modify: `src/app/admin/classes/[id]/page.tsx`

- [ ] **Step 1: Add a "Curriculum" link near the existing class header**

Locate the header / action area at the top of the file. After the existing class name + tutor line, add:

```tsx
<Link
  href={`/admin/subjects/${detail.subjectId}/curriculum`}
  className="text-sm text-brand-700 hover:underline"
>
  Open curriculum →
</Link>
```

Adjust the variable name (`detail`, `cls`, etc.) to match what the existing file uses for the loaded class object. If the class detail does not expose `subjectId` yet, add it to the query that loads `detail`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/classes/
git commit -m "feat(admin): curriculum link from class detail"
```

---

## Task 10: Student curriculum queries

**Files:**
- Create: `src/app/student/subjects/[id]/_queries.ts`

- [ ] **Step 1: Create the queries file**

```ts
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekOverrides,
  enrollments,
  homework,
  homeworkAssignments,
  studentWeekProgress,
  subjectWeeks,
  subjects,
  terms,
} from "@/db/schema";
import { resolveCurrentTerm, resolveMostRecentPastTerm, mergeOverride, type MergedWeek } from "@/lib/curriculum";

export type StudentCurriculumWeek = MergedWeek & {
  videoWatchedAt: Date | null;
  bookletOpenedAt: Date | null;
  homework: Array<{
    homeworkId: string;
    title: string;
    dueDate: Date;
    status: string;
    score: string | null;
  }>;
};

export type StudentCurriculumData = {
  subjectName: string;
  className: string;
  currentTerm: { id: string; year: number; termNumber: number; startDate: string; endDate: string };
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: StudentCurriculumWeek[];
  selectedWeekId: string | null;
};

export async function getStudentCurriculum(
  userId: string,
  subjectId: string,
  selectedTermId: string | undefined,
  selectedWeekId: string | undefined,
): Promise<StudentCurriculumData | null> {
  // 1. Find the student's enrollment for this subject.
  const [enrollment] = await db
    .select({ classId: classes.id, className: classes.name, subjectName: subjects.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(and(eq(enrollments.studentId, userId), eq(classes.subjectId, subjectId)))
    .orderBy(asc(enrollments.createdAt))
    .limit(1);
  if (!enrollment) return null;

  // 2. Terms that have at least one subject_week for this subject.
  const termRows = await db
    .selectDistinct({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .innerJoin(subjectWeeks, eq(subjectWeeks.termId, terms.id))
    .where(eq(subjectWeeks.subjectId, subjectId))
    .orderBy(desc(terms.year), desc(terms.termNumber));
  if (termRows.length === 0) return null;

  // 3. Select the term: explicit param wins; otherwise current; otherwise most recent past.
  let term =
    (selectedTermId && termRows.find((t) => t.id === selectedTermId)) ||
    (await resolveCurrentTerm()) ||
    (await resolveMostRecentPastTerm()) ||
    termRows[0];
  // Only use a term that has weeks for THIS subject.
  if (!termRows.find((t) => t.id === term.id)) term = termRows[0];

  // 4. Weeks for that term.
  const templateWeeks = await db
    .select()
    .from(subjectWeeks)
    .where(and(eq(subjectWeeks.subjectId, subjectId), eq(subjectWeeks.termId, term.id)))
    .orderBy(asc(subjectWeeks.weekNumber));
  if (templateWeeks.length === 0) return null;

  const weekIds = templateWeeks.map((w) => w.id);

  // 5. Overrides for this class.
  const overrides = await db
    .select()
    .from(classWeekOverrides)
    .where(
      and(
        eq(classWeekOverrides.classId, enrollment.classId),
        inArray(classWeekOverrides.subjectWeekId, weekIds),
      ),
    );
  const overrideByWeek = new Map(overrides.map((o) => [o.subjectWeekId, o]));

  // 6. Per-student progress.
  const progress = await db
    .select()
    .from(studentWeekProgress)
    .where(
      and(
        eq(studentWeekProgress.studentId, userId),
        inArray(studentWeekProgress.subjectWeekId, weekIds),
      ),
    );
  const progressByWeek = new Map(progress.map((p) => [p.subjectWeekId, p]));

  // 7. Homework tagged with each week.
  const hwRows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      weekId: homework.weekId,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
    })
    .from(homework)
    .innerJoin(
      homeworkAssignments,
      and(
        eq(homeworkAssignments.homeworkId, homework.id),
        eq(homeworkAssignments.studentId, userId),
      ),
    )
    .where(inArray(homework.weekId, weekIds));
  const hwByWeek = new Map<string, typeof hwRows>();
  for (const r of hwRows) {
    if (!r.weekId) continue;
    if (!hwByWeek.has(r.weekId)) hwByWeek.set(r.weekId, []);
    hwByWeek.get(r.weekId)!.push(r);
  }

  // 8. Merge.
  const weeks: StudentCurriculumWeek[] = templateWeeks.map((tpl) => {
    const merged = mergeOverride(tpl, overrideByWeek.get(tpl.id) ?? null);
    const p = progressByWeek.get(tpl.id);
    return {
      ...merged,
      videoWatchedAt: p?.videoWatchedAt ?? null,
      bookletOpenedAt: p?.bookletOpenedAt ?? null,
      homework: (hwByWeek.get(tpl.id) ?? []).map((h) => ({
        homeworkId: h.homeworkId,
        title: h.title,
        dueDate: h.dueDate,
        status: h.status,
        score: h.score,
      })),
    };
  });

  return {
    subjectName: enrollment.subjectName,
    className: enrollment.className,
    currentTerm: {
      id: term.id,
      year: term.year,
      termNumber: term.termNumber,
      startDate: term.startDate,
      endDate: term.endDate,
    },
    termsAvailable: termRows.map((t) => ({ id: t.id, year: t.year, termNumber: t.termNumber })),
    weeks,
    selectedWeekId:
      (selectedWeekId && weeks.find((w) => w.subjectWeekId === selectedWeekId)?.subjectWeekId) ??
      null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/student/subjects/[id]/_queries.ts
git commit -m "feat(student-curriculum): query loader for weeks + overrides + progress + homework"
```

---

## Task 11: Student page rewrite + actions + components

**Files:**
- Create: `src/app/student/subjects/[id]/_actions.ts`
- Create: `src/app/student/subjects/[id]/_components/week-sidebar.tsx`
- Create: `src/app/student/subjects/[id]/_components/video-player.tsx`
- Create: `src/app/student/subjects/[id]/_components/booklet-link.tsx`
- Create: `src/app/student/subjects/[id]/_components/week-content.tsx`
- Rewrite: `src/app/student/subjects/[id]/page.tsx`

- [ ] **Step 1: Create the student server actions**

```ts
// src/app/student/subjects/[id]/_actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekOverrides,
  enrollments,
  studentWeekProgress,
  subjectWeeks,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { signCurriculumUrl } from "@/lib/curriculum-storage";

async function assertStudentCanAccessWeek(studentId: string, subjectWeekId: string) {
  const [row] = await db
    .select({ id: subjectWeeks.id })
    .from(subjectWeeks)
    .innerJoin(classes, eq(classes.subjectId, subjectWeeks.subjectId))
    .innerJoin(enrollments, eq(enrollments.classId, classes.id))
    .where(eq(subjectWeeks.id, subjectWeekId))
    .where(eq(enrollments.studentId, studentId))
    .limit(1);
  return Boolean(row);
}

async function upsertProgress(
  studentId: string,
  subjectWeekId: string,
  field: "videoWatchedAt" | "bookletOpenedAt",
) {
  await db
    .insert(studentWeekProgress)
    .values({ studentId, subjectWeekId, [field]: new Date() })
    .onConflictDoUpdate({
      target: [studentWeekProgress.studentId, studentWeekProgress.subjectWeekId],
      set: { [field]: new Date() },
    });
}

export async function markVideoWatched(subjectWeekId: string) {
  const user = await requireRole("student");
  if (!(await assertStudentCanAccessWeek(user.id, subjectWeekId))) {
    return { ok: false as const, error: "Not enrolled" };
  }
  await upsertProgress(user.id, subjectWeekId, "videoWatchedAt");
  revalidatePath(`/student/subjects`); // detail page revalidates via tag-free path
  return { ok: true as const };
}

export async function markBookletOpened(subjectWeekId: string, classId: string) {
  const user = await requireRole("student");
  if (!(await assertStudentCanAccessWeek(user.id, subjectWeekId))) {
    return { ok: false as const, error: "Not enrolled" };
  }
  // Resolve effective booklet path: override wins.
  const [override] = await db
    .select({ path: classWeekOverrides.bookletUrl })
    .from(classWeekOverrides)
    .where(eq(classWeekOverrides.subjectWeekId, subjectWeekId))
    .where(eq(classWeekOverrides.classId, classId))
    .limit(1);
  const [tpl] = await db
    .select({ path: subjectWeeks.bookletUrl })
    .from(subjectWeeks)
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  const path = override?.path ?? tpl?.path ?? null;
  const url = await signCurriculumUrl(path);
  if (!url) return { ok: false as const, error: "Booklet unavailable" };

  await upsertProgress(user.id, subjectWeekId, "bookletOpenedAt");
  return { ok: true as const, url };
}
```

Note: the two `.where()` chained calls above need to be combined in Drizzle. Replace with `and(...)`:

```ts
import { and } from "drizzle-orm";
// In assertStudentCanAccessWeek:
.where(and(eq(subjectWeeks.id, subjectWeekId), eq(enrollments.studentId, studentId)))
// In markBookletOpened (override lookup):
.where(and(eq(classWeekOverrides.subjectWeekId, subjectWeekId), eq(classWeekOverrides.classId, classId)))
```

- [ ] **Step 2: Create the week sidebar (client)**

```tsx
// src/app/student/subjects/[id]/_components/week-sidebar.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function WeekSidebar({
  subjectId,
  termsAvailable,
  currentTermId,
  weeks,
  currentWeekIdHint,
  selectedWeekId,
}: {
  subjectId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  currentTermId: string;
  weeks: Array<{ subjectWeekId: string; weekNumber: number; title: string }>;
  currentWeekIdHint: string | null;
  selectedWeekId: string | null;
}) {
  const params = useSearchParams();
  const activeWeek = selectedWeekId ?? currentWeekIdHint ?? weeks[0]?.subjectWeekId;
  const baseHref = `/student/subjects/${subjectId}`;

  return (
    <aside className="space-y-3">
      <label className="block text-xs uppercase tracking-wide text-muted">Term</label>
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `${baseHref}?term=${e.target.value}`;
        }}
        className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
      >
        {termsAvailable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · Term {t.termNumber}
          </option>
        ))}
      </select>

      <nav className="space-y-1">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === activeWeek;
          return (
            <Link
              key={w.subjectWeekId}
              href={`${baseHref}?term=${currentTermId}&week=${w.subjectWeekId}`}
              className={
                "block rounded-md px-3 py-2 text-sm transition-colors " +
                (isActive
                  ? "bg-brand-100 text-ink font-medium"
                  : "text-ink-soft hover:bg-brand-50")
              }
            >
              Week {w.weekNumber} · {w.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Create the video player (client)**

```tsx
// src/app/student/subjects/[id]/_components/video-player.tsx
"use client";

import { useRef, useState } from "react";
import { markVideoWatched } from "../_actions";

export function VideoPlayer({
  src,
  subjectWeekId,
  alreadyWatched,
}: {
  src: string;
  subjectWeekId: string;
  alreadyWatched: boolean;
}) {
  const sent = useRef(alreadyWatched);
  const [, setTick] = useState(0);

  return (
    <video
      controls
      className="w-full rounded-xl bg-black"
      onPlay={() => {
        if (sent.current) return;
        sent.current = true;
        markVideoWatched(subjectWeekId).then(() => setTick((n) => n + 1));
      }}
    >
      <source src={src} />
    </video>
  );
}
```

- [ ] **Step 4: Create the booklet link (client)**

```tsx
// src/app/student/subjects/[id]/_components/booklet-link.tsx
"use client";

import { useTransition } from "react";
import { markBookletOpened } from "../_actions";

export function BookletLink({
  subjectWeekId,
  classId,
  alreadyOpened,
}: {
  subjectWeekId: string;
  classId: string;
  alreadyOpened: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await markBookletOpened(subjectWeekId, classId);
          if (res.ok) window.open(res.url, "_blank", "noopener");
          else alert(res.error);
        });
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-4 py-2 text-sm font-medium hover:bg-brand-50"
    >
      {pending ? "Opening…" : alreadyOpened ? "Open PDF (opened earlier)" : "Open PDF →"}
    </button>
  );
}
```

- [ ] **Step 5: Create the week content (server component)**

```tsx
// src/app/student/subjects/[id]/_components/week-content.tsx
import Link from "next/link";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { formatDueDate, relativeTime } from "@/lib/format";
import { VideoPlayer } from "./video-player";
import { BookletLink } from "./booklet-link";
import type { StudentCurriculumWeek } from "../_queries";

export async function WeekContent({
  week,
  classId,
}: {
  week: StudentCurriculumWeek;
  classId: string;
}) {
  const videoSignedUrl = await signCurriculumUrl(week.videoUrl);
  const homeworkDone = week.homework.filter(
    (h) => h.status === "marked" || h.status === "submitted" || h.status === "returned",
  ).length;
  const videoDone = Boolean(week.videoWatchedAt);
  const bookletDone = Boolean(week.bookletOpenedAt);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-[0.18em] text-muted">
          Week {week.weekNumber}
        </div>
        <h2 className="text-2xl font-medium text-ink">{week.title}</h2>
        {week.description && (
          <p className="text-sm text-ink-soft leading-relaxed">{week.description}</p>
        )}
      </header>

      {/* Recorded lesson */}
      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">Recorded lesson</div>
        {videoSignedUrl ? (
          <>
            <VideoPlayer
              src={videoSignedUrl}
              subjectWeekId={week.subjectWeekId}
              alreadyWatched={videoDone}
            />
            <div className="text-xs text-ink-soft">
              {videoDone
                ? `Watched · ${relativeTime(week.videoWatchedAt!)}`
                : "Not watched yet"}
            </div>
          </>
        ) : (
          <div className="text-sm text-ink-soft italic">No video uploaded yet.</div>
        )}
      </section>

      {/* Booklet */}
      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">Week booklet</div>
        {week.bookletUrl ? (
          <BookletLink
            subjectWeekId={week.subjectWeekId}
            classId={classId}
            alreadyOpened={bookletDone}
          />
        ) : (
          <div className="text-sm text-ink-soft italic">No booklet uploaded yet.</div>
        )}
      </section>

      {/* Homework */}
      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">
          Homework due this week
        </div>
        {week.homework.length === 0 ? (
          <div className="text-sm text-ink-soft italic">No homework tagged to this week.</div>
        ) : (
          <ul className="divide-y divide-hairline/60 rounded-xl border border-hairline/60 bg-card overflow-hidden">
            {week.homework.map((h) => (
              <li key={h.homeworkId} className="px-4 py-3">
                <Link href={`/student/homework/${h.homeworkId}`} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-ink truncate">{h.title}</div>
                    <div className="text-xs text-muted">Due {formatDueDate(h.dueDate)}</div>
                  </div>
                  <div className="text-xs uppercase tracking-wide text-ink-soft">
                    {h.score ? `${h.score}` : h.status.replace(/_/g, " ")}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Progress */}
      <section className="rounded-xl border border-hairline/60 bg-brand-50/40 px-4 py-3 text-sm text-ink-soft">
        Progress: {videoDone ? "✓" : "○"} Video · {bookletDone ? "✓" : "○"} Booklet ·{" "}
        {homeworkDone}/{week.homework.length || 0} homework
      </section>
    </div>
  );
}
```

If `formatDueDate` or `relativeTime` aren't exported from `@/lib/format`, find the analogous helpers (currently used in `student/page.tsx`). The current student dashboard imports them from `@/lib/format` so they should exist.

- [ ] **Step 6: Rewrite the student subject page**

Replace the entire contents of `src/app/student/subjects/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, subjects } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { currentWeekNumber } from "@/lib/curriculum";
import { getStudentCurriculum } from "./_queries";
import { WeekSidebar } from "./_components/week-sidebar";
import { WeekContent } from "./_components/week-content";

type SearchParams = Promise<{ term?: string; week?: string }>;

export default async function StudentSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("student");
  const { id: subjectId } = await params;
  const { term: termParam, week: weekParam } = await searchParams;

  const data = await getStudentCurriculum(user.id, subjectId, termParam, weekParam);
  if (!data) {
    // Either not enrolled, or no curriculum yet — distinguish with a quick existence check.
    const [stillEnrolled] = await db
      .select({ id: classes.id })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(and(eq(enrollments.studentId, user.id), eq(classes.subjectId, subjectId)))
      .limit(1);
    if (!stillEnrolled) notFound();
    return (
      <EmptyCurriculum subjectId={subjectId} />
    );
  }

  // Determine the "current" week to default-select if no `?week=` param.
  const maxWeek = data.weeks.reduce((acc, w) => Math.max(acc, w.weekNumber), 0);
  const currentWeekHint =
    data.weeks.find((w) => w.weekNumber === currentWeekNumber(data.currentTerm, maxWeek))
      ?.subjectWeekId ?? null;

  const selectedWeek =
    data.weeks.find((w) => w.subjectWeekId === data.selectedWeekId) ??
    data.weeks.find((w) => w.subjectWeekId === currentWeekHint) ??
    data.weeks[0];

  // Look up classId for booklet action (already in queries data conceptually; refetch quickly).
  const [{ classId }] = await db
    .select({ classId: classes.id })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, user.id), eq(classes.subjectId, subjectId)))
    .orderBy(asc(enrollments.createdAt))
    .limit(1);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/student/subjects"
          className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-ink"
        >
          ← All subjects
        </Link>
        <h1 className="text-3xl font-medium text-ink">{data.subjectName}</h1>
        <p className="text-sm text-ink-soft">
          {data.className} · {data.currentTerm.year} · Term {data.currentTerm.termNumber}
        </p>
      </header>

      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
        <WeekSidebar
          subjectId={subjectId}
          termsAvailable={data.termsAvailable}
          currentTermId={data.currentTerm.id}
          weeks={data.weeks.map((w) => ({
            subjectWeekId: w.subjectWeekId,
            weekNumber: w.weekNumber,
            title: w.title,
          }))}
          currentWeekIdHint={currentWeekHint}
          selectedWeekId={data.selectedWeekId}
        />
        <section className="rounded-2xl border border-hairline/60 bg-card p-5">
          <WeekContent week={selectedWeek} classId={classId} />
        </section>
      </div>
    </div>
  );
}

function EmptyCurriculum({ subjectId }: { subjectId: string }) {
  return (
    <div className="space-y-4">
      <Link
        href="/student/subjects"
        className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-ink"
      >
        ← All subjects
      </Link>
      <div className="rounded-xl border border-hairline/60 bg-card p-6 text-sm text-ink-soft">
        Curriculum coming soon — your tutor is preparing this term's content.
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/student/subjects/[id]/
git commit -m "feat(student-curriculum): replace subject detail with weekly view"
```

---

## Task 12: Tutor override actions

**Files:**
- Modify: `src/app/tutor/_actions.ts`

- [ ] **Step 1: Append the new actions**

Open `src/app/tutor/_actions.ts`. Add these imports if not already present:

```ts
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { classes, classWeekOverrides } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { uploadCurriculumFile } from "@/lib/curriculum-storage";
```

Append at the bottom:

```ts
const overrideSchema = z.object({
  classId: z.string().uuid(),
  subjectWeekId: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  bookletUrl: z.string().optional(),
});

async function assertTutorOwnsClass(tutorId: string, classId: string) {
  const [row] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.tutorId, tutorId)))
    .limit(1);
  return Boolean(row);
}

function isEmptyOverride(o: Partial<{ title: string | null; description: string | null; videoUrl: string | null; bookletUrl: string | null }>) {
  return !o.title && !o.description && !o.videoUrl && !o.bookletUrl;
}

export async function upsertClassWeekOverride(formData: FormData) {
  const user = await requireRole("tutor");
  const parsed = overrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  if (!(await assertTutorOwnsClass(user.id, parsed.data.classId))) {
    return { ok: false as const, error: "Not your class" };
  }

  const { classId, subjectWeekId, ...fields } = parsed.data;
  // Normalize empty strings to null.
  const normalized = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v === "" ? null : v]),
  ) as { title: string | null; description: string | null; videoUrl: string | null; bookletUrl: string | null };

  if (isEmptyOverride(normalized)) {
    // No-op or delete existing row.
    await db
      .delete(classWeekOverrides)
      .where(
        and(
          eq(classWeekOverrides.classId, classId),
          eq(classWeekOverrides.subjectWeekId, subjectWeekId),
        ),
      );
  } else {
    await db
      .insert(classWeekOverrides)
      .values({ classId, subjectWeekId, ...normalized })
      .onConflictDoUpdate({
        target: [classWeekOverrides.classId, classWeekOverrides.subjectWeekId],
        set: { ...normalized, updatedAt: new Date() },
      });
  }

  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const };
}

export async function resetClassWeekOverride(classId: string, subjectWeekId: string) {
  const user = await requireRole("tutor");
  if (!(await assertTutorOwnsClass(user.id, classId))) {
    return { ok: false as const, error: "Not your class" };
  }
  await db
    .delete(classWeekOverrides)
    .where(
      and(
        eq(classWeekOverrides.classId, classId),
        eq(classWeekOverrides.subjectWeekId, subjectWeekId),
      ),
    );
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const };
}

export async function uploadTutorOverrideVideo(
  classId: string,
  subjectWeekId: string,
  formData: FormData,
) {
  const user = await requireRole("tutor");
  if (!(await assertTutorOwnsClass(user.id, classId))) {
    return { ok: false as const, error: "Not your class" };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "No file" };

  const ownerId = `${classId}-${subjectWeekId}`;
  const res = await uploadCurriculumFile("videos", ownerId, file);
  if (!res.ok) return res;

  await db
    .insert(classWeekOverrides)
    .values({ classId, subjectWeekId, videoUrl: res.path })
    .onConflictDoUpdate({
      target: [classWeekOverrides.classId, classWeekOverrides.subjectWeekId],
      set: { videoUrl: res.path, updatedAt: new Date() },
    });
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const, path: res.path };
}

export async function uploadTutorOverrideBooklet(
  classId: string,
  subjectWeekId: string,
  formData: FormData,
) {
  const user = await requireRole("tutor");
  if (!(await assertTutorOwnsClass(user.id, classId))) {
    return { ok: false as const, error: "Not your class" };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "No file" };

  const ownerId = `${classId}-${subjectWeekId}`;
  const res = await uploadCurriculumFile("booklets", ownerId, file);
  if (!res.ok) return res;

  await db
    .insert(classWeekOverrides)
    .values({ classId, subjectWeekId, bookletUrl: res.path })
    .onConflictDoUpdate({
      target: [classWeekOverrides.classId, classWeekOverrides.subjectWeekId],
      set: { bookletUrl: res.path, updatedAt: new Date() },
    });
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const, path: res.path };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/tutor/_actions.ts
git commit -m "feat(tutor-curriculum): override + reset + upload server actions"
```

---

## Task 13: Tutor curriculum page + override editor

**Files:**
- Create: `src/app/tutor/classes/[id]/curriculum/_queries.ts`
- Create: `src/app/tutor/classes/[id]/curriculum/_components/week-sidebar-tutor.tsx`
- Create: `src/app/tutor/classes/[id]/curriculum/_components/override-editor.tsx`
- Create: `src/app/tutor/classes/[id]/curriculum/page.tsx`
- Modify: `src/app/tutor/classes/page.tsx`

- [ ] **Step 1: Create the tutor queries**

```ts
// src/app/tutor/classes/[id]/curriculum/_queries.ts
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekOverrides,
  subjectWeeks,
  subjects,
  terms,
} from "@/db/schema";
import {
  mergeOverride,
  resolveCurrentTerm,
  resolveMostRecentPastTerm,
  type MergedWeek,
} from "@/lib/curriculum";

export type TutorCurriculumWeek = MergedWeek & {
  templateTitle: string;
  templateDescription: string | null;
  templateVideoUrl: string | null;
  templateBookletUrl: string | null;
  overrideTitle: string | null;
  overrideDescription: string | null;
  overrideVideoUrl: string | null;
  overrideBookletUrl: string | null;
};

export type TutorCurriculumData = {
  className: string;
  subjectId: string;
  subjectName: string;
  currentTerm: { id: string; year: number; termNumber: number };
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: TutorCurriculumWeek[];
};

export async function getTutorCurriculum(
  tutorId: string,
  classId: string,
  selectedTermId: string | undefined,
): Promise<TutorCurriculumData | null> {
  const [cls] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(and(eq(classes.id, classId), eq(classes.tutorId, tutorId)))
    .limit(1);
  if (!cls) return null;

  const allTerms = await db
    .select({ id: terms.id, year: terms.year, termNumber: terms.termNumber })
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));

  const term =
    (selectedTermId && allTerms.find((t) => t.id === selectedTermId)) ||
    (await resolveCurrentTerm()) ||
    (await resolveMostRecentPastTerm()) ||
    allTerms[0];
  if (!term) return null;

  const templates = await db
    .select()
    .from(subjectWeeks)
    .where(and(eq(subjectWeeks.subjectId, cls.subjectId), eq(subjectWeeks.termId, term.id)))
    .orderBy(asc(subjectWeeks.weekNumber));
  const weekIds = templates.map((t) => t.id);

  const overrides =
    weekIds.length > 0
      ? await db
          .select()
          .from(classWeekOverrides)
          .where(
            and(
              eq(classWeekOverrides.classId, classId),
              inArray(classWeekOverrides.subjectWeekId, weekIds),
            ),
          )
      : [];
  const overrideByWeek = new Map(overrides.map((o) => [o.subjectWeekId, o]));

  const weeks: TutorCurriculumWeek[] = templates.map((tpl) => {
    const o = overrideByWeek.get(tpl.id) ?? null;
    const merged = mergeOverride(tpl, o);
    return {
      ...merged,
      templateTitle: tpl.title,
      templateDescription: tpl.description,
      templateVideoUrl: tpl.videoUrl,
      templateBookletUrl: tpl.bookletUrl,
      overrideTitle: o?.title ?? null,
      overrideDescription: o?.description ?? null,
      overrideVideoUrl: o?.videoUrl ?? null,
      overrideBookletUrl: o?.bookletUrl ?? null,
    };
  });

  return {
    className: cls.className,
    subjectId: cls.subjectId,
    subjectName: cls.subjectName,
    currentTerm: { id: term.id, year: term.year, termNumber: term.termNumber },
    termsAvailable: allTerms,
    weeks,
  };
}
```

- [ ] **Step 2: Create the tutor week sidebar (client)**

```tsx
// src/app/tutor/classes/[id]/curriculum/_components/week-sidebar-tutor.tsx
"use client";

import Link from "next/link";

export function WeekSidebarTutor({
  classId,
  termsAvailable,
  currentTermId,
  weeks,
  selectedWeekId,
}: {
  classId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  currentTermId: string;
  weeks: Array<{ subjectWeekId: string; weekNumber: number; title: string; hasOverride: boolean }>;
  selectedWeekId: string | null;
}) {
  const base = `/tutor/classes/${classId}/curriculum`;

  return (
    <aside className="space-y-3">
      <label className="block text-xs uppercase tracking-wide text-muted">Term</label>
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `${base}?term=${e.target.value}`;
        }}
        className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
      >
        {termsAvailable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · Term {t.termNumber}
          </option>
        ))}
      </select>

      <nav className="space-y-1">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === selectedWeekId;
          return (
            <Link
              key={w.subjectWeekId}
              href={`${base}?term=${currentTermId}&week=${w.subjectWeekId}`}
              className={
                "block rounded-md px-3 py-2 text-sm flex items-center justify-between gap-2 " +
                (isActive
                  ? "bg-brand-100 text-ink font-medium"
                  : "text-ink-soft hover:bg-brand-50")
              }
            >
              <span className="truncate">Week {w.weekNumber} · {w.title}</span>
              {w.hasOverride && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-amber-700">
                  override
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Create the override editor (client)**

```tsx
// src/app/tutor/classes/[id]/curriculum/_components/override-editor.tsx
"use client";

import { useState, useTransition } from "react";
import {
  resetClassWeekOverride,
  upsertClassWeekOverride,
  uploadTutorOverrideBooklet,
  uploadTutorOverrideVideo,
} from "@/app/tutor/_actions";
import type { TutorCurriculumWeek } from "../_queries";

export function OverrideEditor({
  classId,
  week,
}: {
  classId: string;
  week: TutorCurriculumWeek;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formData.set("classId", classId);
    formData.set("subjectWeekId", week.subjectWeekId);
    setError(null);
    startTransition(async () => {
      const res = await upsertClassWeekOverride(formData);
      if (!res.ok) setError(res.error);
    });
  }

  function handleUpload(kind: "video" | "booklet", file: File) {
    const fd = new FormData();
    fd.set("file", file);
    setError(null);
    startTransition(async () => {
      const res =
        kind === "video"
          ? await uploadTutorOverrideVideo(classId, week.subjectWeekId, fd)
          : await uploadTutorOverrideBooklet(classId, week.subjectWeekId, fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-[0.18em] text-muted">
          Week {week.weekNumber} · template
        </div>
        <h2 className="text-2xl font-medium text-ink">{week.title}</h2>
        {week.description && (
          <p className="text-sm text-ink-soft">{week.description}</p>
        )}
      </header>

      <section className="rounded-xl border border-hairline/60 bg-card p-5 space-y-4">
        <div className="text-sm font-medium text-ink">Override for this class</div>

        <form action={submit} className="space-y-3">
          <label className="block text-sm">
            <div className="text-xs uppercase tracking-wide text-muted mb-1">Title (override)</div>
            <input
              name="title"
              defaultValue={week.overrideTitle ?? ""}
              placeholder={week.templateTitle}
              className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <div className="text-xs uppercase tracking-wide text-muted mb-1">Description (override)</div>
            <textarea
              name="description"
              defaultValue={week.overrideDescription ?? ""}
              placeholder={week.templateDescription ?? ""}
              rows={3}
              className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save text overrides"}
            </button>
            {(week.overrideTitle ||
              week.overrideDescription ||
              week.overrideVideoUrl ||
              week.overrideBookletUrl) && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Reset to template? Override file paths will also be cleared from this row.")) {
                    startTransition(async () => {
                      const res = await resetClassWeekOverride(classId, week.subjectWeekId);
                      if (!res.ok) setError(res.error);
                    });
                  }
                }}
                className="rounded-md border border-red-300 text-red-700 px-3 py-2 text-sm"
              >
                Reset to template
              </button>
            )}
          </div>
        </form>

        <div className="border-t border-hairline/60 pt-4 space-y-3">
          <div className="text-sm font-medium text-ink">Files</div>
          <FileSlot
            label="Video"
            currentPath={week.overrideVideoUrl ?? week.templateVideoUrl}
            isOverride={Boolean(week.overrideVideoUrl)}
            accept="video/*"
            onPick={(f) => handleUpload("video", f)}
          />
          <FileSlot
            label="Booklet (PDF)"
            currentPath={week.overrideBookletUrl ?? week.templateBookletUrl}
            isOverride={Boolean(week.overrideBookletUrl)}
            accept="application/pdf"
            onPick={(f) => handleUpload("booklet", f)}
          />
        </div>

        {error && <div className="text-sm text-red-700">{error}</div>}
      </section>
    </div>
  );
}

function FileSlot({
  label,
  currentPath,
  isOverride,
  accept,
  onPick,
}: {
  label: string;
  currentPath: string | null;
  isOverride: boolean;
  accept: string;
  onPick: (f: File) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="text-xs uppercase tracking-wide text-muted mb-1">
        {label}{" "}
        {isOverride && (
          <span className="text-amber-700">(override)</span>
        )}
      </div>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
        className="text-sm"
      />
      {currentPath && (
        <div className="mt-1 text-xs text-ink-soft truncate">Stored: {currentPath}</div>
      )}
    </label>
  );
}
```

- [ ] **Step 4: Create the page**

```tsx
// src/app/tutor/classes/[id]/curriculum/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getTutorCurriculum } from "./_queries";
import { WeekSidebarTutor } from "./_components/week-sidebar-tutor";
import { OverrideEditor } from "./_components/override-editor";

type SearchParams = Promise<{ term?: string; week?: string }>;

export default async function TutorClassCurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("tutor");
  const { id: classId } = await params;
  const { term: termParam, week: weekParam } = await searchParams;

  const data = await getTutorCurriculum(user.id, classId, termParam);
  if (!data) notFound();

  const selected =
    data.weeks.find((w) => w.subjectWeekId === weekParam) ?? data.weeks[0];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href={`/tutor/classes/${classId}`}
          className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-ink"
        >
          ← Back to class
        </Link>
        <h1 className="text-3xl font-medium text-ink">
          {data.className} — Curriculum
        </h1>
        <p className="text-sm text-ink-soft">
          {data.subjectName} · {data.currentTerm.year} · Term {data.currentTerm.termNumber}
        </p>
      </header>

      {data.weeks.length === 0 ? (
        <div className="rounded-xl border border-hairline/60 bg-card p-6 text-sm text-ink-soft">
          No curriculum has been set up for {data.subjectName} this term yet. An admin
          needs to seed weeks before you can override.
        </div>
      ) : (
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
          <WeekSidebarTutor
            classId={classId}
            termsAvailable={data.termsAvailable}
            currentTermId={data.currentTerm.id}
            weeks={data.weeks.map((w) => ({
              subjectWeekId: w.subjectWeekId,
              weekNumber: w.weekNumber,
              title: w.title,
              hasOverride: w.hasOverride,
            }))}
            selectedWeekId={selected?.subjectWeekId ?? null}
          />
          {selected && <OverrideEditor classId={classId} week={selected} />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add curriculum link from `/tutor/classes` list**

In `src/app/tutor/classes/page.tsx`, find where each class row renders and add a small link/button:

```tsx
<Link
  href={`/tutor/classes/${cls.id}/curriculum`}
  className="text-xs text-brand-700 hover:underline"
>
  Curriculum →
</Link>
```

Place it alongside whatever per-class action links already exist. Use the existing variable name for the class (`cls`, `c`, `klass`, etc).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/tutor/classes/
git commit -m "feat(tutor-curriculum): per-class override editor page"
```

---

## Task 14: Parent read view

**Files:**
- Create: `src/app/parent/subjects/[id]/_queries.ts`
- Create: `src/app/parent/subjects/[id]/_components/week-sidebar.tsx`
- Create: `src/app/parent/subjects/[id]/_components/week-content.tsx`
- Create: `src/app/parent/subjects/[id]/page.tsx`

- [ ] **Step 1: Create parent curriculum query (mirrors student, plus parent-child auth)**

```ts
// src/app/parent/subjects/[id]/_queries.ts
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekOverrides,
  enrollments,
  familyLinks,
  homework,
  homeworkAssignments,
  studentWeekProgress,
  subjectWeeks,
  subjects,
  terms,
} from "@/db/schema";
import {
  mergeOverride,
  resolveCurrentTerm,
  resolveMostRecentPastTerm,
  type MergedWeek,
} from "@/lib/curriculum";

export type ParentCurriculumWeek = MergedWeek & {
  videoWatchedAt: Date | null;
  bookletOpenedAt: Date | null;
  homework: Array<{
    homeworkId: string;
    title: string;
    dueDate: Date;
    status: string;
    score: string | null;
  }>;
};

export type ParentCurriculumData = {
  childFirstName: string;
  subjectName: string;
  className: string;
  classId: string;
  currentTerm: { id: string; year: number; termNumber: number };
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: ParentCurriculumWeek[];
};

export async function getParentCurriculum(
  parentId: string,
  childId: string,
  subjectId: string,
  selectedTermId: string | undefined,
): Promise<ParentCurriculumData | null> {
  // 1. Verify child is linked to parent.
  const [link] = await db
    .select({ studentId: familyLinks.studentId })
    .from(familyLinks)
    .where(and(eq(familyLinks.parentId, parentId), eq(familyLinks.studentId, childId)))
    .limit(1);
  if (!link) return null;

  // 2. Find child enrollment.
  const [enr] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      childFirstName: enrollments.studentId, // placeholder; fetched below
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(and(eq(enrollments.studentId, childId), eq(classes.subjectId, subjectId)))
    .orderBy(asc(enrollments.createdAt))
    .limit(1);
  if (!enr) return null;

  // Get child's first name separately.
  const { profiles } = await import("@/db/schema");
  const [child] = await db
    .select({ firstName: profiles.firstName })
    .from(profiles)
    .where(eq(profiles.id, childId))
    .limit(1);

  // 3. Terms with at least one subject_week for this subject.
  const termRows = await db
    .selectDistinct({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .innerJoin(subjectWeeks, eq(subjectWeeks.termId, terms.id))
    .where(eq(subjectWeeks.subjectId, subjectId))
    .orderBy(desc(terms.year), desc(terms.termNumber));
  if (termRows.length === 0) return null;

  let term =
    (selectedTermId && termRows.find((t) => t.id === selectedTermId)) ||
    (await resolveCurrentTerm()) ||
    (await resolveMostRecentPastTerm()) ||
    termRows[0];
  if (!termRows.find((t) => t.id === term.id)) term = termRows[0];

  const templates = await db
    .select()
    .from(subjectWeeks)
    .where(and(eq(subjectWeeks.subjectId, subjectId), eq(subjectWeeks.termId, term.id)))
    .orderBy(asc(subjectWeeks.weekNumber));
  if (templates.length === 0) return null;
  const weekIds = templates.map((w) => w.id);

  const overrides = await db
    .select()
    .from(classWeekOverrides)
    .where(
      and(
        eq(classWeekOverrides.classId, enr.classId),
        inArray(classWeekOverrides.subjectWeekId, weekIds),
      ),
    );
  const overrideByWeek = new Map(overrides.map((o) => [o.subjectWeekId, o]));

  const progress = await db
    .select()
    .from(studentWeekProgress)
    .where(
      and(
        eq(studentWeekProgress.studentId, childId),
        inArray(studentWeekProgress.subjectWeekId, weekIds),
      ),
    );
  const progressByWeek = new Map(progress.map((p) => [p.subjectWeekId, p]));

  const hwRows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      weekId: homework.weekId,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
    })
    .from(homework)
    .innerJoin(
      homeworkAssignments,
      and(
        eq(homeworkAssignments.homeworkId, homework.id),
        eq(homeworkAssignments.studentId, childId),
      ),
    )
    .where(inArray(homework.weekId, weekIds));
  const hwByWeek = new Map<string, typeof hwRows>();
  for (const r of hwRows) {
    if (!r.weekId) continue;
    if (!hwByWeek.has(r.weekId)) hwByWeek.set(r.weekId, []);
    hwByWeek.get(r.weekId)!.push(r);
  }

  const weeks: ParentCurriculumWeek[] = templates.map((tpl) => {
    const merged = mergeOverride(tpl, overrideByWeek.get(tpl.id) ?? null);
    const p = progressByWeek.get(tpl.id);
    return {
      ...merged,
      videoWatchedAt: p?.videoWatchedAt ?? null,
      bookletOpenedAt: p?.bookletOpenedAt ?? null,
      homework: (hwByWeek.get(tpl.id) ?? []).map((h) => ({
        homeworkId: h.homeworkId,
        title: h.title,
        dueDate: h.dueDate,
        status: h.status,
        score: h.score,
      })),
    };
  });

  return {
    childFirstName: child?.firstName ?? "",
    subjectName: enr.subjectName,
    className: enr.className,
    classId: enr.classId,
    currentTerm: { id: term.id, year: term.year, termNumber: term.termNumber },
    termsAvailable: termRows.map((t) => ({ id: t.id, year: t.year, termNumber: t.termNumber })),
    weeks,
  };
}
```

- [ ] **Step 2: Create the parent sidebar (client, mirror of student sidebar but with `?child=` preserved)**

```tsx
// src/app/parent/subjects/[id]/_components/week-sidebar.tsx
"use client";

import Link from "next/link";

export function WeekSidebarParent({
  subjectId,
  childId,
  termsAvailable,
  currentTermId,
  weeks,
  selectedWeekId,
}: {
  subjectId: string;
  childId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  currentTermId: string;
  weeks: Array<{ subjectWeekId: string; weekNumber: number; title: string }>;
  selectedWeekId: string | null;
}) {
  const base = `/parent/subjects/${subjectId}`;

  return (
    <aside className="space-y-3">
      <label className="block text-xs uppercase tracking-wide text-muted">Term</label>
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `${base}?child=${childId}&term=${e.target.value}`;
        }}
        className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
      >
        {termsAvailable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · Term {t.termNumber}
          </option>
        ))}
      </select>

      <nav className="space-y-1">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === selectedWeekId;
          return (
            <Link
              key={w.subjectWeekId}
              href={`${base}?child=${childId}&term=${currentTermId}&week=${w.subjectWeekId}`}
              className={
                "block rounded-md px-3 py-2 text-sm transition-colors " +
                (isActive
                  ? "bg-brand-100 text-ink font-medium"
                  : "text-ink-soft hover:bg-brand-50")
              }
            >
              Week {w.weekNumber} · {w.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Create the parent week content (server, read-only — no tracking actions)**

```tsx
// src/app/parent/subjects/[id]/_components/week-content.tsx
import Link from "next/link";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { formatDueDate, relativeTime } from "@/lib/format";
import type { ParentCurriculumWeek } from "../_queries";

export async function WeekContentParent({ week }: { week: ParentCurriculumWeek }) {
  const videoSignedUrl = await signCurriculumUrl(week.videoUrl);
  const bookletSignedUrl = await signCurriculumUrl(week.bookletUrl);
  const homeworkDone = week.homework.filter(
    (h) => h.status === "marked" || h.status === "submitted" || h.status === "returned",
  ).length;
  const videoDone = Boolean(week.videoWatchedAt);
  const bookletDone = Boolean(week.bookletOpenedAt);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-[0.18em] text-muted">
          Week {week.weekNumber}
        </div>
        <h2 className="text-2xl font-medium text-ink">{week.title}</h2>
        {week.description && (
          <p className="text-sm text-ink-soft leading-relaxed">{week.description}</p>
        )}
      </header>

      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">Recorded lesson</div>
        {videoSignedUrl ? (
          <>
            <video controls className="w-full rounded-xl bg-black">
              <source src={videoSignedUrl} />
            </video>
            <div className="text-xs text-ink-soft">
              Child status: {videoDone ? `watched · ${relativeTime(week.videoWatchedAt!)}` : "not watched"}
            </div>
          </>
        ) : (
          <div className="text-sm text-ink-soft italic">No video uploaded yet.</div>
        )}
      </section>

      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">Week booklet</div>
        {bookletSignedUrl ? (
          <a
            href={bookletSignedUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-4 py-2 text-sm font-medium hover:bg-brand-50"
          >
            Open PDF →
          </a>
        ) : (
          <div className="text-sm text-ink-soft italic">No booklet uploaded yet.</div>
        )}
        <div className="text-xs text-ink-soft">
          Child status: {bookletDone ? "opened" : "not opened"}
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">
          Homework due this week
        </div>
        {week.homework.length === 0 ? (
          <div className="text-sm text-ink-soft italic">No homework tagged to this week.</div>
        ) : (
          <ul className="divide-y divide-hairline/60 rounded-xl border border-hairline/60 bg-card overflow-hidden">
            {week.homework.map((h) => (
              <li key={h.homeworkId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate">{h.title}</div>
                  <div className="text-xs text-muted">Due {formatDueDate(h.dueDate)}</div>
                </div>
                <div className="text-xs uppercase tracking-wide text-ink-soft">
                  {h.score ? `${h.score}` : h.status.replace(/_/g, " ")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-hairline/60 bg-brand-50/40 px-4 py-3 text-sm text-ink-soft">
        Progress: {videoDone ? "✓" : "○"} Video · {bookletDone ? "✓" : "○"} Booklet ·{" "}
        {homeworkDone}/{week.homework.length || 0} homework
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Create the parent page**

```tsx
// src/app/parent/subjects/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { resolveSelectedChild } from "@/app/parent/_data";
import { currentWeekNumber } from "@/lib/curriculum";
import { getParentCurriculum } from "./_queries";
import { WeekSidebarParent } from "./_components/week-sidebar";
import { WeekContentParent } from "./_components/week-content";

type SearchParams = Promise<{ child?: string; term?: string; week?: string }>;

export default async function ParentSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { id: subjectId } = await params;
  const { child, term, week } = await searchParams;

  const resolved = await resolveSelectedChild(user.id, child);
  if (!resolved.selected) notFound();

  const data = await getParentCurriculum(user.id, resolved.selected.id, subjectId, term);
  if (!data) notFound();

  // Compute term object for currentWeekNumber.
  const fullTerm = data.termsAvailable.find((t) => t.id === data.currentTerm.id);
  if (!fullTerm) notFound();

  const maxWeek = data.weeks.reduce((acc, w) => Math.max(acc, w.weekNumber), 0);
  const currentWeekHint =
    data.weeks.find(
      (w) =>
        w.weekNumber ===
        currentWeekNumber({ startDate: (data as any).currentTermDates?.startDate ?? "", endDate: "" }, maxWeek),
    )?.subjectWeekId ?? null;

  const selected =
    data.weeks.find((w) => w.subjectWeekId === week) ??
    data.weeks.find((w) => w.subjectWeekId === currentWeekHint) ??
    data.weeks[0];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href={`/parent?child=${resolved.selected.id}`}
          className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-ink"
        >
          ← Overview
        </Link>
        <h1 className="text-3xl font-medium text-ink">
          {data.subjectName} — {data.childFirstName}
        </h1>
        <p className="text-sm text-ink-soft">
          {data.className} · Term {data.currentTerm.termNumber} · {data.currentTerm.year}
        </p>
      </header>

      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
        <WeekSidebarParent
          subjectId={subjectId}
          childId={resolved.selected.id}
          termsAvailable={data.termsAvailable}
          currentTermId={data.currentTerm.id}
          weeks={data.weeks.map((w) => ({
            subjectWeekId: w.subjectWeekId,
            weekNumber: w.weekNumber,
            title: w.title,
          }))}
          selectedWeekId={selected?.subjectWeekId ?? null}
        />
        <section className="rounded-2xl border border-hairline/60 bg-card p-5">
          {selected && <WeekContentParent week={selected} />}
        </section>
      </div>
    </div>
  );
}
```

Note the `currentWeekHint` calc above is awkward because the parent query returns only `id/year/termNumber` for `currentTerm` (no dates). Fix: extend the parent query to include `startDate` and `endDate` on `currentTerm`, then use them here. Update `ParentCurriculumData.currentTerm` to include `startDate: string; endDate: string` and copy from `term` in the query.

After fixing, replace the `currentWeekHint` block with:

```tsx
const currentWeekHint =
  data.weeks.find(
    (w) =>
      w.weekNumber ===
      currentWeekNumber(
        { startDate: data.currentTerm.startDate, endDate: data.currentTerm.endDate },
        maxWeek,
      ),
  )?.subjectWeekId ?? null;
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: zero errors. (If errors appear about `currentTerm.startDate` not existing, complete the fix from step 4.)

- [ ] **Step 6: Commit**

```bash
git add src/app/parent/subjects/
git commit -m "feat(parent-curriculum): read-only weekly view per child"
```

---

## Task 15: Add weekId to homework creation forms

**Files:**
- Modify: the tutor homework creation form (search for it: grep for `db.insert(homework)`)
- Modify: any admin form that creates homework, if present

- [ ] **Step 1: Locate the homework creation flow**

Run: `grep -rn "db.insert(homework)" src/`
The form(s) that hit this insert are the ones to modify.

- [ ] **Step 2: Add a week selector to each form**

In each form component that creates homework, add a `<select name="weekId">` populated with the relevant `subjectWeeks` for the class's subject + current term. Default to empty (= no week). Update the server action that handles the insert to read `weekId` from the form and write it to the DB.

Concrete shape for the select:

```tsx
<label className="block text-sm">
  <div className="text-xs uppercase tracking-wide text-muted mb-1">Week (optional)</div>
  <select name="weekId" defaultValue="" className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2">
    <option value="">— Not tagged to a week —</option>
    {availableWeeks.map((w) => (
      <option key={w.id} value={w.id}>Week {w.weekNumber} · {w.title}</option>
    ))}
  </select>
</label>
```

Where `availableWeeks` is fetched by the server component that renders the form (query `subjectWeeks` for the class's subject + current term, ordered by `weekNumber`).

In the server action that runs the insert, accept `weekId: z.string().uuid().optional()` and pass it through. Empty string from the form should be normalised to `null` before insert.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat(homework): allow tagging a homework to a curriculum week"
```

---

## Task 16: Manual E2E walkthrough

**Files:** none — this is verification only.

- [ ] **Step 1: Walk the user through the test plan**

Tell the user the dev server should be running, then ask them to step through:

1. As **admin**: go to `/admin/terms`, create Term 2 (2026) starting today and ending in 10 weeks.
2. As **admin**: go to `/admin/subjects/{any-subject-id}/curriculum`, switch to Term 2, add Week 1 and Week 2 with a title and description each. Upload a small test video and PDF to Week 1.
3. As **student** in a class for that subject: open `/student/subjects/{subject-id}`. Confirm:
   - Sidebar shows Term 2 selected, Week 1 and Week 2 listed.
   - Selecting Week 1 shows the video, the booklet button, no homework.
   - Pressing play on the video updates "Watched · just now" (refresh once).
   - Clicking "Open PDF" opens a new tab; status shows "opened earlier" on refresh.
4. As **tutor** of that class: go to `/tutor/classes/{class-id}/curriculum`. Override Week 1's title with "Custom title". Student refreshes — sees the custom title.
5. Tutor clicks "Reset to template" — student sees template title again.
6. As **admin**: create a homework, tag it to Week 1. Student refreshes — homework appears under Week 1; progress strip shows `0/1 homework`.
7. As **parent** of the student: go to `/parent/subjects/{subject-id}?child={student-id}`. Confirm read-only view shows same weeks + the student's video-watched / booklet-opened state.
8. **Permission probe**: as student A, navigate to a subject ID for a subject they're not enrolled in. Page should 404 (`notFound()`).

Mark off each step as confirmed before ending the task.

- [ ] **Step 2: Update memory with anything surprising**

If anything in the test plan revealed a missing assumption or workaround, save a memory entry under `~/.claude/projects/-Users-jaejeon-Desktop-tayio-portal/memory/` with type `feedback` or `project` and add it to `MEMORY.md`.

---

## Self-Review

Re-read the spec and check each requirement maps to a task:

- **Schema (4 tables + weekId on homework):** Task 1. ✓
- **Read pattern COALESCE override over template:** `mergeOverride()` in Task 2, used by Tasks 10/13/14. ✓
- **Storage bucket + signed URLs:** Tasks 3, 4. ✓
- **Routes — student replaces, parent new, tutor new, admin curriculum + admin terms:** Tasks 6, 8, 11, 13, 14. ✓
- **Permissions:** enforced in each query/action via Drizzle `where` joins (Tasks 5, 7, 10, 12, 14). Permission probe in Task 16. ✓
- **Empty-state messages:** Task 11 (`EmptyCurriculum`), Task 13 (no weeks message). ✓
- **"Current week" computation:** `currentWeekNumber` in Task 2, used in Tasks 11 + 14. ✓
- **Term dropdown visibility (student/parent only show terms with seeded weeks):** student query (Task 10) filters via `innerJoin(subjectWeeks)`; parent query (Task 14) same. Admin/tutor show all terms. ✓
- **Override row with all null fields → delete:** `upsertClassWeekOverride` (Task 12) calls `isEmptyOverride` and deletes. ✓
- **Storage object missing → graceful render:** `signCurriculumUrl` returns null; week content shows "No video / booklet uploaded yet" (Tasks 11, 14). ✓
- **Homework with weekId null → still visible at /student/homework, not in any week:** queries filter by `inArray(homework.weekId, weekIds)`. Existing `/student/homework` not modified. ✓
- **File size + mime enforcement:** `uploadCurriculumFile` in Task 3. ✓
- **Permission failure → notFound():** Task 11 `notFound()`, Task 13 `notFound()`, Task 14 `notFound()`. ✓

**Type consistency check:**
- `MergedWeek` defined in Task 2, extended by `StudentCurriculumWeek` (Task 10), `TutorCurriculumWeek` (Task 13), `ParentCurriculumWeek` (Task 14). Fields all match.
- Server-action signatures: `(formData: FormData)` for form-bound; `(id, formData)` for updates; `(...)` for explicit args. Consistent.
- `requireRole` called with correct literal for each route.

**Placeholder scan:** None — every step has actual code or a concrete user instruction.

**Note on Task 11 `markVideoWatched`:** the `assertStudentCanAccessWeek` helper has TWO chained `.where()` calls in the draft; I flagged this with the required `and(...)` fix. Make sure to apply that fix when writing the file or the code won't compile.

**Note on Task 14:** the `currentTerm` shape in `ParentCurriculumData` needs `startDate` and `endDate` for the parent page to compute `currentWeekHint`. The task body calls this out — make the query include both fields.
