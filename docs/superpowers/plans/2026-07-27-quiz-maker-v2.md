# Quiz Maker v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add context-set questions, per-question attachments, question reordering, a fuller workspace layout, a bottom-docked admin instruction strip, and subject-grouped Done quizzes to the existing quiz maker.

**Architecture:** Additive Postgres migration (`0027`) introduces a `context` question type, a self-referential `parent_id` on `quiz_questions`, and a nullable `question_id` on `quiz_attachments`. Questions stay a flat list in queries and are nested in the client by `parent_id`. Only leaf multiple-choice / true-false questions are graded; context blocks are containers. App-layer role guards remain the primary access control; existing RLS (keyed on `quiz_id`) already covers the new rows and needs no new policies.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Drizzle ORM over Postgres, Supabase auth + RLS, Tailwind v4, Zod, vitest (pure-logic tests only), lucide-react icons.

## Global Constraints

- Never use the em dash character; use a plain dash `-`.
- Never run `drizzle-kit push` / `db:push` (wipes all RLS). Apply raw SQL via `node scripts/apply-sql.mjs <file>`.
- Never `db:generate`. Migrations are hand-written raw SQL under `supabase/migrations/`.
- Commit messages: no auto-added co-author trailer.
- Long Markdown: one sentence per physical line.
- Students must never receive `quiz_options.is_correct` before submitting; the enrolment-checked server query that strips the key stays intact.
- App-layer guard is primary control; RLS is defence-in-depth. Every mutation keeps its existing role + editable-status gate.
- The vitest harness runs pure logic only. Do not add tests that need a DB connection or React rendering.
- Verify commands: `npm run typecheck`, `npm test`, `npm run build`, `npm run db:check-rls`.
- Work stays on branch `feat/quiz-maker`.

---

## File Structure

- `supabase/migrations/0027_quiz_context_attachments.sql` - CREATE. The additive migration.
- `src/db/schema.ts` - MODIFY. Enum value + two columns + two indexes.
- `src/lib/quiz-validation.ts` - MODIFY. Nested input types + context-aware `validateQuizForSubmit`.
- `src/lib/quiz-validation.test.ts` - MODIFY. Cover context validation.
- `src/lib/quiz-queries.ts` - MODIFY. Return `parentId` on questions, `questionId` on attachments, and count only leaf questions in summaries.
- `src/app/_actions/quizzes.ts` - MODIFY. `addQuestion` gains `context` + `parentId`; new `reorderQuestions`; `uploadQuizAttachments` gains `questionId`; nested validation input; context-safe grading.
- `src/components/quiz/quiz-maker.tsx` - MODIFY. Full-width layout, context blocks, per-question attachments, reorder.
- `src/components/quiz/quiz-instruction-strip.tsx` - CREATE. Bottom-docked collapsible admin note.
- `src/app/admin/quizzes/[id]/page.tsx` - MODIFY. Relax width, move note to bottom strip.
- `src/app/tutor/quizzes/[id]/page.tsx` - MODIFY. Relax width, move note to bottom strip.
- `src/app/tutor/quizzes/page.tsx` - MODIFY. Split Done into per-subject sub-tables.
- `src/components/quiz/student-practice-quiz.tsx` - MODIFY. Render passages + nested sub-questions.
- `src/app/student/quizzes/[id]/page.tsx` / student query already return questions; adjust for nesting via the query change.
- `docs/checklist.md`, `docs/security-checklist.md`, `docs/changes/2026-07-27-quiz-delivery-notifications.md` (or a new change doc) - MODIFY. Records.

---

## Task 1: Migration 0027 + Drizzle schema

**Files:**
- Create: `supabase/migrations/0027_quiz_context_attachments.sql`
- Modify: `src/db/schema.ts:826-906`
- Modify: `docs/security-checklist.md`

**Interfaces:**
- Produces: `quiz_question_type` enum value `'context'`; `quizQuestions.parentId` (`uuid | null`); `quizAttachments.questionId` (`uuid | null`).

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0027_quiz_context_attachments.sql`:

```sql
-- 0027_quiz_context_attachments.sql - context question type, per-question
-- attachments, and nested question support. Additive and non-destructive.
--
-- A context block is a quiz_questions row with type='context' holding a passage
-- in prompt and no options. Its sub-questions are multiple_choice/true_false
-- rows whose parent_id points at the context block. Every row still carries
-- quiz_id, so the RLS policies from 0025/0026 (all keyed on quiz_id) already
-- cover nested rows; no new policies are required.
--
-- Postgres note: a new enum value cannot be used in the same transaction that
-- adds it. This migration only alters schema and never inserts a row using
-- 'context', so wrapping in begin/commit is safe.
--
-- Reversible by:
--   ALTER TABLE public.quiz_attachments DROP COLUMN question_id;
--   ALTER TABLE public.quiz_questions DROP COLUMN parent_id;
--   (the enum value cannot be dropped; harmless).

begin;

alter type quiz_question_type add value if not exists 'context';

alter table public.quiz_questions
  add column if not exists parent_id uuid
  references public.quiz_questions(id) on delete cascade;

create index if not exists quiz_questions_parent_idx
  on public.quiz_questions(parent_id);

alter table public.quiz_attachments
  add column if not exists question_id uuid
  references public.quiz_questions(id) on delete cascade;

create index if not exists quiz_attachments_question_idx
  on public.quiz_attachments(question_id);

