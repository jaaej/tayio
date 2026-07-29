# Term Test + Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scored, term-wide `term_test` quiz kind, taken once and auto-graded on the server, with results embargoed until a release date and then shown as score, rank, and corrections on a per-subject-per-term leaderboard visible to students and parents.

**Architecture:** A term test reuses the `quizzes` table via a `kind` discriminator (`weekly` | `term_test`); term tests carry `term_id` and `results_release_at` instead of `subject_week_id`. The existing quiz maker and approval workflow are reused by making the shared quiz queries kind-aware (weekly output stays identical). Grading is server-only so `is_correct` never reaches the client before submit. No-show zeros are computed with a cohort left-join, never stored.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Drizzle ORM over Postgres, Supabase auth + RLS, Zod, Tailwind v4, vitest (pure-logic tests only), lucide-react.

## Global Constraints

- Never use the em dash character; use a plain dash.
- Never add a co-author trailer to commits.
- Apply the migration with `node scripts/apply-sql.mjs supabase/migrations/0028_term_test.sql`; never `drizzle-kit push` / `db:push` / `db:generate` (they wipe all RLS).
- `is_correct` must never be present in any term-test take payload sent to the client; grading is server-only.
- One attempt per student, enforced by a unique constraint AND an application guard.
- The weekly-quiz behavior and appearance must not change; kind-aware shared queries must return identical data for weekly quizzes.
- Update `docs/checklist.md` and `docs/security-checklist.md` in the same commit as the code they describe.
- Pure-logic unit tests only (no DB or render harness), matching the existing `src/lib/*.test.ts` convention.
- Backend task verification: typecheck (`npm run typecheck`), `npm test`, and `npm run db:check-rls` green after the migration. Front-end rows stay 🔶 until the owner browser-verifies; never mark ✅ before that.
- Write markdown docs one full sentence per physical line.

---

## File Structure

Backend:
- `supabase/migrations/0028_term_test.sql` (new) - enum, `quizzes` alterations, two new tables, indexes, check constraint, RLS.
- `src/db/schema.ts` (modify) - `quizKindEnum`, new `quizzes` columns, `termTestAttempts`, `termTestAnswers`, inferred types.
- `src/lib/term-test.ts` (new) - pure grading, state derivation, and leaderboard ranking functions.
- `src/lib/term-test.test.ts` (new) - unit tests for the above.
- `src/lib/quiz-queries.ts` (modify) - make `getQuizWithContent` and the list select kind-aware; add term-test queries.
- `src/app/_actions/term-tests.ts` (new) - create, submit/grade, and any term-test-only actions.

Frontend:
- `src/app/admin/quizzes/_components/*` (modify) and the quiz builder page (modify) - term-test creation entry + kind-aware labels.
- `src/components/quiz/quiz-maker.tsx` (modify) - tolerate a term test in its header label.
- `src/app/student/term-tests/[id]/page.tsx` (new) + `_components/*` (new) - take / pending / results states.
- `src/components/term-test/leaderboard.tsx` (new) - ranking UI adapted from the math-game leaderboard.
- `src/app/parent/term-tests/[id]/[childId]/page.tsx` (new) - parent read-only results + board.

Records:
- `docs/changes/2026-07-29-term-test-leaderboard.md` (new).
- `docs/checklist.md`, `docs/security-checklist.md` (modify).

---

## Task 1: Database foundation (migration + schema)

**Files:**
- Create: `supabase/migrations/0028_term_test.sql`
- Modify: `src/db/schema.ts` (quizzes block near line 833; add tables after `quizAttachments` near line 920)

**Interfaces:**
- Produces: `quizKindEnum`; `quizzes.kind`, `quizzes.termId`, `quizzes.resultsReleaseAt`; `termTestAttempts` (`id, quizId, studentId, score, total, submittedAt`); `termTestAnswers` (`id, attemptId, questionId, selectedOptionId`); types `TermTestAttempt`, `TermTestAnswer`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0028_term_test.sql`:

```sql
-- 0028_term_test.sql - term_test quiz kind + scored attempts + leaderboard.
-- Additive. A term test is a quizzes row with kind='term_test', term_id set,
-- subject_week_id null, results_release_at set. Weekly rows are unchanged
-- (kind defaults to 'weekly', term_id/results_release_at null).
-- quiz_kind is a brand-new type, so using it (incl. as a default) in this same
-- transaction is safe; the "new value in same tx" rule only affects ALTER TYPE.

begin;

create type quiz_kind as enum ('weekly', 'term_test');

alter table public.quizzes
  add column if not exists kind quiz_kind not null default 'weekly',
  add column if not exists term_id uuid references public.terms(id),
  add column if not exists results_release_at timestamptz;

alter table public.quizzes
  alter column subject_week_id drop not null;

-- At most one term test per subject per term.
create unique index if not exists quizzes_term_test_unique_idx
  on public.quizzes (subject_id, term_id)
  where kind = 'term_test';

