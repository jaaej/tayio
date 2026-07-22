# Student Math Game ("Math Sprint") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Zetamac-style mental-math speed game in the student portal — four difficulty tiers, 60-second timed runs with typed integer answers, per-difficulty leaderboards, and pick-your-sound feedback — entered from a purple gradient CTA block in the student sidebar.

**Architecture:** A single route `/student/math-game`. Pure, unit-tested modules for question generation and score plausibility. A `"use client"` game component owns the timer/state machine and plays synthesized Web Audio sounds. A server action records scores; server queries compute leaderboards. One append-only `math_game_scores` table.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM (Postgres), Zod v4, Tailwind v4 (`.theme-student` cornflower theme + a bespoke purple gradient), Web Audio API. Tests via **vitest** (added in Task 2 — the repo has no test runner yet).

## Global Constraints

- **Every generated answer is a whole integer.** No fractions, no remainders, in any tier (including Genius). Division is always generated as `divisor × quotient`; percentages are chosen so the result is whole.
- **Auth:** every server entry point uses `requireRole("student")` from `@/lib/auth`. Available to all students (both role tiers).
- **DB import:** `import { db } from "@/db/client"`.
- **Migrations are raw SQL** in `supabase/migrations/`, applied manually by the user (Supabase SQL editor / psql). **Never run `db:push` or `db:generate`** — `db:push` wipes all RLS.
- **Leaderboard privacy:** show `firstName + " " + lastInitial + "."` only. Never expose email or user id to the client.
- **Gradient stops (approximate, sample exact hex from the screenshot at build):** `linear-gradient(120deg, #7B6EF0 0%, #6D3BD6 55%, #5A21B0 100%)`.
- **Difficulty union type** (used everywhere): `type Difficulty = "easy" | "medium" | "hard" | "genius"`.
- **Timer:** 60 seconds. **Countdown:** 3-2-1 before play.
- **Plausibility caps:** easy 150, medium 120, hard 100, genius 80.

---

### Task 1: Database — enum, table, migration

**Files:**
- Modify: `src/db/schema.ts` (add enum + table near the other pgEnum/pgTable declarations)
- Create: `supabase/migrations/0022_math_game_scores.sql`

**Interfaces:**
- Produces: Drizzle table `mathGameScores` with columns `{ id, studentId, difficulty, score, playedAt }` and enum `mathGameDifficultyEnum`. Consumed by Tasks 4 and 6.

- [ ] **Step 1: Add the enum and table to `src/db/schema.ts`**

Add after the existing enum declarations (near line 91, before `profiles`, is fine — but place the table anywhere after `profiles` is declared since it references it; put both at the end of the file's table declarations for isolation):

```ts
export const mathGameDifficultyEnum = pgEnum("math_game_difficulty", [
  "easy",
  "medium",
  "hard",
  "genius",
]);

export const mathGameScores = pgTable(
  "math_game_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    difficulty: mathGameDifficultyEnum("difficulty").notNull(),
    score: integer("score").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("math_game_scores_board_idx").on(t.difficulty, t.score.desc()),
    index("math_game_scores_student_idx").on(t.studentId, t.difficulty),
  ],
);
```

(`integer`, `uuid`, `timestamp`, `pgEnum`, `pgTable`, `index` are already imported at the top of `schema.ts`.)

- [ ] **Step 2: Create the migration `supabase/migrations/0022_math_game_scores.sql`**

```sql
-- 0022 — math game scores (student "Math Sprint" speed-drill leaderboard)
--
-- Append-only: one row per completed 60s run. Leaderboard = max(score) per
-- student per difficulty. App reads/writes via Drizzle as the postgres role
-- (bypasses RLS); RLS enabled with no policies = deny-by-default for
-- anon/authenticated, matching the existing model.
--
-- Reversible by: drop table public.math_game_scores; drop type math_game_difficulty;

begin;

do $$ begin
  create type math_game_difficulty as enum ('easy', 'medium', 'hard', 'genius');
exception when duplicate_object then null;
end $$;

create table if not exists public.math_game_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  difficulty math_game_difficulty not null,
  score integer not null,
  played_at timestamptz not null default now()
);

create index if not exists math_game_scores_board_idx
  on public.math_game_scores(difficulty, score desc);
create index if not exists math_game_scores_student_idx
  on public.math_game_scores(student_id, difficulty);

alter table public.math_game_scores enable row level security;

commit;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). This confirms `schema.ts` compiles with the new table.

- [ ] **Step 4: Apply the migration (USER action — do not automate)**

The user runs `supabase/migrations/0022_math_game_scores.sql` against the database via the Supabase SQL editor or psql. Do **not** run `db:push`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts supabase/migrations/0022_math_game_scores.sql
git commit -m "feat(math-game): add math_game_scores table + migration"
```

---

### Task 2: Question generator (TDD) + vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency + `test` script)
- Create: `src/app/student/math-game/_components/question-generator.ts`
- Test: `src/app/student/math-game/_components/question-generator.test.ts`

**Interfaces:**
- Produces:
  - `type Difficulty = "easy" | "medium" | "hard" | "genius"`
  - `type Question = { text: string; answer: number }`
  - `function generateQuestion(difficulty: Difficulty): Question`
  These are consumed by Task 4 (score plausibility uses `Difficulty`) and Task 5 (game client).

- [ ] **Step 1: Install vitest and add the test script**

```bash
npm i -D vitest
```

Then add to `package.json` `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write the failing test `question-generator.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { generateQuestion, type Difficulty } from "./question-generator";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "genius"];
const N = 2000;