commit;
```

- [ ] **Step 2: Apply the migration**

Run: `node scripts/apply-sql.mjs supabase/migrations/0027_quiz_context_attachments.sql`
Expected: applies without error. Re-running is safe (all statements are `if not exists`).

- [ ] **Step 3: Verify RLS is intact**

Run: `npm run db:check-rls`
Expected: PASS for all public tables (37+), no table reported as unprotected.

- [ ] **Step 4: Update Drizzle schema**

In `src/db/schema.ts`, add the enum value (line 826-829):

```ts
export const quizQuestionTypeEnum = pgEnum("quiz_question_type", [
  "multiple_choice",
  "true_false",
  "context",
]);
```

In `quizQuestions` (after `position`, before `createdAt`), add the self-reference and index. Because the column references the same table, use an `AnyPgColumn` return type on the callback:

```ts
    position: integer("position").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => quizQuestions.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quiz_questions_quiz_idx").on(t.quizId),
    index("quiz_questions_parent_idx").on(t.parentId),
  ],
);
```

In `quizAttachments` (after `quizId`), add the nullable question link and index:

```ts
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => quizQuestions.id, {
      onDelete: "cascade",
    }),
```

and add to the table's index list:

```ts
  (t) => [
    index("quiz_attachments_quiz_idx").on(t.quizId),
    index("quiz_attachments_question_idx").on(t.questionId),
  ],
```

Add `AnyPgColumn` to the existing `drizzle-orm/pg-core` import at the top of the file (find the line importing `pgTable`, add `type AnyPgColumn`).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Update security checklist**

In `docs/security-checklist.md`, find the quiz attachment / quiz tables entry and append a line noting migration 0027 added `quiz_questions.parent_id` and `quiz_attachments.question_id`, both covered by the existing `quiz_id`-keyed policies (no new policies, no widened access), verified by `db:check-rls` on 2026-07-27.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0027_quiz_context_attachments.sql src/db/schema.ts docs/security-checklist.md
git commit -m "feat(quizzes): migration 0027 - context type, parent_id, per-question attachments"
```

---

## Task 2: Context-aware validation (TDD)

**Files:**
- Modify: `src/lib/quiz-validation.ts`
- Test: `src/lib/quiz-validation.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `type QuizLeafInput = { type: "multiple_choice" | "true_false"; prompt: string; options: { text: string; isCorrect: boolean }[] }`
  - `type QuizContextInput = { type: "context"; prompt: string; children: QuizLeafInput[] }`
  - `type QuizItemInput = QuizLeafInput | QuizContextInput`
  - `validateQuizForSubmit(title: string, items: QuizItemInput[]): string[]`
  - `gradeQuizAnswers` unchanged in signature (leaf-level answer keys).

- [ ] **Step 1: Write the failing tests**

Replace the existing `validateQuizForSubmit` tests in `src/lib/quiz-validation.test.ts` and add context cases. Add these tests (keep existing `gradeQuizAnswers` tests untouched):

```ts
import { describe, it, expect } from "vitest";
import {
  validateQuizForSubmit,
  type QuizItemInput,
} from "./quiz-validation";

const goodLeaf = (): QuizItemInput => ({
  type: "multiple_choice",
  prompt: "What is 2 + 2?",
  options: [
    { text: "4", isCorrect: true },
    { text: "5", isCorrect: false },
  ],
});

