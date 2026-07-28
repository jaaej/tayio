# Quiz Maker v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the creation side of common weekly quizzes - a quiz maker plus an admin-requests-a-tutor + admin-approves workflow - with no student-taking and no ranking.

**Architecture:** Three new tables (`quizzes`, `quiz_questions`, `quiz_options`) anchored to a subject + curriculum week. Pure submit-validation is unit-tested; server-only Drizzle queries and role-guarded server actions carry the workflow; a shared client `QuizMaker` component drives editing for both admin and tutor pages. Notifications reuse the existing `notifications` table.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Drizzle ORM over Postgres, Tailwind v4, vitest (pure-logic tests only), raw-SQL migrations.

## Global Constraints

- Never use the em dash character in source or docs; use a plain dash "-".
- Migration is raw SQL applied via `scripts/apply-sql.mjs` by the controller/owner - NEVER `db:push` (it wipes all RLS). New tables get RLS enabled + policies mirroring `supabase/migrations/0024_resources.sql`.
- Data model: one quiz per subject + curriculum week (`subject_id` + `subject_week_id`), shared across all classes of that subject. NOT ranked, NOT taken by students in v1.
- Question types v1: `multiple_choice` (one correct) and `true_false` only. No short-answer, no multi-select.
- Status enum `quiz_status`: `draft`, `requested`, `pending_review`, `changes_requested`, `approved`. Lifecycle per the spec: tutor path requested -> pending_review -> approved | changes_requested; admin-direct draft -> approved.
- Editable states: a tutor may edit ONLY quizzes where `assigned_tutor_id = them` AND status in (`requested`, `changes_requested`). An admin may edit any non-`approved` quiz. Approved quizzes are locked.
- App-layer role guards are the primary control (Drizzle runs as postgres and bypasses RLS); RLS is defense-in-depth. Every mutating server action must guard: `requireAdmin` (admin actions) or `requireTutor` + assignment/status check (tutor edits).
- Notifications: insert directly into the `notifications` table (`user_id`, `title`, `body`, `href`) - there is no helper.
- Tests are pure-logic only (vitest, co-located `*.test.ts`). No DB/render harness - data-access, actions, and pages are verified by `npm run typecheck` + described manual checks, not automated tests. Do not write fake DB tests.
- The quiz maker UI is built through the `ui-ux-pro-max` ruleset (owner-mandated). Reuse each role's existing UI kit (`@/components/admin/ui`, `@/components/student/*` for tutor pages per repo convention) - no new design system.
- Spec: `docs/superpowers/specs/2026-07-26-quiz-maker-design.md`.

---

## File Structure

- Create: `supabase/migrations/0025_quizzes.sql` - enums, 3 tables, RLS, policies, indexes.
- Modify: `src/db/schema.ts` - enums + 3 `pgTable`s (Drizzle mirror of the migration).
- Create: `src/lib/quiz-validation.ts` (+ `.test.ts`) - pure submit-readiness validation.
- Create: `src/lib/quiz-queries.ts` - `server-only` Drizzle reads (admin list, tutor list, full quiz-with-content).
- Create: `src/app/_actions/quizzes.ts` - all quiz server actions (create-direct, request, edit questions/options, submit, approve, send-back) with role guards.
- Create: `src/components/quiz/quiz-maker.tsx` - shared client editor (questions + options).
- Create: `src/app/admin/quizzes/page.tsx`, `src/app/admin/quizzes/[id]/page.tsx`, `src/app/admin/quizzes/_components/request-quiz-form.tsx`, `src/app/admin/quizzes/_components/new-quiz-form.tsx`, `src/app/admin/quizzes/[id]/_components/review-controls.tsx`.
- Create: `src/app/tutor/quizzes/page.tsx`, `src/app/tutor/quizzes/[id]/page.tsx`.
- Modify: admin shell nav + tutor shell nav to add "Quizzes".
- Modify: `docs/checklist.md`, `docs/security-checklist.md`.

---

## Task 1: Schema + migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `supabase/migrations/0025_quizzes.sql`

**Interfaces produced (Drizzle exports later tasks import from `@/db/schema`):**
- `quizStatusEnum`, `quizQuestionTypeEnum`
- `quizzes` with columns: `id, subjectId, subjectWeekId, title, status, createdBy, assignedTutorId, note, approvedBy, approvedAt, createdAt, updatedAt`
- `quizQuestions` with: `id, quizId, prompt, type, position, createdAt`
- `quizOptions` with: `id, questionId, text, isCorrect, position`

