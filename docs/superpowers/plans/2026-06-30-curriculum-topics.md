# Curriculum Topics (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a topic layer above the existing weekly curriculum so admins can group a subject's weeks under topics (Subject → Topic → Week).

**Architecture:** A new `subject_topics` table (per subject) plus a nullable `topic_id` on `subject_weeks`. Admin authoring extends the existing `/admin/subjects/[id]/curriculum` page with a topics panel and a topic selector on the week editor. Writes go through admin server actions following the established `{ ok, error }` + Zod + `requireRole("admin")` pattern; server-side Drizzle (postgres role) bypasses RLS, which is added as defense-in-depth.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM (Postgres), Supabase (raw SQL for RLS), Zod, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-30-curriculum-topics-design.md` (Part 1 of 3).

## Global Constraints

- **No automated test suite exists.** Per-task verification is `npm run typecheck` showing **0 errors under `src/`** (ignore pre-existing `.next/types/...d 2.ts` "Duplicate identifier" errors — they are iCloud-sync artifacts, not code). End-to-end behaviour is verified with the manual test plan in Task 7, run by the user on their own dev server (do not start `npm run dev` unsolicited).
- **Migration boundary** (`docs/SECURITY.md`): Drizzle owns table DDL (`src/db/schema.ts`, `drizzle/`); raw SQL owns RLS/policies (`supabase/migrations/`). Apply Drizzle first, then raw SQL. Never re-define a policy in Drizzle.
- **Server-action pattern:** every action is `"use server"`, calls `await requireRole("admin")` first, validates input with Zod, returns `{ ok: true, ... } | { ok: false, error: string }`, and `revalidatePath`s the curriculum page.
- **This is Part 1 only:** no student/parent-facing change, no tutor section, no mastery. Do not build those here.
- **Branch:** all work on a feature branch off `main` (we are on the default branch). Commit messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 0: Create the working branch

- [ ] **Step 1: Branch off main**

```bash
git checkout -b feat/curriculum-topics
```

- [ ] **Step 2: Confirm clean starting point**

Run: `npm run typecheck 2>&1 | grep -cE "^src/.*error"`
Expected: `0`

---

## Task 1: Schema — `subject_topics` table + `subject_weeks.topic_id`

**Files:**
- Modify: `src/db/schema.ts` (add `subjectTopics` immediately before `subjectWeeks`; add `topicId` column to `subjectWeeks`; export `SubjectTopic` type)

> **Note:** this project has never used Drizzle migration files — schema is applied with `db:push` (Task 2), and RLS lives in `supabase/migrations/`. Do **not** run `db:generate` (it would emit a full-schema baseline). Task 1 changes `schema.ts` only.

**Interfaces:**
- Produces: `subjectTopics` table `{ id, subjectId, name, position, createdAt, updatedAt }`; `subjectWeeks.topicId: string | null`; type `SubjectTopic = typeof subjectTopics.$inferSelect`.

- [ ] **Step 1: Add the `subjectTopics` table**

Insert immediately **before** the `export const subjectWeeks` definition in `src/db/schema.ts` (so the `subjectWeeks.topicId` reference resolves without a forward ref). `integer`, `uniqueIndex`, and `index` are already imported in this file.

```ts
export const subjectTopics = pgTable(
  "subject_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subject_topics_subject_name_idx").on(t.subjectId, t.name),
    index("subject_topics_subject_idx").on(t.subjectId),
  ],
);
```

- [ ] **Step 2: Add `topicId` to `subjectWeeks`**

In the `subjectWeeks` column block, add after `termId` (or anywhere in the column list):

```ts
    topicId: uuid("topic_id").references(() => subjectTopics.id, { onDelete: "set null" }),
```

- [ ] **Step 3: Export the type**

Next to the existing `export type SubjectWeek = ...` line:

```ts
export type SubjectTopic = typeof subjectTopics.$inferSelect;
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck 2>&1 | grep -cE "^src/.*error"`
Expected: `0`

- [ ] **Step 5: Commit** (schema.ts only — do NOT commit any `drizzle/` files)

```bash
git add src/db/schema.ts
git commit -m "feat(curriculum): add subject_topics table + subject_weeks.topic_id

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Apply schema + RLS to the database