describe("validateQuizForSubmit - context sets", () => {
  it("accepts a valid context set with a passage and one good sub-question", () => {
    const items: QuizItemInput[] = [
      { type: "context", prompt: "Read this passage.", children: [goodLeaf()] },
    ];
    expect(validateQuizForSubmit("Title", items)).toEqual([]);
  });

  it("rejects a context set with an empty passage", () => {
    const items: QuizItemInput[] = [
      { type: "context", prompt: "   ", children: [goodLeaf()] },
    ];
    expect(validateQuizForSubmit("Title", items)).toContain(
      "Context set 1: passage text is required.",
    );
  });

  it("rejects a context set with no sub-questions", () => {
    const items: QuizItemInput[] = [
      { type: "context", prompt: "Passage.", children: [] },
    ];
    expect(validateQuizForSubmit("Title", items)).toContain(
      "Context set 1: needs at least one sub-question.",
    );
  });

  it("reports a bad sub-question with a nested label", () => {
    const items: QuizItemInput[] = [
      {
        type: "context",
        prompt: "Passage.",
        children: [
          {
            type: "multiple_choice",
            prompt: "",
            options: [
              { text: "a", isCorrect: true },
              { text: "b", isCorrect: false },
            ],
          },
        ],
      },
    ];
    expect(validateQuizForSubmit("Title", items)).toContain(
      "Context set 1, sub-question 1: prompt is required.",
    );
  });

  it("requires at least one gradable question overall", () => {
    const items: QuizItemInput[] = [];
    expect(validateQuizForSubmit("Title", items)).toContain(
      "Add at least one question.",
    );
  });

  it("still validates a top-level leaf question", () => {
    const items: QuizItemInput[] = [
      { type: "multiple_choice", prompt: "Q", options: [{ text: "a", isCorrect: false }] },
    ];
    const problems = validateQuizForSubmit("Title", items);
    expect(problems).toContain("Question 1: needs at least two options.");
    expect(problems).toContain("Question 1: must have exactly one correct option.");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- quiz-validation`
Expected: FAIL - `QuizItemInput` not exported / new labels not produced.

- [ ] **Step 3: Implement nested validation**

Replace the top of `src/lib/quiz-validation.ts` (the `QuizQuestionInput` type and `validateQuizForSubmit`) with:

```ts
export type QuizLeafInput = {
  type: "multiple_choice" | "true_false";
  prompt: string;
  options: { text: string; isCorrect: boolean }[];
};

export type QuizContextInput = {
  type: "context";
  prompt: string;
  children: QuizLeafInput[];
};

export type QuizItemInput = QuizLeafInput | QuizContextInput;

/** Back-compat alias; a leaf question is the old QuizQuestionInput. */
export type QuizQuestionInput = QuizLeafInput;

function checkLeaf(leaf: QuizLeafInput, label: string): string[] {
  const problems: string[] = [];
  if (!leaf.prompt.trim()) problems.push(`${label}: prompt is required.`);
  if (leaf.options.length < 2) problems.push(`${label}: needs at least two options.`);
  if (leaf.options.some((o) => !o.text.trim())) problems.push(`${label}: has an empty option.`);
  if (leaf.options.filter((o) => o.isCorrect).length !== 1) {
    problems.push(`${label}: must have exactly one correct option.`);
  }
  return problems;
}

/**
 * Returns a list of human-readable problems that block submitting a quiz for
 * review. An empty array means the quiz is ready. Pure - no I/O.
 * Context sets are containers: their passage is required and they must hold at
 * least one sub-question. Only leaf questions carry options and are gradable.
 */
export function validateQuizForSubmit(
  title: string,
  items: QuizItemInput[],
): string[] {
  const problems: string[] = [];
  if (!title.trim()) problems.push("A title is required.");

  const gradableCount = items.reduce(
    (sum, item) => sum + (item.type === "context" ? item.children.length : 1),
    0,
  );
  if (gradableCount === 0) problems.push("Add at least one question.");

  items.forEach((item, i) => {
    if (item.type === "context") {
      const label = `Context set ${i + 1}`;
      if (!item.prompt.trim()) problems.push(`${label}: passage text is required.`);
      if (item.children.length === 0) {
        problems.push(`${label}: needs at least one sub-question.`);
      }
      item.children.forEach((child, j) => {
        problems.push(...checkLeaf(child, `${label}, sub-question ${j + 1}`));
      });
    } else {
      problems.push(...checkLeaf(item, `Question ${i + 1}`));
    }
  });

  return problems;
}
```

Leave `gradeQuizAnswers` and its types (`QuizAnswerKey`, `QuizAnswer`, `QuizGrade`) exactly as they are.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- quiz-validation`
Expected: PASS (new context tests + untouched grading tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: FAIL in `src/app/_actions/quizzes.ts` (its `toValidationInput` still returns the old flat shape). This is expected and fixed in Task 4. If any OTHER file fails, fix it here.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quiz-validation.ts src/lib/quiz-validation.test.ts
git commit -m "feat(quizzes): context-aware quiz validation"
```

---

## Task 3: Query layer - expose nesting and per-question attachments

**Files:**
- Modify: `src/lib/quiz-queries.ts`

**Interfaces:**
- Consumes: `quizQuestions.parentId`, `quizAttachments.questionId` (Task 1).
- Produces:
  - `QuizWithContent["questions"][number]` gains `parentId: string | null`.
  - `QuizAttachmentView` gains `questionId: string | null`.
  - `StudentQuiz["questions"][number]` gains `parentId: string | null` and keeps `type`.
  - `listApprovedQuizSummariesForWeeks` counts only gradable (non-context) questions.

- [ ] **Step 1: Add `questionId` to the attachment view type**

In `QuizAttachmentView` (line 43-49) add:

```ts
export type QuizAttachmentView = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  questionId: string | null;
  url: string | null;
};
```

- [ ] **Step 2: Add `parentId` to `QuizWithContent.questions`**

In the `QuizWithContent` type (line 67-73) add `parentId`:

```ts
  questions: Array<{
    id: string;
    prompt: string;
    type: string;
    position: number;
    parentId: string | null;
    options: Array<{ id: string; text: string; isCorrect: boolean; position: number }>;
  }>;
```

- [ ] **Step 3: Thread `parentId` and `questionId` through `getQuizWithContent`**

In `getQuizWithContent`, the questions select is `db.select().from(quizQuestions)` (returns all columns incl. `parentId`), so only the mapping at line 263-271 needs `parentId`:

```ts
    questions: qs.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      position: q.position,
      parentId: q.parentId,
      options: opts
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
    })),
```

In the attachments mapping (line 248-259) add `questionId`:

```ts
  const attachments = await Promise.all(
    attachmentRows.map(async (attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      questionId: attachment.questionId,
      url: await signQuizAttachment(attachment.storageBucket, attachment.storagePath),
    })),
  );
```

- [ ] **Step 4: Order questions by position with parents before children**

Deterministic order so the client can nest reliably. Replace the questions query ordering in `getQuizWithContent` (line 229-233) with an ordering that keeps top-level rows and their children grouped. Simplest robust approach: order by `position` only and let the client group by `parentId` (positions are sibling-scoped). Keep:

```ts
  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));
```

No change needed beyond confirming this line stays; nesting happens in the client (Task 5) using `parentId` + `position`.

- [ ] **Step 5: Update `StudentQuiz` type and query**

In `StudentQuiz` (line 348-368) add `parentId` to each question:

```ts
  questions: Array<{
    id: string;
    prompt: string;
    type: string;
    position: number;
    parentId: string | null;
    options: Array<{ id: string; text: string; position: number }>;
  }>;
```

In `getStudentQuiz`, add `parentId` to the questions select (line 400-409):

```ts
  const questions = await db
    .select({
      id: quizQuestions.id,
      prompt: quizQuestions.prompt,
      type: quizQuestions.type,
      position: quizQuestions.position,
      parentId: quizQuestions.parentId,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));