- [ ] **Step 1: Add Drizzle schema**

Append to `src/db/schema.ts` (place near the other enums / tables; import helpers already used in the file - `pgEnum`, `pgTable`, `uuid`, `text`, `integer`, `boolean`, `timestamp`, `index`):

```ts
export const quizStatusEnum = pgEnum("quiz_status", [
  "draft",
  "requested",
  "pending_review",
  "changes_requested",
  "approved",
]);

export const quizQuestionTypeEnum = pgEnum("quiz_question_type", [
  "multiple_choice",
  "true_false",
]);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    subjectWeekId: uuid("subject_week_id")
      .notNull()
      .references(() => subjectWeeks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: quizStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    assignedTutorId: uuid("assigned_tutor_id").references(() => profiles.id),
    note: text("note"),
    approvedBy: uuid("approved_by").references(() => profiles.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quizzes_subject_week_idx").on(t.subjectWeekId),
    index("quizzes_assigned_tutor_idx").on(t.assignedTutorId),
  ],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    type: quizQuestionTypeEnum("type").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quiz_questions_quiz_idx").on(t.quizId)],
);

export const quizOptions = pgTable(
  "quiz_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [index("quiz_options_question_idx").on(t.questionId)],
);
```

- [ ] **Step 2: Write the raw-SQL migration**

Create `supabase/migrations/0025_quizzes.sql`. Follow the structure of `0024_resources.sql` (read it first for the exact RLS/policy idiom and the `is_admin()` helper signature). Content:

```sql
-- 0025_quizzes.sql - quiz maker (creation side). Reversible by: drop the 3
-- tables + 2 enums. RLS mirrors 0024_resources.sql. App-layer guards are the
-- primary control; RLS is defense-in-depth.

create type quiz_status as enum ('draft','requested','pending_review','changes_requested','approved');
create type quiz_question_type as enum ('multiple_choice','true_false');

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  subject_week_id uuid not null references subject_weeks(id) on delete cascade,
  title text not null,
  status quiz_status not null default 'draft',
  created_by uuid not null references profiles(id),
  assigned_tutor_id uuid references profiles(id),
  note text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quizzes_subject_week_idx on quizzes(subject_week_id);
create index quizzes_assigned_tutor_idx on quizzes(assigned_tutor_id);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  prompt text not null,
  type quiz_question_type not null,
  position integer not null,
  created_at timestamptz not null default now()
);
create index quiz_questions_quiz_idx on quiz_questions(quiz_id);

create table quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references quiz_questions(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position integer not null
);
create index quiz_options_question_idx on quiz_options(question_id);

alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_options enable row level security;

-- Admin: full access on all three (is_admin() defined in an earlier migration).
create policy quizzes_admin_all on quizzes for all using (is_admin()) with check (is_admin());
create policy quiz_questions_admin_all on quiz_questions for all using (is_admin()) with check (is_admin());
create policy quiz_options_admin_all on quiz_options for all using (is_admin()) with check (is_admin());

-- Tutor: read/write only quizzes assigned to them.
create policy quizzes_tutor_assigned on quizzes for all
  using (assigned_tutor_id = auth.uid()) with check (assigned_tutor_id = auth.uid());
create policy quiz_questions_tutor_assigned on quiz_questions for all
  using (exists (select 1 from quizzes q where q.id = quiz_id and q.assigned_tutor_id = auth.uid()))
  with check (exists (select 1 from quizzes q where q.id = quiz_id and q.assigned_tutor_id = auth.uid()));
create policy quiz_options_tutor_assigned on quiz_options for all
  using (exists (select 1 from quiz_questions qq join quizzes q on q.id = qq.quiz_id
                 where qq.id = question_id and q.assigned_tutor_id = auth.uid()))
  with check (exists (select 1 from quiz_questions qq join quizzes q on q.id = qq.quiz_id
                 where qq.id = question_id and q.assigned_tutor_id = auth.uid()));
```

Before writing, READ `supabase/migrations/0024_resources.sql` and confirm the `is_admin()` helper exists and is called with no arguments; if the helper name/signature differs, match the real one. Do not invent a helper.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors (schema.ts references `subjects`, `subjectWeeks`, `profiles`, all already defined earlier in the file).

- [ ] **Step 4: Commit** (migration is applied later by the controller, not here)