-- Shape integrity: weekly rows are week-scoped; term tests are term-scoped.
alter table public.quizzes
  add constraint quizzes_kind_shape check (
    (kind = 'weekly'
      and subject_week_id is not null
      and term_id is null
      and results_release_at is null)
    or
    (kind = 'term_test'
      and subject_week_id is null
      and term_id is not null
      and results_release_at is not null)
  );

create table if not exists public.term_test_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null,
  total integer not null,
  submitted_at timestamptz not null default now(),
  unique (quiz_id, student_id)
);
create index if not exists term_test_attempts_board_idx
  on public.term_test_attempts (quiz_id, score desc);

create table if not exists public.term_test_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.term_test_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_option_id uuid references public.quiz_options(id) on delete cascade,
  unique (attempt_id, question_id)
);

-- RLS: mirror the quiz tables. Admin full access; a student owns only their
-- own attempts/answers. Leaderboard reads of other students happen through
-- server (Drizzle) code, which bypasses RLS, so student-owns-their-rows is
-- the correct row-level rule.
alter table public.term_test_attempts enable row level security;
alter table public.term_test_answers enable row level security;

drop policy if exists term_test_attempts_admin_all on term_test_attempts;
drop policy if exists term_test_attempts_student_own on term_test_attempts;
drop policy if exists term_test_answers_admin_all on term_test_answers;
drop policy if exists term_test_answers_student_own on term_test_answers;

create policy term_test_attempts_admin_all on term_test_attempts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy term_test_attempts_student_own on term_test_attempts
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy term_test_answers_admin_all on term_test_answers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy term_test_answers_student_own on term_test_answers
  for all to authenticated
  using (
    exists (
      select 1 from term_test_attempts a
      where a.id = attempt_id and a.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from term_test_attempts a
      where a.id = attempt_id and a.student_id = auth.uid()
    )
  );

commit;
```

- [ ] **Step 2: Apply the migration**

Run: `node scripts/apply-sql.mjs supabase/migrations/0028_term_test.sql`
Expected: applies cleanly, no error.

- [ ] **Step 3: Verify RLS is intact**

Run: `npm run db:check-rls`
Expected: green (no tables reported without RLS; the two new tables have policies).

- [ ] **Step 4: Mirror the changes in `src/db/schema.ts`**

Add the enum before the `quizzes` table:

```ts
export const quizKindEnum = pgEnum("quiz_kind", ["weekly", "term_test"]);
```

In the `quizzes` table definition, add columns (and make `subjectWeekId` nullable by removing `.notNull()`):

```ts
    kind: quizKindEnum("kind").notNull().default("weekly"),
    subjectWeekId: uuid("subject_week_id").references(() => subjectWeeks.id, {
      onDelete: "cascade",
    }),
    termId: uuid("term_id").references(() => terms.id),
    resultsReleaseAt: timestamp("results_release_at", { withTimezone: true }),
```

After `quizAttachments`, add:

```ts
export const termTestAttempts = pgTable(
  "term_test_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("term_test_attempts_student_unique_idx").on(t.quizId, t.studentId),
    index("term_test_attempts_board_idx").on(t.quizId, t.score.desc()),
  ],
);

export const termTestAnswers = pgTable(
  "term_test_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => termTestAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    selectedOptionId: uuid("selected_option_id").references(() => quizOptions.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [uniqueIndex("term_test_answers_attempt_question_idx").on(t.attemptId, t.questionId)],
);