```

The student attachments mapping (line 429-440) also needs `questionId`:

```ts
  const attachments = await Promise.all(
    attachmentRows.map(async (attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      questionId: attachment.questionId,
      url: await signQuizAttachment(attachment.storageBucket, attachment.storagePath),
    })),
  );
```

- [ ] **Step 6: Count only gradable questions in approved summaries**

In `listApprovedQuizSummariesForWeeks` (line 283-303), exclude context containers from the count so the "N questions" badge on the student/tutor curriculum card is accurate. Change the join to filter type, and import is already present (`and`, `eq`). Replace the `leftJoin` with a filtered one:

```ts
    .leftJoin(
      quizQuestions,
      and(
        eq(quizQuestions.quizId, quizzes.id),
        sql`${quizQuestions.type} <> 'context'`,
      ),
    )
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: still FAILS only in `src/app/_actions/quizzes.ts` (fixed in Task 4). No new failures in query consumers, because added fields are additive. If `student-practice-quiz.tsx` or `week-content.tsx` fail on the new `questionId`/`parentId`, that is fine to defer to Tasks 5/8 - note it and continue.

- [ ] **Step 8: Commit**

```bash
git add src/lib/quiz-queries.ts
git commit -m "feat(quizzes): expose parent_id nesting and per-question attachment scope in queries"
```

---

## Task 4: Server actions - context questions, reorder, scoped attachments, safe grading

**Files:**
- Modify: `src/app/_actions/quizzes.ts`

**Interfaces:**
- Consumes: schema (Task 1), `QuizItemInput`/`validateQuizForSubmit` (Task 2), `getQuizWithContent` shape (Task 3).
- Produces:
  - `addQuestion({ quizId, type, parentId? })` where `type` is `"multiple_choice" | "true_false" | "context"`.
  - `reorderQuestions({ quizId, parentId, orderedIds })` -> `Result`.
  - `uploadQuizAttachments(formData)` reads an optional `questionId`.
  - `gradePracticeQuiz` excludes context containers when building answer keys.

- [ ] **Step 1: Extend `addQuestion` for context + sub-questions**

Replace `addQuestion` (line 292-331). A `context` block gets no options. A sub-question (`parentId` present) must attach to a context block in the same quiz, and its position is scoped to its parent:

```ts
export async function addQuestion(input: {
  quizId: string;
  type: "multiple_choice" | "true_false" | "context";
  parentId?: string;
}): Promise<Result> {
  const parsed = z
    .object({
      quizId: z.string().uuid(),
      type: z.enum(["multiple_choice", "true_false", "context"]),
      parentId: z.string().uuid().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { quizId, type, parentId } = parsed.data;

  if (type === "context" && parentId) {
    return { ok: false, error: "A context set cannot be nested inside another." };
  }

  const editor = await currentEditor();
  const editable = await loadEditable(quizId, editor.id, editor.role);
  if (!editable.ok) return editable;

  if (parentId) {
    const [parent] = await db
      .select({ id: quizQuestions.id, type: quizQuestions.type, quizId: quizQuestions.quizId })
      .from(quizQuestions)
      .where(eq(quizQuestions.id, parentId))
      .limit(1);
    if (!parent || parent.quizId !== quizId || parent.type !== "context") {
      return { ok: false, error: "Sub-questions must attach to a context set." };
    }
  }

  const positionScope = parentId
    ? eq(quizQuestions.parentId, parentId)
    : and(eq(quizQuestions.quizId, quizId), isNull(quizQuestions.parentId));

  const [{ nextPosition }] = await db
    .select({
      nextPosition: sql<number>`coalesce(max(${quizQuestions.position}), -1) + 1`.mapWith(Number),
    })
    .from(quizQuestions)
    .where(positionScope);

  const [question] = await db
    .insert(quizQuestions)
    .values({ quizId, prompt: "", type, position: nextPosition, parentId: parentId ?? null })
    .returning({ id: quizQuestions.id });

  if (type === "true_false") {
    await db.insert(quizOptions).values([
      { questionId: question.id, text: "True", isCorrect: true, position: 0 },
      { questionId: question.id, text: "False", isCorrect: false, position: 1 },
    ]);
  }

  await touchQuiz(quizId);
  revalidate(quizId);
  return { ok: true };
}
```

Add `isNull` to the `drizzle-orm` import at the top (line 5): `import { and, eq, inArray, isNull, sql } from "drizzle-orm";`.

- [ ] **Step 2: Add `reorderQuestions`**

Add after `deleteQuestion` (after line 368). It rewrites `position` for exactly one sibling group and rejects ids that do not all belong to the quiz + parent scope:

```ts
export async function reorderQuestions(input: {
  quizId: string;
  parentId: string | null;
  orderedIds: string[];
}): Promise<Result> {
  const parsed = z
    .object({
      quizId: z.string().uuid(),
      parentId: z.string().uuid().nullable(),
      orderedIds: z.array(z.string().uuid()).min(1).max(200),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { quizId, parentId, orderedIds } = parsed.data;

  const editable = await assertCanEdit(quizId);
  if (!editable.ok) return editable;

  const scope = parentId
    ? and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.parentId, parentId))
    : and(eq(quizQuestions.quizId, quizId), isNull(quizQuestions.parentId));
  const siblings = await db
    .select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(scope);
  const siblingIds = new Set(siblings.map((s) => s.id));

  if (
    orderedIds.length !== siblingIds.size ||
    orderedIds.some((id) => !siblingIds.has(id)) ||
    new Set(orderedIds).size !== orderedIds.length
  ) {
    return { ok: false, error: "The reordered list does not match this quiz." };
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(quizQuestions)
        .set({ position: i })
        .where(eq(quizQuestions.id, orderedIds[i]));
    }
  });

  await touchQuiz(quizId);
  revalidate(quizId);
  return { ok: true };
}
```