```bash
git add src/db/schema.ts supabase/migrations/0025_quizzes.sql
git commit -m "feat(quizzes): schema + migration 0025 (tables, enums, RLS)"
```

---

## Task 2: Submit-validation (pure, TDD)

**Files:**
- Create: `src/lib/quiz-validation.ts`
- Test: `src/lib/quiz-validation.test.ts`

**Interfaces produced:**
- `type QuizQuestionInput = { type: "multiple_choice" | "true_false"; prompt: string; options: { text: string; isCorrect: boolean }[] }`
- `validateQuizForSubmit(title: string, questions: QuizQuestionInput[]): string[]` - returns an array of human-readable problems; empty array means ready to submit.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/quiz-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateQuizForSubmit, type QuizQuestionInput } from "./quiz-validation";

const mc = (over: Partial<QuizQuestionInput> = {}): QuizQuestionInput => ({
  type: "multiple_choice",
  prompt: "What is 2+2?",
  options: [
    { text: "3", isCorrect: false },
    { text: "4", isCorrect: true },
  ],
  ...over,
});

describe("validateQuizForSubmit", () => {
  it("passes a well-formed quiz", () => {
    expect(validateQuizForSubmit("Week 5", [mc()])).toEqual([]);
  });
  it("requires a title", () => {
    expect(validateQuizForSubmit("  ", [mc()])).toContain("A title is required.");
  });
  it("requires at least one question", () => {
    expect(validateQuizForSubmit("Week 5", [])).toContain(
      "Add at least one question.",
    );
  });
  it("requires a prompt on every question", () => {
    const out = validateQuizForSubmit("Week 5", [mc({ prompt: "  " })]);
    expect(out.some((m) => m.includes("prompt"))).toBe(true);
  });
  it("requires at least two options on a multiple-choice question", () => {
    const out = validateQuizForSubmit("Week 5", [
      mc({ options: [{ text: "4", isCorrect: true }] }),
    ]);
    expect(out.some((m) => m.includes("two options"))).toBe(true);
  });
  it("requires exactly one correct option", () => {
    const none = validateQuizForSubmit("Week 5", [
      mc({ options: [{ text: "3", isCorrect: false }, { text: "4", isCorrect: false }] }),
    ]);
    expect(none.some((m) => m.includes("one correct"))).toBe(true);
    const two = validateQuizForSubmit("Week 5", [
      mc({ options: [{ text: "3", isCorrect: true }, { text: "4", isCorrect: true }] }),
    ]);
    expect(two.some((m) => m.includes("one correct"))).toBe(true);
  });
  it("requires non-empty option text", () => {
    const out = validateQuizForSubmit("Week 5", [
      mc({ options: [{ text: "  ", isCorrect: true }, { text: "4", isCorrect: false }] }),
    ]);
    expect(out.some((m) => m.includes("empty option"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/quiz-validation.test.ts`
Expected: FAIL - cannot find module `./quiz-validation`.

- [ ] **Step 3: Implement**

Create `src/lib/quiz-validation.ts`:

```ts
export type QuizQuestionInput = {
  type: "multiple_choice" | "true_false";
  prompt: string;
  options: { text: string; isCorrect: boolean }[];
};

/**
 * Returns a list of human-readable problems that block submitting a quiz for
 * review. An empty array means the quiz is ready. Pure - no I/O.
 */
export function validateQuizForSubmit(
  title: string,
  questions: QuizQuestionInput[],
): string[] {
  const problems: string[] = [];
  if (!title.trim()) problems.push("A title is required.");
  if (questions.length === 0) problems.push("Add at least one question.");

  questions.forEach((q, i) => {
    const label = `Question ${i + 1}`;
    if (!q.prompt.trim()) problems.push(`${label}: prompt is required.`);
    if (q.options.length < 2) {
      problems.push(`${label}: needs at least two options.`);
    }
    if (q.options.some((o) => !o.text.trim())) {
      problems.push(`${label}: has an empty option.`);
    }
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (correct !== 1) {
      problems.push(`${label}: must have exactly one correct option.`);
    }
  });

  return problems;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/quiz-validation.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz-validation.ts src/lib/quiz-validation.test.ts
git commit -m "feat(quizzes): pure submit-validation module"
```

---

## Task 3: Data-access queries

**Files:**
- Create: `src/lib/quiz-queries.ts`

**Interfaces produced:**
- `type QuizListRow = { id: string; title: string; status: string; subjectName: string; weekNumber: number; assignedTutorName: string | null; updatedAt: Date }`
- `type QuizWithContent = { quiz: {...full row + subjectName + weekNumber}; questions: Array<{ id, prompt, type, position, options: Array<{ id, text, isCorrect, position }> }> }`
- `listQuizzesForAdmin(filter?: { status?: string }): Promise<QuizListRow[]>`
- `listQuizzesForTutor(tutorId: string): Promise<QuizListRow[]>`
- `getQuizWithContent(quizId: string): Promise<QuizWithContent | null>`

Note: no automated test (no DB harness); verify with `npm run typecheck` and functionally in Tasks 7/8.

- [ ] **Step 1: Implement**

Create `src/lib/quiz-queries.ts`:

```ts
import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  subjects,
  subjectWeeks,
  profiles,
} from "@/db/schema";

export type QuizListRow = {
  id: string;
  title: string;
  status: string;
  subjectName: string;
  weekNumber: number;
  assignedTutorName: string | null;
  updatedAt: Date;
};

export type QuizWithContent = {
  quiz: {
    id: string;
    title: string;
    status: string;
    subjectId: string;
    subjectName: string;
    subjectWeekId: string;
    weekNumber: number;
    assignedTutorId: string | null;
    note: string | null;
    createdBy: string;
  };
  questions: Array<{
    id: string;
    prompt: string;
    type: string;
    position: number;
    options: Array<{ id: string; text: string; isCorrect: boolean; position: number }>;
  }>;
};

function baseListSelect() {
  const tutor = alias(profiles, "assigned_tutor");
  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      status: quizzes.status,
      subjectName: subjects.name,
      weekNumber: subjectWeeks.weekNumber,
      assignedTutorFirst: tutor.firstName,
      assignedTutorLast: tutor.lastName,
      updatedAt: quizzes.updatedAt,
    })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .leftJoin(tutor, eq(tutor.id, quizzes.assignedTutorId));
}

function toListRow(r: {
  id: string; title: string; status: string; subjectName: string;
  weekNumber: number; assignedTutorFirst: string | null;
  assignedTutorLast: string | null; updatedAt: Date;
}): QuizListRow {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    subjectName: r.subjectName,
    weekNumber: r.weekNumber,
    assignedTutorName:
      r.assignedTutorFirst != null
        ? `${r.assignedTutorFirst} ${r.assignedTutorLast ?? ""}`.trim()
        : null,
    updatedAt: r.updatedAt,
  };
}

export async function listQuizzesForAdmin(filter?: {
  status?: string;
}): Promise<QuizListRow[]> {
  const rows = await baseListSelect()
    .where(filter?.status ? eq(quizzes.status, filter.status as never) : undefined)
    .orderBy(desc(quizzes.updatedAt));
  return rows.map(toListRow);
}

export async function listQuizzesForTutor(tutorId: string): Promise<QuizListRow[]> {
  const rows = await baseListSelect()
    .where(eq(quizzes.assignedTutorId, tutorId))
    .orderBy(desc(quizzes.updatedAt));
  return rows.map(toListRow);
}

export async function getQuizWithContent(
  quizId: string,
): Promise<QuizWithContent | null> {
  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      status: quizzes.status,
      subjectId: quizzes.subjectId,
      subjectName: subjects.name,
      subjectWeekId: quizzes.subjectWeekId,
      weekNumber: subjectWeeks.weekNumber,
      assignedTutorId: quizzes.assignedTutorId,
      note: quizzes.note,
      createdBy: quizzes.createdBy,
    })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .where(eq(quizzes.id, quizId))
    .limit(1);
  const quiz = rows[0];
  if (!quiz) return null;

  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));

  const questionIds = qs.map((q) => q.id);
  const opts = questionIds.length
    ? await db
        .select()
        .from(quizOptions)
        .orderBy(asc(quizOptions.position))
    : [];

  return {
    quiz,
    questions: qs.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      position: q.position,
      options: opts
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
    })),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors. If the `eq(quizzes.status, filter.status as never)` cast complains, narrow `filter.status` to the enum union type instead of `never`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/quiz-queries.ts