export type TermTestAttempt = typeof termTestAttempts.$inferSelect;
export type TermTestAnswer = typeof termTestAnswers.$inferSelect;
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS. The nullable `subjectWeekId` will surface any code that assumed it non-null; if the compiler flags existing weekly code, fix only what is required to compile and note it in the report (do not change weekly behavior).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0028_term_test.sql src/db/schema.ts
git commit -m "feat(term-test): schema - quiz_kind, term test columns, attempt tables"
```

---

## Task 2: Pure term-test logic (grading, state, ranking) with tests

**Files:**
- Create: `src/lib/term-test.ts`
- Test: `src/lib/term-test.test.ts`

**Interfaces:**
- Produces:
  - `gradeTermTest(answerKeys: TermTestKey[], answers: TermTestAnswerInput[]): { ok: true; score: number; total: number; graded: GradedAnswer[] } | { ok: false; error: string }` - unanswered counts as wrong (never an error), rejects duplicate or cross-question option IDs.
  - `deriveTermTestState(input: { status: string; resultsReleaseAt: Date; now: Date; hasAttempt: boolean }): "not_open" | "open" | "submitted_pending" | "released"`.
  - `rankTermTestBoard(cohort: CohortMember[], attempts: AttemptScore[], meId: string, opts?: { topN?: number }): { top: BoardRow[]; me: BoardRow | null }` - cohort members with no attempt score 0 and rank last; display name is first name + last initial; a `me` row is returned only when the viewer is outside the top N.
- Consumes: nothing from other tasks (pure).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/term-test.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  gradeTermTest,
  deriveTermTestState,
  rankTermTestBoard,
} from "./term-test";

const keys = [
  { questionId: "q1", optionIds: ["a", "b"], correctOptionId: "a" },
  { questionId: "q2", optionIds: ["c", "d"], correctOptionId: "d" },
];

describe("gradeTermTest", () => {
  it("scores correct answers and counts unanswered as wrong", () => {
    const r = gradeTermTest(keys, [{ questionId: "q1", optionId: "a" }]);
    expect(r).toEqual({
      ok: true,
      score: 1,
      total: 2,
      graded: [
        { questionId: "q1", selectedOptionId: "a", correctOptionId: "a", isCorrect: true },
        { questionId: "q2", selectedOptionId: null, correctOptionId: "d", isCorrect: false },
      ],
    });
  });

  it("gives full marks when all correct", () => {
    const r = gradeTermTest(keys, [
      { questionId: "q1", optionId: "a" },
      { questionId: "q2", optionId: "d" },
    ]);
    expect(r.ok && r.score).toBe(2);
    expect(r.ok && r.total).toBe(2);
  });

  it("gives zero when all wrong", () => {
    const r = gradeTermTest(keys, [
      { questionId: "q1", optionId: "b" },
      { questionId: "q2", optionId: "c" },
    ]);
    expect(r.ok && r.score).toBe(0);
  });

  it("rejects two answers for one question", () => {
    const r = gradeTermTest(keys, [
      { questionId: "q1", optionId: "a" },
      { questionId: "q1", optionId: "b" },
    ]);
    expect(r.ok).toBe(false);
  });

  it("rejects an option that does not belong to the question", () => {
    const r = gradeTermTest(keys, [{ questionId: "q1", optionId: "zzz" }]);
    expect(r.ok).toBe(false);
  });

  it("rejects an answer for an unknown question", () => {
    const r = gradeTermTest(keys, [{ questionId: "qX", optionId: "a" }]);
    expect(r.ok).toBe(false);
  });
});

describe("deriveTermTestState", () => {
  const base = { resultsReleaseAt: new Date("2026-08-01T00:00:00Z") };
  it("is not_open until approved", () => {
    expect(
      deriveTermTestState({ ...base, status: "pending_review", now: new Date("2026-07-01"), hasAttempt: false }),
    ).toBe("not_open");
  });
  it("is open when approved, before release, no attempt", () => {
    expect(
      deriveTermTestState({ ...base, status: "approved", now: new Date("2026-07-15"), hasAttempt: false }),
    ).toBe("open");
  });
  it("is submitted_pending when attempted and before release", () => {
    expect(
      deriveTermTestState({ ...base, status: "approved", now: new Date("2026-07-15"), hasAttempt: true }),
    ).toBe("submitted_pending");
  });
  it("is released at/after the release date regardless of attempt", () => {
    expect(
      deriveTermTestState({ ...base, status: "approved", now: new Date("2026-08-02"), hasAttempt: false }),
    ).toBe("released");
    expect(
      deriveTermTestState({ ...base, status: "approved", now: new Date("2026-08-02"), hasAttempt: true }),
    ).toBe("released");
  });
});

describe("rankTermTestBoard", () => {
  const cohort = [
    { studentId: "s1", firstName: "Ada", lastName: "Lovelace" },
    { studentId: "s2", firstName: "Alan", lastName: "Turing" },
    { studentId: "s3", firstName: "Grace", lastName: null },
  ];
  it("ranks by score desc, no-shows at zero last, masks names", () => {
    const { top } = rankTermTestBoard(
      cohort,
      [
        { studentId: "s1", score: 8, submittedAt: new Date("2026-07-10") },
        { studentId: "s2", score: 5, submittedAt: new Date("2026-07-11") },
      ],
      "s2",
    );
    expect(top.map((r) => [r.rank, r.name, r.score, r.isMe])).toEqual([
      [1, "Ada L.", 8, false],
      [2, "Alan T.", 5, true],
      [3, "Grace", 0, false],
    ]);
  });
  it("surfaces a me row only when outside the top N", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      studentId: `s${i}`,
      firstName: `Name${i}`,
      lastName: "X",
    }));
    const attempts = many.map((m, i) => ({
      studentId: m.studentId,
      score: 100 - i,
      submittedAt: new Date("2026-07-10"),
    }));
    const { top, me } = rankTermTestBoard(many, attempts, "s24", { topN: 20 });
    expect(top).toHaveLength(20);
    expect(me?.isMe).toBe(true);
    expect(me?.rank).toBe(25);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/term-test.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/lib/term-test.ts`**