- [ ] **Step 3: Scope uploads to a question**

In `uploadQuizAttachments` (line 478-560), read an optional `questionId`, validate it belongs to the quiz, and store it on the rows. Replace the parse block (line 479-483) with:

```ts
  const parsed = z
    .object({
      quizId: z.string().uuid(),
      questionId: z.string().uuid().optional(),
    })
    .safeParse({
      quizId: formData.get("quizId"),
      questionId: formData.get("questionId") ?? undefined,
    });
  if (!parsed.success) return { ok: false, error: "Invalid quiz." };
  const { quizId, questionId } = parsed.data;
```

After the `loadEditable` check (after line 487) add a question-ownership check:

```ts
  if (questionId) {
    const [owner] = await db
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId)))
      .limit(1);
    if (!owner) return { ok: false, error: "Question not found on this quiz." };
  }
```

In the insert (line 538-544) add `questionId`:

```ts
    await db.insert(quizAttachments).values(
      staged.map((item) => ({
        quizId,
        questionId: questionId ?? null,
        uploadedBy: editor.id,
        ...item,
      })),
    );
```

- [ ] **Step 4: Nest the validation input**

Replace `toValidationInput` (line 598-606) so it builds the nested `QuizItemInput[]` from the flat question list, grouping children by `parentId`:

```ts
function toValidationInput(
  content: NonNullable<Awaited<ReturnType<typeof getQuizWithContent>>>,
): QuizItemInput[] {
  const top = content.questions.filter((q) => q.parentId === null);
  return top.map((q) => {
    if (q.type === "context") {
      const children = content.questions
        .filter((c) => c.parentId === q.id)
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
          type: c.type as "multiple_choice" | "true_false",
          prompt: c.prompt,
          options: c.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        }));
      return { type: "context" as const, prompt: q.prompt, children };
    }
    return {
      type: q.type as "multiple_choice" | "true_false",
      prompt: q.prompt,
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
    };
  });
}
```

Update the import (line 20-24) to pull `QuizItemInput` instead of `QuizQuestionInput`:

```ts
import {
  gradeQuizAnswers,
  validateQuizForSubmit,
  type QuizItemInput,
} from "@/lib/quiz-validation";
```

- [ ] **Step 5: Exclude context containers from grading**

In `gradePracticeQuiz` (line 759-765), the questions query must skip context rows (they have no options and would otherwise force a "missing correct answer" error). Replace with:

```ts
  const questions = await db
    .select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(
      and(
        eq(quizQuestions.quizId, parsed.data.quizId),
        sql`${quizQuestions.type} <> 'context'`,
      ),
    );
  if (questions.length === 0) {
    return { ok: false, error: "This quiz has no questions." };
  }
```

- [ ] **Step 6: Guard option actions against context rows**

`addOption` and `setCorrectOption` must refuse context questions (defence-in-depth; the UI will not offer options on them). In `addOption`, after fetching the question type (line 380-387), the existing true/false guard is present; add a context guard alongside it:

```ts
  if (question?.type === "true_false") {
    return { ok: false, error: "True/false questions can't have extra options." };
  }
  if (question?.type === "context") {
    return { ok: false, error: "Context sets don't have options." };
  }
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS (Task 2's expected failure is now resolved). If `quiz-maker.tsx` or student components fail on new fields, note them for Tasks 5/8; the actions file itself must be clean.

- [ ] **Step 8: Run tests + build**

Run: `npm test` then `npm run build`
Expected: tests PASS; build PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/_actions/quizzes.ts
git commit -m "feat(quizzes): context questions, reorder action, scoped attachments, context-safe grading"
```

---

## Task 5: Quiz maker UI - full-width layout, context sets, per-question attachments, reorder

**Files:**
- Modify: `src/components/quiz/quiz-maker.tsx`

**Interfaces:**
- Consumes: `addQuestion` (context + parentId), `reorderQuestions`, `uploadQuizAttachments` (questionId), `QuizWithContent` (parentId, attachment questionId) from Tasks 3-4.
- Produces: the redesigned maker; no exports consumed by other tasks.

This is the largest task. Follow the existing component's Tayio conventions (radii `14/20/22`, `text-ink`/`text-muted`/`bg-surface`/`border-line`, `brand-*` accents, 44px min targets, `motion-reduce` guards). Reuse the existing `useActionRunner`, `Metric`, `OptionRow`, `AddOptionButton` helpers.

- [ ] **Step 1: Fix the workspace width breakpoints**

In the two grid wrappers, change `xl:` to `lg:` so the two-column workspace appears at 1024px, and let the canvas grow. Header grid (line 135):

```tsx
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
```

Workspace grid (line 167) - widen the canvas and narrow the rail slightly:

```tsx
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
```

The `1400px` cap lives on the pages (Task 6), not here.

- [ ] **Step 2: Build the nested item tree**

At the top of `QuizMaker`, derive the top-level items and a child lookup from the flat `questions` prop (positions are sibling-scoped, so sort within each group):