describe("generateQuestion", () => {
  it("always returns an integer answer and a non-empty prompt", () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(d);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("easy is 2-operand addition with a correct sum", () => {
    for (let i = 0; i < N; i++) {
      const q = generateQuestion("easy");
      const m = q.text.match(/^(\d+) \+ (\d+)$/);
      expect(m).not.toBeNull();
      expect(q.answer).toBe(Number(m![1]) + Number(m![2]));
    }
  });

  it("easy/medium/hard never produce a negative answer", () => {
    for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
      for (let i = 0; i < N; i++) {
        expect(generateQuestion(d).answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("division text divides cleanly (no remainder)", () => {
    for (const d of ["hard", "genius"] as Difficulty[]) {
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(d);
        const m = q.text.match(/^(\d+) ÷ (\d+)$/);
        if (m) {
          const dividend = Number(m[1]);
          const divisor = Number(m[2]);
          expect(dividend % divisor).toBe(0);
          expect(q.answer).toBe(dividend / divisor);
        }
      }
    }
  });

  it("percent questions yield whole-number answers", () => {
    for (let i = 0; i < N; i++) {
      const q = generateQuestion("genius");
      const m = q.text.match(/^(\d+)% of (\d+)$/);
      if (m) {
        const p = Number(m[1]);
        const base = Number(m[2]);
        expect(q.answer).toBe((base * p) / 100);
        expect(Number.isInteger((base * p) / 100)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./question-generator` / `generateQuestion is not a function`.

- [ ] **Step 5: Implement `question-generator.ts`**

```ts
export type Difficulty = "easy" | "medium" | "hard" | "genius";
export type Question = { text: string; answer: number };

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function easy(): Question {
  const a = randInt(1, 99);
  const b = randInt(1, 99);
  return { text: `${a} + ${b}`, answer: a + b };
}

function medium(): Question {
  switch (pick(["add", "sub", "mult"])) {
    case "add": {
      const a = randInt(10, 99);
      const b = randInt(10, 99);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case "sub": {
      const a = randInt(10, 99);
      const b = randInt(10, a);
      return { text: `${a} - ${b}`, answer: a - b };
    }
    default: {
      const a = randInt(2, 12);
      const b = randInt(2, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    }
  }
}

function hard(): Question {
  switch (pick(["add", "sub", "mult", "div"])) {
    case "add": {
      const a = randInt(11, 99);
      const b = randInt(11, 99);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case "sub": {
      let a = randInt(11, 99);
      let b = randInt(11, 99);
      if (b > a) [a, b] = [b, a];
      return { text: `${a} - ${b}`, answer: a - b };
    }
    case "mult": {
      const a = randInt(2, 12);
      const b = randInt(2, 100);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    default: {
      const d = randInt(2, 12);
      const q = randInt(2, 100);
      return { text: `${d * q} ÷ ${d}`, answer: q };
    }
  }
}

const PERCENT_STEP: Record<number, number> = { 10: 10, 20: 5, 25: 4, 50: 2, 75: 4 };

function genius(): Question {
  switch (
    pick(["add3", "sub3", "mult2", "div", "order", "square", "cube", "percent"])
  ) {
    case "add3": {
      const a = randInt(100, 999);
      const b = randInt(100, 999);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case "sub3": {
      const a = randInt(100, 999);
      const b = randInt(100, 999);
      return { text: `${a} - ${b}`, answer: a - b }; // may be negative
    }
    case "mult2": {
      const a = randInt(11, 99);
      const b = randInt(11, 99);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    case "div": {
      const d = randInt(3, 20);
      const q = randInt(10, 50);
      return { text: `${d * q} ÷ ${d}`, answer: q };
    }
    case "order": {
      const a = randInt(2, 20);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      if (Math.random() < 0.5) {
        return { text: `${a} + ${b} × ${c}`, answer: a + b * c };
      }
      return { text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c };
    }
    case "square": {
      const n = randInt(10, 25);
      return { text: `${n}²`, answer: n * n };
    }
    case "cube": {
      const n = randInt(5, 12);
      return { text: `${n}³`, answer: n * n * n };
    }
    default: {
      const p = pick([10, 20, 25, 50, 75]);
      const base = PERCENT_STEP[p] * randInt(2, 20);
      return { text: `${p}% of ${base}`, answer: (base * p) / 100 };
    }
  }
}

export function generateQuestion(difficulty: Difficulty): Question {
  switch (difficulty) {
    case "easy":
      return easy();
    case "medium":
      return medium();
    case "hard":
      return hard();
    case "genius":
      return genius();
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (all 5 tests green).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/app/student/math-game/_components/question-generator.ts src/app/student/math-game/_components/question-generator.test.ts
git commit -m "feat(math-game): question generator + vitest setup"
```

---

### Task 3: Sound module (synthesized Web Audio)

**Files:**
- Create: `src/app/student/math-game/_components/sound.ts`

**Interfaces:**
- Produces:
  - `type SoundName = "coin" | "pop" | "ding" | "zap" | "mute"`
  - `const SOUND_OPTIONS: { name: SoundName; label: string }[]`
  - `function getPreferredSound(): SoundName`
  - `function setPreferredSound(name: SoundName): void`
  - `function playSound(name: SoundName): void`
  Consumed by Tasks 5 and 6.

This module is browser-only (uses `window`/`AudioContext`) and has no unit test — it is exercised by the manual device test in Task 6. All functions guard against SSR (`typeof window === "undefined"`).

- [ ] **Step 1: Implement `sound.ts`**

```ts
export type SoundName = "coin" | "pop" | "ding" | "zap" | "mute";

export const SOUND_OPTIONS: { name: SoundName; label: string }[] = [
  { name: "coin", label: "Coin" },
  { name: "pop", label: "Pop" },
  { name: "ding", label: "Ding" },
  { name: "zap", label: "Zap" },
  { name: "mute", label: "Mute" },
];

const STORAGE_KEY = "mathGameSound";

export function getPreferredSound(): SoundName {
  if (typeof window === "undefined") return "coin";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return SOUND_OPTIONS.some((o) => o.name === v) ? (v as SoundName) : "coin";
}

export function setPreferredSound(name: SoundName): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, name);
}

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

// One short tone; `notes` are [frequencyHz, startOffsetSec] pairs.
function blip(
  type: OscillatorType,
  notes: [number, number][],
  noteDur: number,
): void {
  const ac = audioCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  for (const [freq, at] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = ac.currentTime + at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDur);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + noteDur + 0.02);
  }
}

export function playSound(name: SoundName): void {
  switch (name) {
    case "mute":
      return;
    case "coin":
      // two quick ascending notes — classic pickup
      blip("square", [[988, 0], [1319, 0.07]], 0.12);
      return;
    case "pop":
      blip("sine", [[440, 0]], 0.09);
      return;
    case "ding":
      blip("triangle", [[1568, 0]], 0.22);
      return;
    case "zap":
      blip("sawtooth", [[1200, 0], [600, 0.05]], 0.1);
      return;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/student/math-game/_components/sound.ts
git commit -m "feat(math-game): synthesized pick-your-sound module"
```

---

### Task 4: Score plausibility (TDD) + submitScore action + leaderboard queries

**Files:**
- Create: `src/app/student/math-game/_components/scoring.ts`
- Test: `src/app/student/math-game/_components/scoring.test.ts`
- Create: `src/app/student/math-game/_actions.ts`
- Create: `src/app/student/math-game/_queries.ts`

**Interfaces:**
- Produces:
  - `const SCORE_CAPS: Record<Difficulty, number>`
  - `function isPlausibleScore(difficulty: Difficulty, score: number): boolean`
  - `async function submitScore(difficulty: Difficulty, score: number): Promise<{ ok: true } | { ok: false; error: string }>` (server action)
  - `type LeaderboardRow = { rank: number; name: string; score: number; isMe: boolean }`
  - `async function getLeaderboard(difficulty: Difficulty, meId: string): Promise<{ top: LeaderboardRow[]; me: LeaderboardRow | null }>`
  - `type MyBests = Record<Difficulty, number>`
  - `async function getMyBests(studentId: string): Promise<MyBests>`
  Consumed by Tasks 5 and 6.

- [ ] **Step 1: Write the failing test `scoring.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { isPlausibleScore } from "./scoring";

describe("isPlausibleScore", () => {
  it("accepts scores within a tier's cap", () => {
    expect(isPlausibleScore("easy", 0)).toBe(true);
    expect(isPlausibleScore("easy", 150)).toBe(true);
    expect(isPlausibleScore("genius", 80)).toBe(true);
  });

  it("rejects scores above the cap", () => {
    expect(isPlausibleScore("easy", 151)).toBe(false);
    expect(isPlausibleScore("genius", 81)).toBe(false);
  });

  it("rejects negative and non-integer scores", () => {
    expect(isPlausibleScore("hard", -1)).toBe(false);
    expect(isPlausibleScore("hard", 3.5)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Implement `scoring.ts`**

```ts
import type { Difficulty } from "./question-generator";

export const SCORE_CAPS: Record<Difficulty, number> = {
  easy: 150,
  medium: 120,
  hard: 100,
  genius: 80,
};

export function isPlausibleScore(difficulty: Difficulty, score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= SCORE_CAPS[difficulty];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Implement the server action `_actions.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { mathGameScores } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import type { Difficulty } from "./_components/question-generator";
import { isPlausibleScore } from "./_components/scoring";

const submitSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard", "genius"]),
  score: z.number().int().min(0),
});

export async function submitScore(
  difficulty: Difficulty,
  score: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole("student");

  const parsed = submitSchema.safeParse({ difficulty, score });
  if (!parsed.success) return { ok: false, error: "Invalid submission" };

  if (!isPlausibleScore(parsed.data.difficulty, parsed.data.score)) {
    return { ok: false, error: "Implausible score" };
  }

  await db.insert(mathGameScores).values({
    studentId: user.id,
    difficulty: parsed.data.difficulty,
    score: parsed.data.score,
  });

  revalidatePath("/student/math-game");
  return { ok: true };
}
```

- [ ] **Step 6: Implement the queries `_queries.ts`**

```ts
import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mathGameScores, profiles } from "@/db/schema";
import type { Difficulty } from "./_components/question-generator";

export type LeaderboardRow = {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
};

function displayName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim() || "Student";
  const initial = (lastName ?? "").trim().charAt(0);
  return initial ? `${first} ${initial}.` : first;
}

// Best score per student for one difficulty, ranked by best desc then earliest
// achievement (tie-break approximated by the student's earliest play time).
export async function getLeaderboard(
  difficulty: Difficulty,
  meId: string,
): Promise<{ top: LeaderboardRow[]; me: LeaderboardRow | null }> {
  const rows = await db
    .select({
      studentId: mathGameScores.studentId,
      best: sql<number>`max(${mathGameScores.score})`.as("best"),
      firstAt: sql<string>`min(${mathGameScores.playedAt})`.as("first_at"),
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(mathGameScores)
    .innerJoin(profiles, eq(profiles.id, mathGameScores.studentId))
    .where(eq(mathGameScores.difficulty, difficulty))
    .groupBy(mathGameScores.studentId, profiles.firstName, profiles.lastName)
    .orderBy(desc(sql`best`), asc(sql`first_at`));

  const ranked: LeaderboardRow[] = rows.map((r, i) => ({
    rank: i + 1,
    name: displayName(r.firstName, r.lastName),
    score: Number(r.best),
    isMe: r.studentId === meId,
  }));

  const me = ranked.find((r) => r.isMe) ?? null;
  const top = ranked.slice(0, 20);
  // Only surface a separate "me" row when the student is outside the top 20.
  const meOutsideTop = me && !top.some((r) => r.isMe) ? me : null;

  return { top, me: meOutsideTop };
}

export type MyBests = Record<Difficulty, number>;

export async function getMyBests(studentId: string): Promise<MyBests> {
  const rows = await db
    .select({
      difficulty: mathGameScores.difficulty,
      best: sql<number>`max(${mathGameScores.score})`.as("best"),
    })
    .from(mathGameScores)
    .where(eq(mathGameScores.studentId, studentId))
    .groupBy(mathGameScores.difficulty);

  const bests: MyBests = { easy: 0, medium: 0, hard: 0, genius: 0 };
  for (const r of rows) bests[r.difficulty as Difficulty] = Number(r.best);
  return bests;
}
```

- [ ] **Step 7: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS (typecheck clean; scoring tests green).

- [ ] **Step 8: Commit**

```bash
git add src/app/student/math-game/_components/scoring.ts src/app/student/math-game/_components/scoring.test.ts src/app/student/math-game/_actions.ts src/app/student/math-game/_queries.ts
git commit -m "feat(math-game): score plausibility, submit action, leaderboard queries"
```

---

### Task 5: Game client component (timer + input + sound)

**Files:**
- Create: `src/app/student/math-game/_components/game-client.tsx`

**Interfaces:**
- Consumes: `generateQuestion`, `Difficulty` (Task 2); `playSound`, `SoundName` (Task 3); `submitScore` (Task 4).
- Produces: `function GameClient(props: { difficulty: Difficulty; sound: SoundName; myBest: number; onExit: () => void }): JSX.Element`. Consumed by Task 6.

This is interactive and verified by the Task 6 device test (no unit test).

- [ ] **Step 1: Implement `game-client.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateQuestion,
  type Difficulty,
  type Question,
} from "./question-generator";
import { playSound, type SoundName } from "./sound";
import { submitScore } from "../_actions";

const ROUND_SECONDS = 60;

type Phase = "countdown" | "playing" | "done";

export function GameClient({
  difficulty,
  sound,
  myBest,
  onExit,
}: {
  difficulty: Difficulty;
  sound: SoundName;
  myBest: number;
  onExit: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("countdown");
  const [count, setCount] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [question, setQuestion] = useState<Question>(() =>
    generateQuestion(difficulty),
  );
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown 3 -> 2 -> 1 -> play
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      setPhase("playing");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count]);

  // Focus the input when play starts
  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase]);

  // Round timer
  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      setPhase("done");
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  // Submit final score once, when the round ends
  const submitted = useRef(false);
  useEffect(() => {
    if (phase !== "done" || submitted.current) return;
    submitted.current = true;
    void submitScore(difficulty, score).then(() => router.refresh());
  }, [phase, difficulty, score, router]);

  const advance = useCallback(() => {
    setScore((s) => s + 1);
    playSound(sound);
    setQuestion(generateQuestion(difficulty));
    setInput("");
  }, [sound, difficulty]);

  const onChange = (value: string) => {
    setInput(value);
    // Auto-advance the instant the typed integer equals the answer.
    if (value.trim() !== "" && Number(value) === question.answer) advance();
  };

  const restart = () => {
    submitted.current = false;
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setInput("");
    setQuestion(generateQuestion(difficulty));
    setCount(3);
    setPhase("countdown");
  };

  if (phase === "countdown") {
    return (
      <div className="grid place-items-center py-20">
        <div className="text-[64px] font-extrabold text-brand-600 tabular-nums">
          {count > 0 ? count : "Go!"}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const isRecord = score > myBest;
    return (
      <div className="grid place-items-center gap-4 py-16 text-center">
        <div className="text-[13px] uppercase tracking-[0.16em] text-muted">
          Time&apos;s up
        </div>
        <div className="text-[56px] font-extrabold text-ink tabular-nums leading-none">
          {score}
        </div>
        <div className="text-[14px] text-muted">questions solved</div>
        <div className="text-[13px] font-semibold text-brand-600">
          {isRecord
            ? "🎉 New personal best!"
            : `Your best: ${Math.max(myBest, score)}`}
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={restart}
            className="h-10 px-5 rounded-[14px] bg-brand-500 text-white text-[14px] font-semibold hover:bg-brand-600 transition-colors"
          >
            Play again
          </button>
          <button
            onClick={onExit}
            className="h-10 px-5 rounded-[14px] border border-line-strong text-ink text-[14px] font-semibold hover:bg-surface-2 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // phase === "playing"
  return (
    <div className="grid place-items-center gap-6 py-12">
      <div className="flex w-full max-w-sm items-center justify-between text-[13px] font-semibold">
        <span className="text-muted">
          Score <span className="text-ink tabular-nums">{score}</span>
        </span>
        <span
          className={timeLeft <= 10 ? "text-bad tabular-nums" : "text-muted tabular-nums"}
        >
          {timeLeft}s
        </span>
      </div>
      <div className="text-[44px] font-extrabold text-ink tabular-nums text-center">
        {question.text}
      </div>
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && Number(input) === question.answer) advance();
        }}
        inputMode="numeric"
        autoComplete="off"
        aria-label="Your answer"
        className="h-14 w-40 rounded-[14px] border border-line-strong bg-surface text-center text-[28px] font-bold text-ink outline-none focus:border-brand-500"
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/student/math-game/_components/game-client.tsx
git commit -m "feat(math-game): timed game client with auto-advance + sound"
```

---

### Task 6: Landing page — hero, difficulty picker, leaderboard, wiring

**Files:**
- Create: `src/app/student/math-game/_components/difficulty-picker.tsx`
- Create: `src/app/student/math-game/_components/leaderboard.tsx`
- Create: `src/app/student/math-game/page.tsx`

**Interfaces:**
- Consumes: `getLeaderboard`, `getMyBests`, `LeaderboardRow` (Task 4); `GameClient` (Task 5); `SOUND_OPTIONS`, `getPreferredSound`, `setPreferredSound`, `SoundName` (Task 3); `Difficulty`, `MyBests` (Tasks 2/4).
- Produces: the `/student/math-game` route.

- [ ] **Step 1: Implement `leaderboard.tsx` (client, tabbed)**

```tsx
"use client";

import { useState } from "react";
import type { Difficulty } from "./question-generator";
import type { LeaderboardRow } from "../_queries";

const TABS: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
  { key: "genius", label: "Genius" },
];

export type Boards = Record<
  Difficulty,
  { top: LeaderboardRow[]; me: LeaderboardRow | null }
>;

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-[10px] text-[13px] ${
        row.isMe ? "bg-brand-50 font-semibold text-brand-700" : "text-ink"
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="w-6 text-muted tabular-nums">{row.rank}</span>
        <span>{row.name}</span>
      </span>
      <span className="tabular-nums font-semibold">{row.score}</span>
    </div>
  );
}

export function Leaderboard({ boards }: { boards: Boards }) {
  const [tab, setTab] = useState<Difficulty>("easy");
  const board = boards[tab];

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex gap-1 mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${
              tab === t.key
                ? "bg-brand-500 text-white"
                : "text-muted hover:bg-surface-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {board.top.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-muted">
          No scores yet — be the first!
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {board.top.map((r) => (
            <Row key={`${r.rank}-${r.name}`} row={r} />
          ))}
          {board.me && (
            <>
              <div className="text-center text-muted text-[11px] py-1">···</div>
              <Row row={board.me} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement `difficulty-picker.tsx` (client — owns selection, sound, launches game)**

```tsx
"use client";

import { useEffect, useState } from "react";
import { GameClient } from "./game-client";
import {
  SOUND_OPTIONS,
  getPreferredSound,
  setPreferredSound,
  playSound,
  type SoundName,
} from "./sound";
import type { Difficulty } from "./question-generator";
import type { MyBests } from "../_queries";

const TIERS: { key: Difficulty; label: string; blurb: string }[] = [
  { key: "easy", label: "Easy", blurb: "2-digit addition" },
  { key: "medium", label: "Medium", blurb: "+ − and times tables" },
  { key: "hard", label: "Hard", blurb: "all four operations" },
  { key: "genius", label: "Genius", blurb: "3-digit, powers, order of ops" },
];

export function DifficultyPicker({ myBests }: { myBests: MyBests }) {
  const [sound, setSound] = useState<SoundName>("coin");
  const [active, setActive] = useState<Difficulty | null>(null);

  useEffect(() => setSound(getPreferredSound()), []);

  const chooseSound = (name: SoundName) => {
    setSound(name);
    setPreferredSound(name);
    playSound(name);
  };

  if (active) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-4">
        <GameClient
          difficulty={active}
          sound={sound}
          myBest={myBests[active]}
          onExit={() => setActive(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {TIERS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="group text-left rounded-[14px] border border-line bg-surface p-4 hover:-translate-y-[3px] hover:shadow-md transition-all"
          >
            <div className="text-[15px] font-extrabold text-ink">{t.label}</div>
            <div className="text-[12px] text-muted mt-0.5">{t.blurb}</div>
            <div className="text-[12px] text-brand-600 font-semibold mt-2">
              Best: <span className="tabular-nums">{myBests[t.key]}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-semibold text-muted">Sound</span>
        {SOUND_OPTIONS.map((o) => (
          <button
            key={o.name}
            onClick={() => chooseSound(o.name)}
            className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${
              sound === o.name
                ? "bg-brand-500 text-white"
                : "text-muted hover:bg-surface-2 border border-line"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `page.tsx` (server component)**

```tsx
import { requireRole } from "@/lib/auth";
import { getLeaderboard, getMyBests } from "./_queries";
import { DifficultyPicker } from "./_components/difficulty-picker";
import { Leaderboard, type Boards } from "./_components/leaderboard";
import type { Difficulty } from "./_components/question-generator";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "genius"];

export default async function MathGamePage() {
  const user = await requireRole("student");

  const [myBests, ...boardList] = await Promise.all([
    getMyBests(user.id),
    ...DIFFICULTIES.map((d) => getLeaderboard(d, user.id)),
  ]);

  const boards = Object.fromEntries(
    DIFFICULTIES.map((d, i) => [d, boardList[i]]),
  ) as Boards;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div
        className="relative overflow-hidden rounded-[24px] p-6 text-white shadow-sm"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #7B6EF0 0%, #6D3BD6 55%, #5A21B0 100%)",
        }}
      >
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="text-[22px] font-extrabold tracking-tight">
            Math Sprint 🧮
          </div>
          <div className="text-[13px] text-white/85 mt-1">
            Solve as many as you can in 60 seconds. Pick a difficulty and go.
          </div>
        </div>
      </div>

      <DifficultyPicker myBests={myBests} />
      <Leaderboard boards={boards} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Device test (USER-verified — no "it works" before this)**

Start the dev server (the user does this per their workflow), log in as a seeded student, visit `/student/math-game`, and verify:
1. Hero shows the purple gradient with the light-bloom.
2. Picking a tier runs the 3-2-1 countdown, then a 60s timer.
3. Typing the exact answer auto-advances and plays the selected sound; the timer turns red under 10s.
4. Changing the Sound chip plays a preview and persists across reloads.
5. At 0s the summary shows the score; "Play again" and "Back" both work.
6. After a run, the leaderboard tab for that difficulty shows the score under your name (first name + last initial), and your row is highlighted.

- [ ] **Step 6: Commit**

```bash
git add src/app/student/math-game/_components/difficulty-picker.tsx src/app/student/math-game/_components/leaderboard.tsx src/app/student/math-game/page.tsx
git commit -m "feat(math-game): landing page — hero, difficulty picker, leaderboard"
```

---

### Task 7: Sidebar gradient CTA block

**Files:**
- Modify: `src/components/student/shell.tsx` (sidebar `<aside>` footer, around lines 165-174)

**Interfaces:**
- Consumes: the `/student/math-game` route (Task 6).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Ensure imports exist at the top of `shell.tsx`**

Add `Link` from next/link if not already imported, and add `Gamepad2` to the existing `lucide-react` import:

```tsx
import Link from "next/link";
```

And add `Gamepad2` to the lucide import list, e.g.:

```tsx
import { /* ...existing icons..., */ Gamepad2 } from "lucide-react";
```

- [ ] **Step 2: Add the gradient block inside the sidebar `<aside>`, above the credits `<div>`**

Locate (around lines 165-174):

```tsx
      <aside className="hidden lg:flex flex-col bg-surface border-r border-line overflow-y-auto p-3 pb-2">
        <div className="flex-1">
          <StudentNavLinks sections={sections} />
        </div>
        <div className="mt-4 pt-3 border-t border-line px-3 text-[11px] text-muted">
```

Insert the block between the `flex-1` nav div and the credits div:

```tsx
        <div className="flex-1">
          <StudentNavLinks sections={sections} />
        </div>
        <Link
          href="/student/math-game"
          className="group mt-3 block rounded-[18px] p-3.5 text-white shadow-sm transition-transform hover:-translate-y-[2px]"
          style={{
            backgroundImage:
              "linear-gradient(120deg, #7B6EF0 0%, #6D3BD6 55%, #5A21B0 100%)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 grid place-items-center rounded-[12px] bg-white/20">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-extrabold">Math Sprint</div>
              <div className="text-[11px] text-white/80">Play &amp; climb the board</div>
            </div>
          </div>
        </Link>
        <div className="mt-4 pt-3 border-t border-line px-3 text-[11px] text-muted">
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Device test (USER-verified)**

Reload the student portal: the purple "Math Sprint" block appears at the bottom of the sidebar, lifts on hover, and navigates to `/student/math-game`.

- [ ] **Step 5: Commit**

```bash
git add src/components/student/shell.tsx
git commit -m "feat(math-game): purple Math Sprint CTA block in student sidebar"
```

---

## Self-Review

**Spec coverage:**
- Four difficulty tiers with exact ranges → Task 2 ✓
- No remainders / all-integer answers → Task 2 (generator + tests) ✓
- 60s timed run, 3-2-1 countdown, typed auto-advance, no penalty/no skip → Task 5 ✓
- Pick-your-sound + mute, localStorage persistence → Tasks 3, 6 ✓
- Per-difficulty leaderboard, first name + last initial, "your rank" row → Tasks 4, 6 ✓
- Purple gradient hero + sidebar CTA block → Tasks 6, 7 ✓
- `math_game_scores` table + migration, RLS deny-by-default → Task 1 ✓
- Client-trusted score with server plausibility cap (documented) → Task 4 ✓
- All-students access via `requireRole("student")` → Tasks 4, 6 ✓
- No XP/levels (out of scope) → confirmed absent ✓

**Placeholder scan:** none — every code step is complete and runnable.

**Type consistency:** `Difficulty`, `Question`, `SoundName`, `LeaderboardRow`, `MyBests`, `Boards` are defined once and imported consistently; `generateQuestion`, `playSound`, `submitScore`, `getLeaderboard`, `getMyBests`, `isPlausibleScore` signatures match across producing and consuming tasks.