```ts
export type TermTestKey = {
  questionId: string;
  optionIds: string[];
  correctOptionId: string;
};

export type TermTestAnswerInput = {
  questionId: string;
  optionId: string;
};

export type GradedAnswer = {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
};

/**
 * Grades one term-test attempt. Unlike the practice grader, a missing answer is
 * not an error - it counts as wrong. Duplicate answers for one question and
 * option IDs that do not belong to their question are still rejected, because
 * they indicate a malformed submission rather than an unanswered question.
 * Pure - no I/O.
 */
export function gradeTermTest(
  answerKeys: TermTestKey[],
  answers: TermTestAnswerInput[],
): { ok: true; score: number; total: number; graded: GradedAnswer[] } | { ok: false; error: string } {
  const byQuestion = new Map<string, string>();
  for (const answer of answers) {
    if (byQuestion.has(answer.questionId)) {
      return { ok: false, error: "Each question can only have one answer." };
    }
    byQuestion.set(answer.questionId, answer.optionId);
  }

  const known = new Set(answerKeys.map((k) => k.questionId));
  for (const questionId of byQuestion.keys()) {
    if (!known.has(questionId)) {
      return { ok: false, error: "An answer does not belong to this test." };
    }
  }

  const graded: GradedAnswer[] = [];
  for (const key of answerKeys) {
    const selected = byQuestion.get(key.questionId) ?? null;
    if (selected !== null && !key.optionIds.includes(selected)) {
      return { ok: false, error: "An answer does not belong to this test." };
    }
    graded.push({
      questionId: key.questionId,
      selectedOptionId: selected,
      correctOptionId: key.correctOptionId,
      isCorrect: selected !== null && selected === key.correctOptionId,
    });
  }

  return {
    ok: true,
    score: graded.filter((g) => g.isCorrect).length,
    total: answerKeys.length,
    graded,
  };
}

export type TermTestState = "not_open" | "open" | "submitted_pending" | "released";

/** Derives the student-facing state. Pure. `now >= resultsReleaseAt` releases. */
export function deriveTermTestState(input: {
  status: string;
  resultsReleaseAt: Date;
  now: Date;
  hasAttempt: boolean;
}): TermTestState {
  const released = input.now.getTime() >= input.resultsReleaseAt.getTime();
  if (released) return "released";
  if (input.status !== "approved") return "not_open";
  return input.hasAttempt ? "submitted_pending" : "open";
}

export type CohortMember = {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
};

export type AttemptScore = {
  studentId: string;
  score: number;
  submittedAt: Date;
};

export type BoardRow = { rank: number; name: string; score: number; isMe: boolean };

function displayName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim() || "Student";
  const initial = (lastName ?? "").trim().charAt(0);
  return initial ? `${first} ${initial}.` : first;
}

/**
 * Merges the cohort with the attempts: a cohort member with no attempt scores 0.
 * Ranks by score desc, then earliest submission (no-shows, having no
 * submission, sort after everyone who submitted). A `me` row is returned only
 * when the viewer is outside the top N. Pure.
 */
export function rankTermTestBoard(
  cohort: CohortMember[],
  attempts: AttemptScore[],
  meId: string,
  opts?: { topN?: number },
): { top: BoardRow[]; me: BoardRow | null } {
  const topN = opts?.topN ?? 20;
  const scoreById = new Map(attempts.map((a) => [a.studentId, a]));
  const merged = cohort.map((m) => {
    const a = scoreById.get(m.studentId);
    return {
      studentId: m.studentId,
      name: displayName(m.firstName, m.lastName),
      score: a?.score ?? 0,
      submittedAt: a?.submittedAt ?? null,
    };
  });

  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.submittedAt && b.submittedAt) {
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    }
    if (a.submittedAt) return -1;
    if (b.submittedAt) return 1;
    return 0;
  });

  const ranked: BoardRow[] = merged.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    isMe: r.studentId === meId,
  }));

  const top = ranked.slice(0, topN);
  const me = ranked.find((r) => r.isMe) ?? null;
  const meOutsideTop = me && !top.some((r) => r.isMe) ? me : null;
  return { top, me: meOutsideTop };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/term-test.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/term-test.ts src/lib/term-test.test.ts
git commit -m "feat(term-test): pure grading, state, and leaderboard-ranking logic"
```

---

## Task 3: Kind-aware quiz queries + term-test authoring

**Files:**
- Modify: `src/lib/quiz-queries.ts`
- Create: `src/app/_actions/term-tests.ts`