```tsx
  const topLevel = questions
    .filter((q) => q.parentId === null)
    .sort((a, b) => a.position - b.position);
  const childrenByParent = new Map<string, typeof questions>();
  for (const q of questions) {
    if (q.parentId) {
      const list = childrenByParent.get(q.parentId) ?? [];
      list.push(q);
      childrenByParent.set(q.parentId, list);
    }
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.position - b.position);
  }
  const attachmentsByQuestion = new Map<string, QuizAttachmentView[]>();
  for (const a of attachments) {
    if (a.questionId) {
      const list = attachmentsByQuestion.get(a.questionId) ?? [];
      list.push(a);
      attachmentsByQuestion.set(a.questionId, list);
    }
  }
  const generalAttachments = attachments.filter((a) => a.questionId === null);
```

Replace the readiness counts (line 97-107) to count only gradable leaves:

```tsx
  const gradable = questions.filter((q) => q.type !== "context");
  const optionCount = gradable.reduce((total, q) => total + q.options.length, 0);
  const completeQuestions = gradable.filter(
    (q) =>
      q.prompt.trim().length > 0 &&
      q.options.length >= 2 &&
      q.options.every((o) => o.text.trim().length > 0) &&
      q.options.filter((o) => o.isCorrect).length === 1,
  ).length;
```

Replace `questions.length` with `gradable.length` in the three Metric/readiness usages (lines 157-162, 236-244).

- [ ] **Step 3: Add the context option to BuilderTools**

In `BuilderTools` (line 350-418), add a third button after the true/false button, matching the existing button markup (icon tile + label + sublabel), calling `addQuestion` with `type: "context"`:

```tsx
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => addQuestion({ quizId, type: "context" }))}
          className="flex min-h-12 items-center gap-3 rounded-[14px] border border-line bg-background px-3 text-left transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-100 text-brand-700">
            <FileText className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[12px] font-extrabold text-ink">Context set</span>
            <span className="block text-[10px] font-semibold text-muted">Passage with sub-questions</span>
          </span>
        </button>
```

- [ ] **Step 4: Remove the sidebar AttachmentManager; keep a read-only general list**

Attachments move into cards. In the `<aside>` (line 210-270), remove the `<AttachmentManager .../>` usage. If `generalAttachments.length > 0`, render a small read-only "Quiz files (legacy)" list using `AttachmentRow` with `editable={false}` so pre-existing quiz-level files stay visible but no new quiz-level upload UI exists. Keep `BuilderTools` and the readiness panel.

- [ ] **Step 5: Make `AttachmentManager` question-scoped and embeddable**

Generalize `AttachmentManager` (line 420-528) to take an optional `questionId` and a compact variant. Add `questionId` to its props and set it on the form data:

```tsx
function AttachmentManager({
  quizId,
  questionId,
  attachments,
  editable,
  totalCount,
}: {
  quizId: string;
  questionId: string;
  attachments: QuizAttachmentView[];
  editable: boolean;
  totalCount: number;
}) {
```

In `upload`, set both fields: `formData.set("quizId", quizId); formData.set("questionId", questionId);`. Replace the per-quiz cap check to use `totalCount` (the whole-quiz count passed in) so the 6-file quiz cap still holds across questions: guard `if (totalCount >= MAX_ATTACHMENTS)` before showing the upload form, and keep the batch cap. Render the header count as `{attachments.length}` for this question but disable uploads when `totalCount >= MAX_ATTACHMENTS` with the message "Quiz attachment limit reached."

- [ ] **Step 6: Reorder controls (drag + arrows)**

Add a small client reorder helper inside the file. Use native HTML5 drag for pointer users and up/down buttons for keyboard/a11y. Both call `reorderQuestions`. Add this helper component used by both top-level and sub-question lists:

```tsx
function useReorder(quizId: string, parentId: string | null, ids: string[]) {
  const { pending, run } = useActionRunner();
  function move(index: number, delta: number) {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderQuestions({ quizId, parentId, orderedIds: next }));
  }
  function dropAt(fromId: string, toIndex: number) {
    const from = ids.indexOf(fromId);
    if (from === -1 || from === toIndex) return;
    const next = ids.filter((id) => id !== fromId);
    next.splice(toIndex, 0, fromId);
    run(() => reorderQuestions({ quizId, parentId, orderedIds: next }));
  }
  return { pending, move, dropAt };
}
```

Render, on each card header, when `editable` and there is more than one sibling: a drag handle (`GripVertical` icon, `draggable` container with `onDragStart`/`onDragOver`/`onDrop` wiring to `dropAt`) plus two 44px arrow buttons (`ChevronUp`/`ChevronDown`, `aria-label="Move up"/"Move down"`, disabled at the ends) calling `move`. Import `GripVertical, ChevronUp, ChevronDown` from `lucide-react`. Guard drag visuals with `motion-reduce`.

- [ ] **Step 7: Render context blocks and sub-questions**

Replace the questions render (line 183-207) to iterate `topLevel`. For a `context` item render a `ContextCard`; otherwise render the existing `QuestionCard`. Pass reorder handlers for the top-level list (ids = `topLevel.map(q => q.id)`).

Add `ContextCard`: a container styled like `QuestionCard` but visually a "set" (e.g. accent left border, `bg-brand-50/40` header). It renders:
- the passage textarea (reuse the `QuestionCard` prompt textarea pattern, label "Passage / context"),
- its own `AttachmentManager` (questionId = context id),
- the reorder controls for the block itself,
- a nested list of sub-question `QuestionCard`s (ids = children ids, their own `useReorder` with `parentId = context.id`), each with sub-index labels "1a, 1b" or "Sub-question N",
- an "Add sub-question" control offering multiple choice / true-false via `addQuestion({ quizId, type, parentId: context.id })`.