git commit -m "feat(quizzes): server-only read queries"
```

---

## Task 4: Server actions - admin lifecycle + shared editing

**Files:**
- Create: `src/app/_actions/quizzes.ts`

**Interfaces produced (server actions):**
- `createQuizDirect(input: { subjectWeekId: string; title: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }>`
- `requestQuiz(input: { subjectWeekId: string; title: string; tutorId: string; note?: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }>`
- `addQuestion(input: { quizId: string; type: "multiple_choice" | "true_false" }): Promise<{ ok: true } | { ok: false; error: string }>`
- `updateQuestionPrompt(input: { questionId: string; prompt: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- `deleteQuestion(input: { questionId: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- `addOption(input: { questionId: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- `updateOption(input: { optionId: string; text: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- `deleteOption(input: { optionId: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- `setCorrectOption(input: { questionId: string; optionId: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- `submitQuiz(input: { quizId: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- `approveQuiz(input: { quizId: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- `requestChanges(input: { quizId: string; note: string }): Promise<{ ok: true } | { ok: false; error: string }>`

**Consumes:** `validateQuizForSubmit` (Task 2); `getQuizWithContent` (Task 3); schema tables; `requireAdmin` from `src/app/admin/_lib/guard.ts`; `requireRole` from `@/lib/auth`.

- [ ] **Step 1: Implement the actions file**

Create `src/app/_actions/quizzes.ts`. This is a large but mechanical file - one guarded action per interface above. Key rules baked in:
- Editing actions call a shared `assertCanEdit(quizId)` that loads the quiz, then allows if the caller is an admin (any non-`approved` quiz) OR the assigned tutor while status in (`requested`, `changes_requested`); otherwise returns an error.
- `true_false` questions are created pre-seeded with two options ("True", "False"), True marked correct by default.
- All actions `revalidatePath` the relevant admin + tutor quiz routes.
- Notifications inserted directly into `notifications`.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  notifications,
  type UserRole,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import { validateQuizForSubmit } from "@/lib/quiz-validation";
import { getQuizWithContent } from "@/lib/quiz-queries";

type Result = { ok: true } | { ok: false; error: string };

function revalidate(quizId: string) {
  revalidatePath("/admin/quizzes");
  revalidatePath(`/admin/quizzes/${quizId}`);
  revalidatePath("/tutor/quizzes");
  revalidatePath(`/tutor/quizzes/${quizId}`);
}

async function currentUser() {
  // Any authenticated staff role; specific checks happen per action.
  const user = await requireRole(["admin", "tutor"] as unknown as UserRole);
  return user;
}

/** Load a quiz row and assert the caller may edit it. Returns the row or null. */
async function loadEditable(
  quizId: string,
  userId: string,
  role: "admin" | "tutor",
): Promise<
  | { ok: true; row: typeof quizzes.$inferSelect }
  | { ok: false; error: string }
> {
  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!row) return { ok: false, error: "Quiz not found" };
  if (role === "admin") {
    if (row.status === "approved") return { ok: false, error: "Quiz is approved and locked" };
    return { ok: true, row };
  }
  // tutor
  if (row.assignedTutorId !== userId)
    return { ok: false, error: "This quiz is not assigned to you" };
  if (row.status !== "requested" && row.status !== "changes_requested")
    return { ok: false, error: "This quiz can no longer be edited" };
  return { ok: true, row };
}
```

The rest of the file implements each action using `loadEditable` for edits, `requireRole("admin")` for admin-only actions (`requestQuiz`, `approveQuiz`, `requestChanges`, `createQuizDirect`), and Zod-parsing every input with `.max()` on free text (title/prompt/option text/note - cap 500 for text, 5000 for note). Reference implementations for the non-obvious actions:

```ts
export async function createQuizDirect(input: {
  subjectWeekId: string;
  title: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireRole("admin");
  const data = z
    .object({ subjectWeekId: z.string().uuid(), title: z.string().min(1).max(200) })
    .parse(input);
  const [week] = await db
    .select({ subjectId: subjectWeeksSubjectId() })
    .from(quizzesWeekRef())
    .where(eq(subjectWeekIdCol(), data.subjectWeekId))
    .limit(1);
  // NOTE: implementer - resolve subjectId from subject_weeks table directly:
  //   import { subjectWeeks } from "@/db/schema"; select subjectId from subjectWeeks where id = subjectWeekId.
  return { ok: false, error: "replace with real impl per note" };
}
```

IMPORTANT for the implementer: the pseudo-helpers above (`subjectWeeksSubjectId`, etc.) are placeholders to signal intent - do NOT ship them. Resolve `subjectId` by selecting from the real `subjectWeeks` table: `const [w] = await db.select({ subjectId: subjectWeeks.subjectId }).from(subjectWeeks).where(eq(subjectWeeks.id, data.subjectWeekId)).limit(1);` then insert the quiz with `subjectId: w.subjectId`, `subjectWeekId`, `title`, `status: "draft"`, `createdBy: user.id`. Import `subjectWeeks` from `@/db/schema`. Return `{ ok: true, id }`.

`requestQuiz`: same, but `status: "requested"`, `assignedTutorId: input.tutorId`, `note`. After insert, insert a notification: `db.insert(notifications).values({ userId: input.tutorId, title: "Quiz requested", body: \`Please build the "${title}" quiz\`, href: \`/tutor/quizzes/${id}\` })`. Validate `tutorId` is a uuid and belongs to a tutor (`select role from profiles`; `coarseRole(role) === "tutor"`).

`addQuestion`: `assertCanEdit`; insert a `quizQuestions` row with `position = (max existing position)+1` (use `sql\`coalesce(max(position),0)+1\``or count). If `type === "true_false"`, also insert two `quizOptions` ("True" isCorrect true pos 0, "False" isCorrect false pos 1). Touch `quizzes.updatedAt = now()`.

`setCorrectOption`: `assertCanEdit` (resolve quizId from the question); in one transaction set `is_correct = (id = optionId)` for all options of that question - guarantees exactly one correct.

`submitQuiz`: load the full quiz via `getQuizWithContent`; map to `QuizQuestionInput[]`; run `validateQuizForSubmit`; if problems, return `{ ok: false, error: problems.join(" ") }`. Otherwise (tutor must be assigned + status requested/changes_requested; admin path does not use submit - admin approves directly) set `status = "pending_review"`, notify `createdBy`: "Quiz ready for review", href `/admin/quizzes/${id}`.

`approveQuiz` (admin): set `status = "approved"`, `approved_by = user.id`, `approved_at = now()`. If `assignedTutorId`, notify them "Quiz approved". For an admin-direct `draft`, also run `validateQuizForSubmit` first and reject if incomplete.

`requestChanges` (admin): require the quiz be `pending_review`; set `status = "changes_requested"`, `note = input.note`; notify `assignedTutorId` "Changes requested" with the note, href `/tutor/quizzes/${id}`.

Every edit/lifecycle action ends with `revalidate(quizId)` and returns `{ ok: true }` (or `{ ok: true, id }` for creates).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors. Ensure no placeholder pseudo-helpers remain (grep the file for `subjectWeeksSubjectId`, `quizzesWeekRef`, `replace with real impl` - there must be zero matches).

- [ ] **Step 3: Commit**

```bash
git add src/app/_actions/quizzes.ts
git commit -m "feat(quizzes): server actions (create, request, edit, submit, approve)"
```

---

## Task 5: Quiz maker component (ui-ux-pro-max)

**Files:**
- Create: `src/components/quiz/quiz-maker.tsx`

**Consumes:** the Task 4 actions (`addQuestion`, `updateQuestionPrompt`, `deleteQuestion`, `addOption`, `updateOption`, `deleteOption`, `setCorrectOption`, `submitQuiz`) and `QuizWithContent` (Task 3).
**Produces:** `QuizMaker({ quiz, questions, editable, canSubmit, hrefBack }: { ...QuizWithContent + editable: boolean; canSubmit: boolean; })` - a client component.

- [ ] **Step 1: Load and apply the ui-ux-pro-max ruleset**

Invoke the `ui-ux-pro-max` skill for a "quiz builder form" (form controls, add/remove rows, radio for the correct option, reorder). Apply its rules: `input-labels` (each field labelled), `primary-action` (single "Submit for review"), `state-clarity`/`disabled-states` (read-only when not editable), `destructive-emphasis` (delete question/option uses a danger affordance), `touch-target-size` (>=44px controls), `color-not-only` (the correct answer is marked with a radio + label, not color alone).

- [ ] **Step 2: Build the component**

`QuizMaker` renders, using neutral tokens shared across role themes (border-line, text-ink, bg-surface, bg-brand-*, matching `InboxCompose`):
- The quiz title (editable via `updateQuizMeta` if editable - if that action is not in scope, keep title read-only from the request and skip; the plan's Task 4 title is set at create, so title edit is optional and OUT of scope here).
- A list of questions. Each question card: the prompt (a text input calling `updateQuestionPrompt` on blur), the type shown as a label, and its options.
- For `multiple_choice`: option rows, each with a radio (name per question) that calls `setCorrectOption`, a text input calling `updateOption` on blur, and a delete button (`deleteOption`, hidden when only 2 remain). An "Add option" button (`addOption`).
- For `true_false`: two fixed option rows (True/False) with the radio to pick the correct one via `setCorrectOption`; no add/delete, no text edit.
- A footer with "Add multiple-choice question" and "Add true/false question" buttons (`addQuestion`), and a primary "Submit for review" button (`submitQuiz`) that is disabled unless `canSubmit`; on an action error, show the returned message inline.
- When `editable` is false, render everything read-only (no inputs, no buttons except back).
- Use `useTransition` for each action; surface `{ ok:false, error }` via a local error string.

Because this is sizable interactive UI, the implementer writes the full component following the structure above and the ui-ux-pro-max rules; it must typecheck and wire to the exact Task 4 action signatures. Do NOT leave any TODO or stub - every button calls its real action.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/quiz/quiz-maker.tsx
git commit -m "feat(quizzes): shared quiz maker component"
```

---

## Task 6: Admin quizzes pages + nav

**Files:**
- Create: `src/app/admin/quizzes/page.tsx`, `src/app/admin/quizzes/[id]/page.tsx`
- Create: `src/app/admin/quizzes/_components/request-quiz-form.tsx`, `src/app/admin/quizzes/_components/new-quiz-form.tsx`, `src/app/admin/quizzes/[id]/_components/review-controls.tsx`
- Modify: the admin shell nav component (find it: the file rendering admin nav links, e.g. `src/components/admin/shell.tsx` or nav-links) - add a "Quizzes" entry under an appropriate section.

**Consumes:** `listQuizzesForAdmin`, `getQuizWithContent` (Task 3); `createQuizDirect`, `requestQuiz`, `approveQuiz`, `requestChanges` (Task 4); `QuizMaker` (Task 5); `requireRole("admin")`; the admin UI kit (`Card`, `PageHeader`, `Pill`, `Empty`, `Button`, `Select` - confirm exact exports before use).

- [ ] **Step 1: Build the list page**

`/admin/quizzes` (server component, `requireRole("admin")`): fetch `listQuizzesForAdmin()`; render a `PageHeader` with two actions - a `<NewQuizForm>` trigger and a `<RequestQuizForm>` trigger (both client components that open inline forms or a simple disclosure). Render a table/list of quizzes: title, subject + week, status `Pill` (color per status), assigned tutor, updated date, each linking to `/admin/quizzes/[id]`. Empty state via `Empty`.

- [ ] **Step 2: Build the forms**

`request-quiz-form.tsx` (client): selects for tutor (list passed in as a prop from the page - fetch active tutors on the page via a small query or reuse `listDmDirectoryForAdmin`'s tutors), subject-week (a select of subject + week - fetch weeks on the page), a title input, an optional note textarea; on submit calls `requestQuiz`; on `{ok:true}` `router.push('/admin/quizzes/'+id)`. `new-quiz-form.tsx`: subject-week select + title, calls `createQuizDirect`, routes to the new quiz.

The page must supply the option data: fetch active tutors (`profiles` where role in tutor) and the subject-weeks list (`subjectWeeks` joined to `subjects`, labelled "<Subject> - Week N") server-side and pass as props. Add a tiny query in `src/lib/quiz-queries.ts` if needed: `listQuizTargets(): Promise<{ tutors: {id,name}[]; weeks: {id,label}[] }>` - the implementer adds it to Task 3's file and re-commits, or inlines the selects on the page.

- [ ] **Step 3: Build the detail page + review controls**

`/admin/quizzes/[id]`: fetch `getQuizWithContent(id)`; 404 if null. Render `<QuizMaker quiz questions editable={status!=="approved"} canSubmit={false} hrefBack="/admin/quizzes" />` (admins do not "submit for review"; they approve). When `status === "pending_review"`, render `<ReviewControls quizId note>` - an Approve button (`approveQuiz`) and a "Send back" button that reveals a note textarea and calls `requestChanges`. When `draft` (admin-direct), show an "Approve" button that calls `approveQuiz` (the action validates completeness). Show the current status as a `Pill` and any `note`.

- [ ] **Step 4: Add admin nav + typecheck**

Add a "Quizzes" nav link in the admin shell. Run `npm run typecheck` -> zero errors. Reconcile any UI-kit export mismatch against the real files.

- [ ] **Step 5: Manual verification (no page test harness)**

Dev server (owner runs it), as admin: create a direct quiz, add a multiple-choice + a true/false question, mark correct answers, approve. Then Request a quiz to a tutor and confirm the row appears as `requested`.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/quizzes src/components/admin
git commit -m "feat(quizzes): admin quizzes pages + request/approve"
```

---

## Task 7: Tutor quizzes pages + nav

**Files:**
- Create: `src/app/tutor/quizzes/page.tsx`, `src/app/tutor/quizzes/[id]/page.tsx`
- Modify: the tutor shell nav - add "Quizzes".

**Consumes:** `listQuizzesForTutor`, `getQuizWithContent` (Task 3); `submitQuiz` via `QuizMaker` (Task 5); `requireRole("tutor")`; the tutor page kit (`@/components/student/page-head`, `@/components/student/card` per repo convention for tutor pages).

- [ ] **Step 1: Build the list page**

`/tutor/quizzes` (server, `requireRole("tutor")`): fetch `listQuizzesForTutor(user.id)`; group into "To do" (`requested`, `changes_requested`), "Submitted" (`pending_review`), "Done" (`approved`); each card links to `/tutor/quizzes/[id]` and shows subject + week + status Pill. Empty state.

- [ ] **Step 2: Build the detail page**

`/tutor/quizzes/[id]` (server): fetch `getQuizWithContent(id)`; 404 if null OR if `quiz.assignedTutorId !== user.id` (tutors only see their own). Compute `editable = status in (requested, changes_requested)`. Render `<QuizMaker quiz questions editable canSubmit={editable} hrefBack="/tutor/quizzes" />`. Show the admin `note` (instructions / change request) prominently when present.

- [ ] **Step 3: Add tutor nav + typecheck**

Add "Quizzes" to the tutor shell nav. `npm run typecheck` -> zero.

- [ ] **Step 4: Manual verification**

Dev server, as the requested tutor: open the notification, build the requested quiz, submit; confirm status -> `pending_review`; as admin send it back with a note; as tutor see the note + `changes_requested`, edit, resubmit; as admin approve; confirm tutor sees `approved` (read-only).

- [ ] **Step 5: Commit**

```bash
git add src/app/tutor/quizzes src/components
git commit -m "feat(quizzes): tutor quizzes pages"
```

---

## Task 8: Docs + final sweep

**Files:**
- Modify: `docs/checklist.md`, `docs/security-checklist.md`

- [ ] **Step 1: Checklist**

In `docs/checklist.md`, update the Student/Admin quizzes-related rows (quizzes were listed as an unbuilt Phase 4 gap). Add a row noting: quiz maker + admin-request/approve flow shipped on `feat/quiz-maker` (creation side only; no student-taking, no ranking); migration 0025 applied by owner; pending runtime click-through.

- [ ] **Step 2: Security checklist**

In `docs/security-checklist.md`, add a new-table RLS entry (like A12 for resources): quizzes/quiz_questions/quiz_options RLS enabled (migration 0025), admin-full + tutor-assigned policies, students no access; app-layer guards primary.

- [ ] **Step 3: Full sweep**

Run: `npx vitest run` (expect the quiz-validation suite green with the rest).
Run: `npm run typecheck` (zero errors).

- [ ] **Step 4: Commit**

```bash
git add docs/checklist.md docs/security-checklist.md
git commit -m "docs(quizzes): checklist + security-checklist entries"
```

---

## Self-review notes (for the author)

- Spec coverage: 3 tables + enums (T1), status lifecycle (T4 actions), request+notify (T4), maker MC + true/false (T5), admin pages incl request/approve (T6), tutor pages incl submit (T7), RLS (T1), app-layer guards (T4), no student-taking/ranking (excluded everywhere), docs (T8). Covered.
- Placeholder scan: T4 deliberately shows a pseudo-coded `createQuizDirect` ONLY to flag the subjectId-resolution, with an explicit "do NOT ship / replace per note" instruction and a grep gate in the typecheck step. Every other step ships real code.
- Type consistency: action names and the `{ ok } | { ok:false, error }` result shape are consistent across T4/T5/T6/T7; `QuizWithContent` / `QuizListRow` consistent T3->T5->T6->T7.
- Migration application is a controller checkpoint between coding and manual verification (raw SQL via apply-sql, never db:push), matching prior features.