**Interfaces:**
- Consumes: `quizKindEnum`, `quizzes.kind/termId/resultsReleaseAt` (Task 1); the shared `gradeTermTest` is not used here.
- Produces:
  - `getQuizWithContent` and the admin/tutor list rows gain `kind: "weekly" | "term_test"`, a nullable `weekNumber`, and always-present `termId/termYear/termNumber` (derived from the week for weekly, from `quizzes.term_id` for term tests). Weekly output is otherwise unchanged.
  - `listTermTestTargets(): Promise<{ subjects: {...}[]; terms: {...}[] }>` - subject+term pairs that do not yet have a term test.
  - `createTermTest(input: { subjectId; termId; title; tutorId?; note? }): Promise<{ ok: true; id: string } | { ok: false; error: string }>` in `term-tests.ts` (reuses the request/direct pattern from `quizzes.ts`; defaults `resultsReleaseAt` to the term's `end_date` at 23:59 local, admin-editable later).
  - `setTermTestReleaseDate(input: { quizId; releaseAt }): Promise<Result>` - admin-only, editable while not yet released.

- [ ] **Step 1: Make `getQuizWithContent` and the list select kind-aware**

In `src/lib/quiz-queries.ts`, change the week join from `innerJoin` to `leftJoin`, add a `leftJoin` to `terms` via `quizzes.termId`, and derive the term with `coalesce`. Concretely, replace the `.innerJoin(subjectWeeks ...).innerJoin(terms ...)` chains in `baseListSelect()` and `getQuizWithContent()` with:

```ts
    .leftJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .leftJoin(weekTerm, eq(weekTerm.id, subjectWeeks.termId))
    .leftJoin(directTerm, eq(directTerm.id, quizzes.termId))
```

where `weekTerm` and `directTerm` are `alias(terms, "week_term")` / `alias(terms, "direct_term")`. Select:

```ts
      kind: quizzes.kind,
      weekNumber: subjectWeeks.weekNumber, // null for term tests
      termId: sql<string>`coalesce(${weekTerm.id}, ${directTerm.id})`,
      termYear: sql<number>`coalesce(${weekTerm.year}, ${directTerm.year})`.mapWith(Number),
      termNumber: sql<number>`coalesce(${weekTerm.term_number}, ${directTerm.term_number})`.mapWith(Number),
```

Update `QuizListRow`, `QuizWithContent["quiz"]`, and `StudentQuiz["quiz"]` types: add `kind: "weekly" | "term_test"`, make `weekNumber: number | null`, keep `subjectWeekId: string | null`. Fix `toListRow` accordingly. Weekly rows must produce identical values to before (verify by reading the existing weekly quiz list in the browser is out of scope here; typecheck + the unchanged weekly test route is the machine check).

- [ ] **Step 2: Add `listTermTestTargets`**

Mirror `listQuizTargets`, but instead of listing weeks without a quiz, list `(subject, term)` pairs that have curriculum in that term (a `subjectWeeks` row exists) and do not yet have a `term_test` quiz:

```ts
export async function listTermTestTargets(): Promise<{
  tutors: { id: string; name: string }[];
  slots: { subjectId: string; termId: string; label: string }[];
}> {
  // tutors: same query as listQuizTargets
  // slots: distinct (subjects.id, terms.id) from subjectWeeks joined to subjects+terms,
  //   left join quizzes on (quizzes.subjectId, quizzes.termId, kind='term_test'),
  //   where that quizzes.id is null, ordered by year desc, term desc, subject asc.
  //   label = `${subjectName} - ${year} Term ${termNumber}`
}
```

- [ ] **Step 3: Add `createTermTest` and `setTermTestReleaseDate` in `src/app/_actions/term-tests.ts`**

Reuse the structure of `createQuizDirect` / `requestQuiz` from `quizzes.ts` (admin guard via `requireAdmin`, Zod parse, unique-violation handling). Differences: insert `kind: "term_test"`, `subjectId`, `termId`, `subjectWeekId: null`, `resultsReleaseAt` defaulted from the term's `end_date` (end of that day), `status: "requested"` when a `tutorId` is given else `"draft"`. Enforce one-per-subject-per-term by catching the partial-unique violation. Send the same "Quiz requested" notification to the tutor when assigned. `setTermTestReleaseDate` is admin-only, validates the quiz is `kind='term_test'` and not yet released (`now < resultsReleaseAt`), and updates `resultsReleaseAt`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Resolve any consumer of `weekNumber`/`subjectWeekId` that now sees a nullable value; for weekly display code, guard with the `kind` discriminator (weekly always has a week).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz-queries.ts src/app/_actions/term-tests.ts
git commit -m "feat(term-test): kind-aware quiz queries + term-test authoring actions"
```

---

## Task 4: Student take + server-side grading

**Files:**
- Modify: `src/lib/quiz-queries.ts` (add `getStudentTermTest`)
- Modify: `src/app/_actions/term-tests.ts` (add `submitTermTest`)

**Interfaces:**
- Consumes: `gradeTermTest` (Task 2); `quizzes.kind/termId/resultsReleaseAt`, `termTestAttempts`, `termTestAnswers` (Task 1); `canStudentAccessApprovedQuiz` (existing, reused - it keys on subject enrollment, which term tests share).
- Produces:
  - `getStudentTermTest(studentId, quizId): Promise<StudentTermTest | null>` - returns the term test (kind must be `term_test`), its `resultsReleaseAt`, the questions and options WITH `is_correct` OMITTED, and whether this student already has an attempt. Returns null if not a term test or the student is not in the subject.
  - `submitTermTest(input: { quizId; answers: {questionId; optionId}[] }): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Add `getStudentTermTest`**

Model it on `getStudentQuiz` (which already omits `is_correct`). Additions: assert `quizzes.kind = 'term_test'`; select `resultsReleaseAt`; join the term via `quizzes.termId` (not via a week); include only leaf questions and context containers exactly as `getStudentQuiz` does; add `hasAttempt` via a single `term_test_attempts` lookup for `(quizId, studentId)`. The options projection must NOT select `isCorrect` (copy the existing `getStudentQuiz` option select verbatim).

- [ ] **Step 2: Add `submitTermTest` with server-side grading**

```ts
export async function submitTermTest(input: {
  quizId: string;
  answers: Array<{ questionId: string; optionId: string }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole("student");
  const parsed = z.object({
    quizId: z.string().uuid(),
    answers: z.array(z.object({
      questionId: z.string().uuid(),
      optionId: z.string().uuid(),
    })).max(200),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid submission." };
  const { quizId, answers } = parsed.data;

  // Access + kind + open-window checks.
  const [quiz] = await db.select({
      id: quizzes.id, kind: quizzes.kind, status: quizzes.status,
      resultsReleaseAt: quizzes.resultsReleaseAt,
    }).from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz || quiz.kind !== "term_test" || quiz.status !== "approved") {
    return { ok: false, error: "Term test not found." };
  }
  if (!(await canStudentAccessApprovedQuiz(user.id, quizId))) {
    return { ok: false, error: "Term test not found." };
  }
  if (!quiz.resultsReleaseAt || Date.now() >= quiz.resultsReleaseAt.getTime()) {
    return { ok: false, error: "This term test is closed." };
  }

  // Build the answer key server-side (leaf, gradable questions only).
  const questions = await db.select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quizId), sql`${quizQuestions.type} <> 'context'`));
  if (questions.length === 0) return { ok: false, error: "This term test has no questions." };
  const options = await db.select({
      id: quizOptions.id, questionId: quizOptions.questionId, isCorrect: quizOptions.isCorrect,
    }).from(quizOptions).where(inArray(quizOptions.questionId, questions.map((q) => q.id)));
  const answerKeys = questions.map((q) => {
    const qo = options.filter((o) => o.questionId === q.id);
    return { questionId: q.id, optionIds: qo.map((o) => o.id), correctOptionId: qo.find((o) => o.isCorrect)?.id ?? "" };
  });
  if (answerKeys.some((k) => k.correctOptionId === "")) {
    return { ok: false, error: "This term test is missing a correct answer." };
  }

  const graded = gradeTermTest(answerKeys, answers);
  if (!graded.ok) return graded;

  // One attempt: insert attempt + answers transactionally; unique violation = already taken.
  try {
    await db.transaction(async (tx) => {
      const [attempt] = await tx.insert(termTestAttempts).values({
        quizId, studentId: user.id, score: graded.score, total: graded.total,
      }).returning({ id: termTestAttempts.id });
      await tx.insert(termTestAnswers).values(
        graded.graded.map((g) => ({
          attemptId: attempt.id, questionId: g.questionId, selectedOptionId: g.selectedOptionId,
        })),
      );
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "You have already taken this term test." };
    throw error;
  }

  revalidatePath(`/student/term-tests/${quizId}`);
  return { ok: true };
}
```

Reuse `isUniqueViolation` (export it from `quizzes.ts` or duplicate the tiny helper locally).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Confirm `is_correct` is never selected in the take path**

Grep the new `getStudentTermTest` for `isCorrect`; expected: no match in the option projection.
Run: `grep -n "isCorrect" src/lib/quiz-queries.ts` and confirm every hit is inside an admin/tutor or grading function, never `getStudentTermTest`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz-queries.ts src/app/_actions/term-tests.ts
git commit -m "feat(term-test): student take query (no is_correct) + server-side grading"
```

---

## Task 5: Results + leaderboard queries (student + parent)

**Files:**
- Modify: `src/lib/quiz-queries.ts` (or a new `src/lib/term-test-results.ts`; prefer a new file to keep quiz-queries focused)

**Interfaces:**
- Consumes: `rankTermTestBoard` (Task 2); `termTestAttempts`, `termTestAnswers`, `familyLinks` (Task 1 + existing).
- Produces:
  - `getTermTestCohort(subjectId, resultsReleaseAt): Promise<CohortMember[]>` - students with an enrollment in a class of that subject active at the deadline: `enrolled_at <= releaseAt AND (withdrawn_at IS NULL OR withdrawn_at > releaseAt)`, distinct by student.
  - `getStudentTermTestResults(studentId, quizId): Promise<TermTestResults | null>` - only meaningful once released; returns the student's score/total, their `graded` corrections (each question prompt, their selected option text or null, the correct option text), and the ranked board via `rankTermTestBoard(cohort, attempts, studentId)`.
  - `getParentTermTestResults(parentId, childId, quizId): Promise<TermTestResults | null>` - asserts `familyLinks(parentId, childId)` exists and the child is in the cohort; returns the child's results and the board (read-only).

- [ ] **Step 1: Implement the cohort query**

```ts
export async function getTermTestCohort(subjectId: string, releaseAt: Date): Promise<CohortMember[]> {
  const rows = await db.selectDistinct({
      studentId: enrollments.studentId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .where(and(
      eq(classes.subjectId, subjectId),
      lte(enrollments.enrolledAt, releaseAt),
      or(isNull(enrollments.withdrawnAt), gt(enrollments.withdrawnAt, releaseAt)),
    ));
  return rows.map((r) => ({ studentId: r.studentId, firstName: r.firstName, lastName: r.lastName }));
}
```

- [ ] **Step 2: Implement `getStudentTermTestResults`**

Load the term test (must be `kind='term_test'`, `approved`); compute released = `now >= resultsReleaseAt`; if not released return `{ released: false }` shape (the page renders the pending state). If released: load all attempts for the quiz (`studentId, score, submittedAt`), load the cohort via `getTermTestCohort`, call `rankTermTestBoard(cohort, attempts, studentId)`, and load this student's `graded` answers joined to question prompts and option texts for the corrections view. A student who never took it has no answers row: show the questions with correct answers and no selection, score 0.

- [ ] **Step 3: Implement `getParentTermTestResults`**

Assert the family link and cohort membership before returning anything; otherwise return null. Reuse the released-board computation, ranking with `childId` as the "me" id so the parent sees their child highlighted.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/term-test-results.ts src/lib/quiz-queries.ts
git commit -m "feat(term-test): cohort, results, and leaderboard queries (student + parent)"
```

---

## Task 6: Admin/tutor authoring UI

**Files:**
- Modify: the admin quizzes list/new pages under `src/app/admin/quizzes/` and `src/app/admin/quizzes/_components/`
- Modify: `src/app/tutor/quizzes/` list (kind-aware labels)
- Modify: `src/components/quiz/quiz-maker.tsx` (header tolerates a term test)

**Interfaces:**
- Consumes: `listTermTestTargets`, `createTermTest`, `setTermTestReleaseDate` (Task 3); kind-aware `getQuizWithContent`, list rows (Task 3).

- [ ] **Step 1: Load the ui-ux-pro-max skill and run the change through its ruleset before writing UI.**

- [ ] **Step 2: Add a "Create term test" entry**

Alongside the existing new-quiz / request-quiz forms, add a term-test create form: pick a `(subject, term)` slot from `listTermTestTargets().slots`, a title, an optional tutor to assign, and (optional) a release date defaulting to term end. Submit calls `createTermTest`. On success, route to the existing quiz builder page for the returned id.

- [ ] **Step 3: Group term tests in the quiz lists**

In the admin and tutor quiz lists, render rows with `kind === "term_test"` under a "Term tests" heading (with a "Term N" label instead of "Week N"), and weekly quizzes under their existing grouping. Use the `kind` field on the list row.

- [ ] **Step 4: Make the quiz-maker header kind-aware**

`quiz-maker.tsx` currently shows the week in its header. When `content.quiz.kind === "term_test"`, show "Term {termNumber} test" and the release date (with an inline control that calls `setTermTestReleaseDate` while unreleased). Everything else in the maker (questions, options, context sets, attachments, reorder) is unchanged and already kind-agnostic.

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. Wait for the build to exit 0; do not background it.

- [ ] **Step 6: Update the checklist and commit**

Set the quiz/term-test checklist rows honestly (FE 🔶 pending browser QA, BE ✅). Commit code + checklist together:

```bash
git add src/app/admin/quizzes src/app/tutor/quizzes src/components/quiz/quiz-maker.tsx docs/checklist.md
git commit -m "feat(term-test): admin/tutor authoring UI + kind-aware quiz lists"
```

---

## Task 7: Student take/pending/results UI + leaderboard

**Files:**
- Create: `src/app/student/term-tests/[id]/page.tsx`
- Create: `src/app/student/term-tests/[id]/_components/` (take form, pending card, results view)
- Create: `src/components/term-test/leaderboard.tsx`
- Modify: the student subject page to surface a term-test card

**Interfaces:**
- Consumes: `getStudentTermTest`, `submitTermTest` (Task 4); `getStudentTermTestResults` (Task 5); `deriveTermTestState` (Task 2).

- [ ] **Step 1: Load the ui-ux-pro-max skill and run the UI through its ruleset.**

- [ ] **Step 2: Build the term-test page as a state machine**

`page.tsx` (server): `requireRole("student")`, load `getStudentTermTest`; if null `notFound()`. Compute state with `deriveTermTestState`. Render:
- `open`: the take form (model on `student-practice-quiz.tsx`, single-select per question, context sets render passage + sub-questions), submitting to `submitTermTest`; on success, refresh to the pending state. Warn that it is one attempt.
- `submitted_pending`: a calm "Submitted - results release after {date}" card, nothing else (honor the embargo; do not show score).
- `not_open`: a "coming soon" card.
- `released`: load `getStudentTermTestResults`, render score + rank + the corrections list (each question, the student's answer marked right/wrong, the correct answer shown, no explanation text) + the `Leaderboard`.

- [ ] **Step 3: Build the leaderboard component**

Create `src/components/term-test/leaderboard.tsx` by adapting `src/app/student/math-game/_components/leaderboard.tsx` (same Row markup, medals, "you" styling), but a single board (no difficulty tabs) titled by subject + term, taking `{ top: BoardRow[]; me: BoardRow | null }`.

- [ ] **Step 4: Surface a term-test card on the student subject page**

On `/student/subjects/[id]`, when a term test exists for the viewed term, show a card linking to `/student/term-tests/{id}` with the current state label (Take / Submitted / Results). Keep it visually consistent with the (restyled or current) subject page; do not entangle it with the weekly practice-quiz card.

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS (wait for exit 0).

- [ ] **Step 6: Update the checklist and commit**

```bash
git add src/app/student/term-tests src/components/term-test "src/app/student/subjects/[id]" docs/checklist.md
git commit -m "feat(term-test): student take/pending/results UI + leaderboard"
```

---

## Task 8: Parent read-only results + board

**Files:**
- Create: `src/app/parent/term-tests/[id]/[childId]/page.tsx`
- Modify: the parent child-progress/subject surface to link to it

**Interfaces:**
- Consumes: `getParentTermTestResults` (Task 5); the `Leaderboard` component (Task 7).

- [ ] **Step 1: Load the ui-ux-pro-max skill and run the UI through its ruleset.**

- [ ] **Step 2: Build the parent page**

`requireRole("parent")`; load `getParentTermTestResults(parent.id, childId, id)`; if null `notFound()`. Only render once released (before release, show the same pending card - a parent should not see a child's score early either). Render the child's score + rank + corrections (read-only) + the `Leaderboard` with the child highlighted.

- [ ] **Step 3: Add the entry point**

From the parent's view of a child's subject/progress, link to the term-test result when one exists and is released. If no such per-child subject surface exists yet, add the link to the child's progress card and note the placement in the report.

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS (wait for exit 0).

- [ ] **Step 5: Update the checklist and commit**

```bash
git add "src/app/parent/term-tests" src/app/parent docs/checklist.md
git commit -m "feat(term-test): parent read-only results + leaderboard"
```

---

## Task 9: Documentation and security checklist

**Files:**
- Create: `docs/changes/2026-07-29-term-test-leaderboard.md`
- Modify: `docs/checklist.md`, `docs/security-checklist.md`

- [ ] **Step 1: Write the change doc**

Record: the `kind` discriminator model and migration 0028, server-side grading (the security-relevant difference from practice quizzes), the embargo + date-driven release with no-show zeros computed by cohort left-join, the cohort definition (active enrollment at the deadline), routes added, and the browser-QA items still owner-gated.

- [ ] **Step 2: Finalize the checklist rows**

Ensure every term-test row reflects reality: BE ✅ (typecheck + tests + db:check-rls green), FE 🔶 until the owner browser-verifies. Add a term-test row if none exists; name the routes/files + date in Notes.

- [ ] **Step 3: Add the security-checklist entry**

Add a row asserting: term-test take payloads exclude `is_correct`; grading is server-only; one attempt enforced by unique constraint; results embargoed until `results_release_at`; parent access gated by `familyLinks` + cohort membership. Mark verified by the `grep` check from Task 4 and code review; browser confirmation owner-gated.

- [ ] **Step 4: Commit**

```bash
git add docs/changes/2026-07-29-term-test-leaderboard.md docs/checklist.md docs/security-checklist.md
git commit -m "docs(term-test): change record + checklist + security checklist"
```

---

## Self-Review Notes

- Spec coverage: scoring scope (weekly untouched) - Tasks 1/3/4; one-attempt auto-grade server-side - Tasks 1/2/4; embargo + date release + no-show zeros - Tasks 2/5/7; leaderboard subject+term for students and parents - Tasks 5/7/8; corrections without explanation - Tasks 5/7. All spec sections map to a task.
- Type consistency: `BoardRow`, `CohortMember`, `AttemptScore`, `TermTestKey`, `gradeTermTest`, `deriveTermTestState`, `rankTermTestBoard` are defined in Task 2 and consumed by name in Tasks 4/5/7/8. `kind`, `termId`, `resultsReleaseAt`, `termTestAttempts`, `termTestAnswers` defined in Task 1 and used downstream.
- Weekly-safety: Task 3 converts inner joins to left joins with `coalesce`; the risk is a weekly regression, so its verification leans on typecheck plus the unchanged weekly practice route, and the owner browser-checks weekly quizzes still look and behave identically before merge.