`QuestionCard` gains two new props: `attachments: QuizAttachmentView[]`, `totalAttachmentCount: number`, and reorder props `{ onMoveUp, onMoveDown, canMoveUp, canMoveDown, onDragStart, onDragOver, onDrop, draggable }`. Inside `QuestionCard`, after the options fieldset, render `<AttachmentManager quizId=... questionId={question.id} attachments={attachments} editable={editable} totalCount={totalAttachmentCount} />`. Context blocks never show an options fieldset.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 10: Manual check (owner-run)**

The owner starts the dev server and, as admin, opens a draft quiz and verifies: the workspace fills the width at 125% zoom; a context set can be added with a passage, an attached image, and two sub-questions; top-level questions and sub-questions reorder by both drag and arrows; a file attaches to a single question; the readiness count reflects only gradable leaves. Do not claim success before this runs.

- [ ] **Step 11: Commit**

```bash
git add src/components/quiz/quiz-maker.tsx
git commit -m "feat(quizzes): maker v2 - full-width, context sets, per-question files, reorder"
```

---

## Task 6: Bottom-docked admin instruction strip

**Files:**
- Create: `src/components/quiz/quiz-instruction-strip.tsx`
- Modify: `src/app/admin/quizzes/[id]/page.tsx:24,35-40`
- Modify: `src/app/tutor/quizzes/[id]/page.tsx:27,38-45`

**Interfaces:**
- Produces: `QuizInstructionStrip({ label, note }: { label: string; note: string })` - a client component.

- [ ] **Step 1: Create the strip component**

```tsx
"use client";

import { useState } from "react";
import { ChevronUp, Info } from "lucide-react";

export function QuizInstructionStrip({ label, note }: { label: string; note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto w-full max-w-[760px] overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_20px_48px_-24px_rgba(31,40,90,0.5)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Info className="h-4 w-4" />
          {label}
          <ChevronUp
            className={
              "ml-auto h-4 w-4 transition-transform duration-200 motion-reduce:transition-none " +
              (open ? "" : "rotate-180")
            }
          />
        </button>
        <div
          className={
            "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none " +
            (open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
          }
        >
          <div className="overflow-hidden">
            <p className="whitespace-pre-wrap px-4 pb-4 text-[13px] leading-relaxed text-ink-soft">
              {note}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the tutor page**

In `src/app/tutor/quizzes/[id]/page.tsx`: remove the top note block (lines 38-45), relax the wrapper width at line 27 to `className="space-y-5"` (drop `max-w-[1400px]`), and render the strip at the end of the returned tree (after `<QuizMaker .../>`):

```tsx
      {quiz.note && (
        <QuizInstructionStrip
          label={quiz.status === "changes_requested" ? "Changes requested" : "Instructions from admin"}
          note={quiz.note}
        />
      )}
```

Add the import: `import { QuizInstructionStrip } from "@/components/quiz/quiz-instruction-strip";`.

- [ ] **Step 3: Wire it into the admin page**

In `src/app/admin/quizzes/[id]/page.tsx`: remove the top note block (lines 35-40), relax line 24 to `className="space-y-5"`, add the same import, and render at the end:

```tsx
      {quiz.note && <QuizInstructionStrip label="Note" note={quiz.note} />}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Manual check (owner-run)**

Owner confirms the strip sits collapsed at the bottom on both tutor and admin quiz detail pages, expands smoothly on click, does not cover the primary action, and only appears when a note exists.

- [ ] **Step 6: Commit**

```bash
git add src/components/quiz/quiz-instruction-strip.tsx src/app/admin/quizzes/[id]/page.tsx src/app/tutor/quizzes/[id]/page.tsx
git commit -m "feat(quizzes): dock admin instructions in a collapsible bottom strip"
```

---

## Task 7: Tutor list - subject sub-tables inside Done

**Files:**
- Modify: `src/app/tutor/quizzes/page.tsx`

**Interfaces:**
- Consumes: `listQuizzesForTutor` -> `QuizListRow[]` (has `subjectName`).

- [ ] **Step 1: Group the Done rows by subject**

Keep the To do / Submitted groups exactly as they render now. For the Done group only, group its rows by `subjectName` (sorted alphabetically) and render one `CardHead` sub-heading + list per subject inside a single Done `Card`, or one `Card` per subject. Use one `Card` per subject with `CardHead title={`Done - ${subjectName} (${rows.length})`}`. Replace the `groups.map(...)` render so that for `g.key === "done"` it maps a `Map<string, QuizListRow[]>` built from `g.rows`:

```tsx
        groups.map((g) => {
          if (g.rows.length === 0) return null;
          if (g.key !== "done") {
            return (
              <Card key={g.key}>
                <CardHead title={`${g.heading} (${g.rows.length})`} />
                <CardBody tight>
                  <QuizRows rows={g.rows} />
                </CardBody>
              </Card>
            );
          }
          const bySubject = new Map<string, QuizListRow[]>();
          for (const r of g.rows) {
            const list = bySubject.get(r.subjectName) ?? [];
            list.push(r);
            bySubject.set(r.subjectName, list);
          }
          return Array.from(bySubject.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([subjectName, rows]) => (
              <Card key={`done-${subjectName}`}>
                <CardHead title={`Done - ${subjectName} (${rows.length})`} />
                <CardBody tight>
                  <QuizRows rows={rows} />
                </CardBody>
              </Card>
            ));
        })
```