**Files:**
- Create: `supabase/migrations/0009_subject_topics_rls.sql`
- Modify: `docs/SECURITY.md` (migration log entry + access-matrix row)

**Interfaces:**
- Consumes: `subject_topics` table from Task 1.
- Produces: RLS-protected `subject_topics` (admin write, authenticated read).

> **Destructive-action note:** this applies DDL + RLS to the live Supabase project. It is **additive and low-risk** — a new table and a new nullable column, no existing rows rewritten, no data lost. Still, confirm with the user before running the apply commands if this is the production project.

- [ ] **Step 1: Apply the Drizzle DDL**

Run: `npm run db:push`
Expected: applies `subject_topics` + `subject_weeks.topic_id` with no errors.

- [ ] **Step 2: Write the RLS migration**

Create `supabase/migrations/0009_subject_topics_rls.sql`, mirroring the existing `subjects` policies (`0004_rls_enable_and_policies.sql:170-179`):

```sql
begin;

alter table public.subject_topics enable row level security;

drop policy if exists subject_topics_select_authenticated on public.subject_topics;
drop policy if exists subject_topics_admin_all on public.subject_topics;

create policy subject_topics_select_authenticated on public.subject_topics
  for select to authenticated using (true);

create policy subject_topics_admin_all on public.subject_topics
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.subject_topics from anon;
grant select on public.subject_topics to authenticated;

commit;
```

- [ ] **Step 3: Apply the RLS migration**

Run: `node scripts/apply-sql.mjs supabase/migrations/0009_subject_topics_rls.sql`
Expected: applies cleanly via the session pooler (`DIRECT_URL`).

- [ ] **Step 4: Verify RLS**

Run:
```bash
node scripts/apply-sql.mjs <(echo "select relrowsecurity from pg_class where relname='subject_topics';")
```
Expected: `relrowsecurity = t` (true). (If `apply-sql.mjs` doesn't accept process substitution, run the query in Supabase SQL editor instead.)

- [ ] **Step 5: Log it in `docs/SECURITY.md`**

Add a `### 0009 — subject_topics RLS` entry to the migration log (status, low risk, what-it-does, reversible-by `alter table public.subject_topics disable row level security;`), and add a `subject_topics` row to the read + write access matrices (read: all authenticated; write: admin only).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0009_subject_topics_rls.sql docs/SECURITY.md
git commit -m "feat(curriculum): RLS for subject_topics (admin write, auth read)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Topic server actions + week topic assignment

**Files:**
- Create: `src/app/admin/_lib/actions-topics.ts`
- Modify: `src/app/admin/_lib/actions-curriculum.ts` (extend `weekInputSchema` with `topicId`)

**Interfaces:**
- Consumes: `subjectTopics` table.
- Produces:
  - `createSubjectTopic(formData: FormData): Promise<{ok:true,id:string}|{ok:false,error:string}>`
  - `renameSubjectTopic(id: string, subjectId: string, formData: FormData): Promise<{ok:true}|{ok:false,error:string}>`
  - `reorderSubjectTopic(id: string, subjectId: string, direction: "up"|"down"): Promise<{ok:true}|{ok:false,error:string}>`
  - `deleteSubjectTopic(id: string, subjectId: string): Promise<{ok:true}|{ok:false,error:string}>`
  - `weekInputSchema` now accepts optional `topicId` (uuid or null; `""` → null).

- [ ] **Step 1: Create `actions-topics.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { subjectTopics } from "@/db/schema";
import { requireRole } from "@/lib/auth";

const DUP = (msg: string) =>
  msg.includes("subject_topics_subject_name_idx") || msg.includes("duplicate");

const createSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().min(1).max(200),
});

export async function createSubjectTopic(formData: FormData) {
  await requireRole("admin");
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  try {
    const last = await db
      .select({ position: subjectTopics.position })
      .from(subjectTopics)
      .where(eq(subjectTopics.subjectId, parsed.data.subjectId))
      .orderBy(desc(subjectTopics.position))
      .limit(1);
    const nextPos = (last[0]?.position ?? -1) + 1;
    const [row] = await db
      .insert(subjectTopics)
      .values({ ...parsed.data, position: nextPos })
      .returning();
    revalidatePath(`/admin/subjects/${parsed.data.subjectId}/curriculum`);
    return { ok: true as const, id: row.id };
  } catch (err) {
    const msg = (err as Error).message;
    return { ok: false as const, error: DUP(msg) ? "A topic with that name already exists." : msg };
  }
}

export async function renameSubjectTopic(id: string, subjectId: string, formData: FormData) {
  await requireRole("admin");
  const parsed = z
    .object({ name: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  try {
    await db
      .update(subjectTopics)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(subjectTopics.id, id));
    revalidatePath(`/admin/subjects/${subjectId}/curriculum`);
    return { ok: true as const };
  } catch (err) {
    const msg = (err as Error).message;
    return { ok: false as const, error: DUP(msg) ? "A topic with that name already exists." : msg };
  }
}

export async function reorderSubjectTopic(
  id: string,
  subjectId: string,
  direction: "up" | "down",
) {
  await requireRole("admin");
  try {
    const topics = await db
      .select()
      .from(subjectTopics)
      .where(eq(subjectTopics.subjectId, subjectId))
      .orderBy(asc(subjectTopics.position));
    const idx = topics.findIndex((t) => t.id === id);
    if (idx === -1) return { ok: false as const, error: "Topic not found." };
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= topics.length) return { ok: true as const }; // no-op at ends
    const a = topics[idx];
    const b = topics[swap];
    await db.update(subjectTopics).set({ position: b.position }).where(eq(subjectTopics.id, a.id));
    await db.update(subjectTopics).set({ position: a.position }).where(eq(subjectTopics.id, b.id));
    revalidatePath(`/admin/subjects/${subjectId}/curriculum`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function deleteSubjectTopic(id: string, subjectId: string) {
  await requireRole("admin");
  try {
    // subject_weeks.topic_id is ON DELETE SET NULL, so weeks become unassigned.
    await db.delete(subjectTopics).where(eq(subjectTopics.id, id));
    revalidatePath(`/admin/subjects/${subjectId}/curriculum`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
```

- [ ] **Step 2: Extend `weekInputSchema` in `actions-curriculum.ts`**

Add a `topicId` field that maps an empty string (the "Unassigned" option) to `null`:

```ts
const weekInputSchema = z.object({
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
  weekNumber: z.coerce.number().int().min(1).max(20),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  bookletUrl: z.string().optional(),
  topicId: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().uuid().nullable(),
  ),
});
```

No other change is needed in `createSubjectWeek` / `updateSubjectWeek` — they spread `parsed.data`, so `topicId` flows through to insert/update (including `null` to unassign).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck 2>&1 | grep -cE "^src/.*error"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/_lib/actions-topics.ts src/app/admin/_lib/actions-curriculum.ts
git commit -m "feat(curriculum): topic CRUD actions + week topic assignment

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Topics panel component

**Files:**
- Create: `src/app/admin/subjects/[id]/curriculum/_components/topics-panel.tsx`

**Interfaces:**
- Consumes: actions from Task 3; `SubjectTopic` type.
- Produces: `<TopicsPanel subjectId={string} topics={Array<{id,name,position}>} weekCounts={Record<string, number>} />`.

- [ ] **Step 1: Create the client component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import {
  createSubjectTopic,
  renameSubjectTopic,
  reorderSubjectTopic,
  deleteSubjectTopic,
} from "@/app/admin/_lib/actions-topics";

type Topic = { id: string; name: string; position: number };

export function TopicsPanel({
  subjectId,
  topics,
  weekCounts,
}: {
  subjectId: string;
  topics: Topic[];
  weekCounts: Record<string, number>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else setEditingId(null);
    });
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4 space-y-3">
      <div className="text-[14px] font-bold text-ink">Topics</div>

      {topics.length === 0 ? (
        <div className="text-[13px] text-ink-soft">
          No topics yet. Add one below, then assign weeks to it.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {topics.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2">
              {editingId === t.id ? (
                <form
                  action={(fd) => run(() => renameSubjectTopic(t.id, subjectId, fd))}
                  className="flex-1 flex items-center gap-2"
                >
                  <input
                    name="name"
                    defaultValue={t.name}
                    className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-ink"
                    required
                    autoFocus
                  />
                  <Button type="submit" disabled={pending}>Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-[14px] text-ink">{t.name}</span>
                  <button
                    type="button"
                    disabled={pending || i === 0}
                    onClick={() => run(() => reorderSubjectTopic(t.id, subjectId, "up"))}
                    className="px-2 py-1 text-ink-soft disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending || i === topics.length - 1}
                    onClick={() => run(() => reorderSubjectTopic(t.id, subjectId, "down"))}
                    className="px-2 py-1 text-ink-soft disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(t.id)}>
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={pending}
                    onClick={() => {
                      const n = weekCounts[t.id] ?? 0;
                      const msg =
                        n > 0
                          ? `Delete "${t.name}"? ${n} week${n === 1 ? "" : "s"} will become unassigned.`
                          : `Delete "${t.name}"?`;
                      if (confirm(msg)) run(() => deleteSubjectTopic(t.id, subjectId));
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        action={(fd) => {
          fd.set("subjectId", subjectId);
          run(() => createSubjectTopic(fd));
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          name="name"
          placeholder="New topic name"
          className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-ink"
          required
        />
        <Button type="submit" disabled={pending}>Add topic</Button>
      </form>

      {error && <div className="text-[13px] font-semibold text-bad">{error}</div>}
    </div>
  );
}
```

> If `Button` has no `"ghost"` variant, use the closest existing non-primary variant (check `src/components/admin/ui`); do not add a new variant for this.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck 2>&1 | grep -cE "^src/.*error"`
Expected: `0` (fix any `Button` variant mismatch per the note above)

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/subjects/[id]/curriculum/_components/topics-panel.tsx"
git commit -m "feat(curriculum): admin topics panel (add/rename/reorder/delete)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire the panel + week topic selector into the curriculum page

**Files:**
- Modify: `src/app/admin/subjects/[id]/curriculum/page.tsx` (load topics + week counts; render `TopicsPanel`; pass `topics` to `WeekEditor`)
- Modify: `src/app/admin/subjects/[id]/curriculum/_components/week-editor.tsx` (add a topic `<select>`)

**Interfaces:**
- Consumes: `TopicsPanel` (Task 4); `subjectTopics` table.
- Produces: `WeekEditor` now accepts `topics: Array<{id,name}>` and renders a topic selector that posts `topicId`.

- [ ] **Step 1: Load topics + week counts in `page.tsx`**

Add `subjectTopics` and `sql` to the existing imports:
```ts
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { subjectWeeks, subjects, terms, subjectTopics } from "@/db/schema";
import { TopicsPanel } from "./_components/topics-panel";
```

After the `weeks` query (around line 68), add:
```ts
  const topics = await db
    .select()
    .from(subjectTopics)
    .where(eq(subjectTopics.subjectId, subjectId))
    .orderBy(asc(subjectTopics.position));

  const countRows = await db
    .select({ topicId: subjectWeeks.topicId, n: sql<number>`count(*)::int` })
    .from(subjectWeeks)
    .where(eq(subjectWeeks.subjectId, subjectId))
    .groupBy(subjectWeeks.topicId);
  const weekCounts: Record<string, number> = {};
  for (const r of countRows) if (r.topicId) weekCounts[r.topicId] = r.n;
```

- [ ] **Step 2: Render `TopicsPanel` and pass `topics` to `WeekEditor`**

Inside the `<Card>`, above the existing `grid` div, add the panel:
```tsx
      <Card>
        <div className="p-6 pb-0">
          <TopicsPanel subjectId={subjectId} topics={topics} weekCounts={weekCounts} />
        </div>
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 p-6">
```

Then pass `topics` to both `WeekEditor` usages:
```tsx
            {isNew || !selectedWeek ? (
              <WeekEditor subjectId={subjectId} termId={currentTerm.id} topics={topics} />
            ) : (
              <WeekEditor
                existing={selectedWeek}
                subjectId={subjectId}
                termId={currentTerm.id}
                topics={topics}
              />
            )}
```

- [ ] **Step 3: Add the topic selector to `WeekEditor`**

Add `topics` to the prop type:
```ts
export function WeekEditor({
  existing,
  subjectId,
  termId,
  topics,
}: {
  existing?: SubjectWeek;
  subjectId: string;
  termId: string;
  topics: { id: string; name: string }[];
}) {
```

Add this `<label>` block inside the `<form>`, right after the Title field:
```tsx
        <label className="block text-sm">
          <div className="text-[12px] font-bold text-ink-soft mb-1">Topic</div>
          <select
            name="topicId"
            defaultValue={existing?.topicId ?? ""}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-ink"
          >
            <option value="">Unassigned</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck 2>&1 | grep -cE "^src/.*error"`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/subjects/[id]/curriculum/page.tsx" "src/app/admin/subjects/[id]/curriculum/_components/week-editor.tsx"
git commit -m "feat(curriculum): wire topics panel + week topic selector into admin curriculum

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Seed topics in `seed-demo.mjs`

**Files:**
- Modify: `scripts/seed-demo.mjs` (create topics per subject; assign generated weeks to a topic)

**Interfaces:**
- Consumes: `subject_topics` table; existing week-seeding loop (`scripts/seed-demo.mjs:261-284`).

- [ ] **Step 1: Insert topics and assign weeks**

In the per-subject seeding loop (where `subjectTopics`/week titles are generated, ~line 261), before inserting weeks: insert 2–4 topic rows for the subject into `subject_topics` (e.g. for "Year 9 Maths": "Algebra", "Geometry", "Statistics"), capture their ids, and set each week's `topic_id` to one of them (round-robin or grouped by the week's theme). Use the existing DB client/insert style already in the file (service-role/`postgres` connection bypasses RLS).

- [ ] **Step 2: Re-run the seed against the dev database**

> **Destructive-action note:** re-seeding may truncate/replace demo rows. Confirm with the user and only run against the dev/demo project, never production.

Run: `node scripts/seed-demo.mjs`
Expected: completes with no errors; `subject_topics` is populated and seeded weeks have non-null `topic_id`.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo.mjs
git commit -m "chore(seed): seed subject topics and assign weeks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Manual end-to-end verification

No code — execute the spec's test plan against the dev server (user starts it).

- [ ] **Step 1: Typecheck is clean**

Run: `npm run typecheck 2>&1 | grep -cE "^src/.*error"`
Expected: `0`

- [ ] **Step 2: Walk the spec test plan**

Ask the user to start the dev server, then verify on `/admin/subjects/{a subject}/curriculum`:
1. Topics panel renders (empty initially for a fresh subject).
2. Add "Algebra" and "Geometry"; reorder (↑/↓); rename one. Reload — order + names persist.
3. In the week editor, set a week's Topic to "Algebra"; save; reload — selection persists.
4. Delete "Algebra" with weeks under it → confirm dialog shows "N weeks will become unassigned" → after delete, those weeks show "Unassigned" in the selector.
5. Add a duplicate topic name → friendly "A topic with that name already exists." error; no row created.
6. RLS probe (Supabase SQL editor or `apply-sql.mjs`): with a non-admin `authenticated` JWT, `insert into subject_topics` is denied; `select` returns rows.

- [ ] **Step 3: Report results to the user** (do not claim success until steps 2.1–2.6 pass).

---

## Self-Review

- **Spec coverage:** schema (Task 1) ✓; migration + RLS + SECURITY.md (Task 2) ✓; admin authoring UI — topics panel (Task 4), week assignment (Task 3+5) ✓; permissions (Task 2) ✓; validation/error handling (Task 3) ✓; edge cases — unassigned weeks, delete-with-count, reorder at ends, per-subject uniqueness (Tasks 3/4) ✓; seed (Task 6) ✓; manual test plan (Task 7) ✓. Non-goals (tutor section, student view, mastery) correctly excluded.
- **Placeholder scan:** seed assignment (Task 6 Step 1) is described rather than coded because the exact seed-loop variables are local to `seed-demo.mjs`; the implementer adapts to the existing loop. All app code (schema, actions, components, page wiring) is concrete.
- **Type consistency:** action signatures in Task 3 (`renameSubjectTopic(id, subjectId, formData)`, `reorderSubjectTopic(id, subjectId, direction)`, `deleteSubjectTopic(id, subjectId)`) match their call sites in Task 4; `TopicsPanel` props in Task 4 match the render in Task 5; `WeekEditor` gains `topics` consistently in Task 5; `topicId` column (Task 1) ↔ `topicId` schema field (Task 3) ↔ `topicId` select name (Task 5) all align.