- [ ] **Step 2: Extract the row list into a local `QuizRows` component**

Move the existing `<ul>...<li>...</li></ul>` markup (current lines 60-81) into a small local component so both branches reuse it:

```tsx
function QuizRows({ rows }: { rows: QuizListRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/tutor/quizzes/${r.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ink truncate">{r.title}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted">
                {r.subjectName} - Term {r.termNumber}, Week {r.weekNumber}
              </div>
            </div>
            <Pill tone={toneFor(r.status)} dot>
              {QUIZ_STATUS_LABEL[r.status] ?? r.status}
            </Pill>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual check (owner-run)**

Owner logs in as the tutor, confirms an approved quiz shows under a subject-named Done card, while To do and Submitted stay flat.

- [ ] **Step 5: Commit**

```bash
git add src/app/tutor/quizzes/page.tsx
git commit -m "feat(quizzes): group tutor Done quizzes by subject"
```

---

## Task 8: Student practice - render passages and nested sub-questions

**Files:**
- Modify: `src/components/quiz/student-practice-quiz.tsx`

**Interfaces:**
- Consumes: `StudentQuiz` with `questions[].parentId` and `questions[].type` (Task 3); `gradePracticeQuiz` grades leaves only (Task 4).

- [ ] **Step 1: Read the current component**

Read `src/components/quiz/student-practice-quiz.tsx` in full to learn its current answer-state shape and submit wiring before changing it.

- [ ] **Step 2: Nest for rendering**

Build the same top-level / children grouping used in the maker (filter `parentId === null`, sort by `position`, look up children by `parentId`). Render a context item as a passage block (prompt text, plus its attachments if the component shows attachments) followed by its sub-questions rendered with the existing single-question UI. Render standalone leaves as today.

- [ ] **Step 3: Answer only leaves**

Ensure the answer state and the array sent to `gradePracticeQuiz` include only leaf questions (type `multiple_choice` / `true_false`). Context items contribute no answer. The "answered N of M" progress and the submit-enabled check must count leaves only, matching the server which grades leaves only.

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Manual check (owner-run)**

Owner logs in as `student.pro@taiyo.com` (password `student`), opens an approved quiz that has a context set, confirms the passage renders above its sub-questions, all leaf questions are answerable, the answer key never appears before submitting, and grading returns a correct score.

- [ ] **Step 6: Commit**

```bash
git add src/components/quiz/student-practice-quiz.tsx
git commit -m "feat(quizzes): render context passages in student practice"
```

---

## Task 9: Records - checklist, spec status, change doc

**Files:**
- Modify: `docs/checklist.md`
- Modify: `docs/superpowers/specs/2026-07-27-quiz-maker-v2-design.md`
- Modify or create: `docs/changes/2026-07-27-quiz-maker-v2.md`

- [ ] **Step 1: Update the checklist**

In `docs/checklist.md`, update the quiz rows: mark context sets, per-question attachments, reorder, full-width layout, bottom instruction strip, and subject-grouped tutor Done as built (FE/BE ticks honest to what was verified). Name the routes/files + date `2026-07-27`. Add rows for anything new. Do not tick anything not verified end-to-end.

- [ ] **Step 2: Flip the spec status line**

In the v2 design spec, change the Status line to note implementation complete pending owner browser verification, mirroring the delivery doc's convention.

- [ ] **Step 3: Write the change record**

Create `docs/changes/2026-07-27-quiz-maker-v2.md` summarizing the six changes, the migration, the RLS reasoning (no new policies; nested rows covered by `quiz_id` policies), the verification evidence (typecheck, tests, build, db:check-rls), and the still-pending manual browser checks. One sentence per line. No em dashes.

- [ ] **Step 4: Commit**

```bash
git add docs/checklist.md docs/superpowers/specs/2026-07-27-quiz-maker-v2-design.md docs/changes/2026-07-27-quiz-maker-v2.md
git commit -m "docs(quizzes): checklist, spec status, and v2 change record"
```

---

## Self-Review

**Spec coverage:**
- Fill-the-screen layout -> Task 5 Step 1 + Task 6 width relaxation.
- Admin instruction bottom strip -> Task 6.
- Context question type (enum, parent_id, grading, validation, UI) -> Tasks 1, 2, 4, 5, 8.
- Per-question attachments (question_id, UI, caps) -> Tasks 1, 3, 4, 5.
- Reorder (drag + arrows, single action) -> Task 4 Step 2, Task 5 Step 6.
- Tutor Done grouped by subject -> Task 7.
- Migration 0027 additive + RLS unchanged -> Task 1.
- Records -> Task 9.
All spec sections map to a task.

**Placeholder scan:** No "TBD"/"add error handling"/"similar to". UI steps that don't inline every line (Tasks 5, 8) give concrete code for the novel logic (nesting, reorder, scoped attachments) and precise structural instructions referencing exact existing line ranges; this is deliberate for a large existing-file rewrite, not a placeholder.

**Type consistency:** `QuizItemInput`/`QuizLeafInput`/`QuizContextInput` defined in Task 2, consumed in Task 4. `parentId: string | null` and attachment `questionId: string | null` defined in Task 3, consumed in Tasks 4, 5, 8. `addQuestion({ quizId, type, parentId? })` and `reorderQuestions({ quizId, parentId, orderedIds })` defined in Task 4, consumed in Task 5. `QuizInstructionStrip({ label, note })` defined in Task 6, consumed in both detail pages. Names are consistent across tasks.
