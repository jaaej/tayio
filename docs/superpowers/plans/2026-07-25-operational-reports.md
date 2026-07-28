# Operational Reports v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/admin/reports` stub with a live, term-scoped operational dashboard (attendance, homework completion, class fill, and per-class average test result) plus a CSV export.

**Architecture:** Pure computation (rates, org-wide rollup, CSV) lives in unit-tested modules with no I/O. A thin `server-only` Drizzle module fetches raw per-class aggregates. The RSC page and a CSV route handler compose the two. No new tables and no migration.

**Tech Stack:** Next.js 16 App Router (RSC), Drizzle ORM over Postgres, Tailwind v4, vitest for pure-logic tests.

## Global Constraints

- Never use the em dash "—" in source or docs; use a plain dash "-". (The literal character `—` used as a metric placeholder in the UI is data shown to the user, which is fine; do not use it in prose or comments.)
- No new database tables and no migration.
- All data-access functions are `server-only` and admin-guarded via `requireAdmin` (`src/app/admin/_lib/guard.ts`).
- No PIN gate on this page; nothing here is financial.
- Period model is term-based, selected via a `?term=<termId>` URL param, defaulting to the current term.
- Metric definitions are the contract (copied from the spec):
  - Attendance % = attended / marked, attended = attendance status in (`present`, `late`, `left_early`, `makeup_attended`), marked = those plus `absent`; unmarked/future lessons excluded; `null` when marked = 0.
  - Homework completion % = completed / assigned, completed = assignment status in (`submitted`, `late`, `marked`, `returned`); assigned = all assignments for homework due in-term; `null` when assigned = 0.
  - Fill % = active enrolments / capacity, current snapshot (not term-scoped); `null` when capacity = 0.
  - Avg test result = AVG(score) over marked (`score` not null) `is_test` homework due in-term; `null` when count = 0.
- Percentages render as integers; avg test result renders to one decimal; `null` renders as the placeholder dash in the UI and as an empty cell in CSV.
- Tests are pure-logic only (vitest, co-located `*.test.ts`); the project has no DB or render test harness, so data-access and page tasks are verified by `npm run typecheck` plus a described manual check, not by automated tests.

---

## File Structure

- Create: `src/app/admin/_lib/reports-metrics.ts` - types + pure rate/rollup/avg functions.
- Create: `src/app/admin/_lib/reports-metrics.test.ts` - vitest unit tests.
- Create: `src/app/admin/_lib/reports-csv.ts` - pure CSV serialization.
- Create: `src/app/admin/_lib/reports-csv.test.ts` - vitest unit tests.
- Create: `src/app/admin/_lib/reports-queries.ts` - `server-only` Drizzle data access.
- Create: `src/app/admin/reports/_components/term-select.tsx` - client term dropdown that routes on change.
- Modify: `src/app/admin/reports/page.tsx` - replace the stub with the real page.
- Create: `src/app/admin/reports/export/route.ts` - CSV download route handler.
- Modify: `docs/checklist.md` - update the "Reporting to parents/tutors" row.

---

## Task 1: Pure metrics module

**Files:**
- Create: `src/app/admin/_lib/reports-metrics.ts`
- Test: `src/app/admin/_lib/reports-metrics.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ClassMetricRow = { classId: string; className: string; tutorName: string; attended: number; markedLessons: number; homeworkCompleted: number; homeworkAssigned: number; enrolled: number; capacity: number; testScoreSum: number; testScoreCount: number }`
  - `type ClassReportRow = { classId: string; className: string; tutorName: string; attendancePct: number | null; homeworkPct: number | null; avgTestResult: number | null; enrolled: number; capacity: number }`
  - `type OrgRollup = { attendancePct: number | null; homeworkPct: number | null; fillPct: number | null }`
  - `ratePct(numerator: number, denominator: number): number | null`
  - `avgScore(sum: number, count: number): number | null`
  - `toClassReportRow(row: ClassMetricRow): ClassReportRow`
  - `rollupOrgWide(rows: ClassMetricRow[]): OrgRollup`

- [ ] **Step 1: Write the failing tests**

Create `src/app/admin/_lib/reports-metrics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ratePct,
  avgScore,
  toClassReportRow,
  rollupOrgWide,
  type ClassMetricRow,
} from "./reports-metrics";

function row(over: Partial<ClassMetricRow> = {}): ClassMetricRow {
  return {
    classId: "c",
    className: "Class",
    tutorName: "Tutor",
    attended: 0,
    markedLessons: 0,
    homeworkCompleted: 0,
    homeworkAssigned: 0,
    enrolled: 0,
    capacity: 0,
    testScoreSum: 0,
    testScoreCount: 0,
    ...over,
  };
}

describe("ratePct", () => {
  it("rounds to an integer percentage", () => {
    expect(ratePct(1, 3)).toBe(33);
    expect(ratePct(2, 3)).toBe(67);
  });
  it("returns null when the denominator is zero", () => {
    expect(ratePct(0, 0)).toBeNull();
    expect(ratePct(5, 0)).toBeNull();
  });
});

describe("avgScore", () => {
  it("averages to one decimal place", () => {
    expect(avgScore(230, 3)).toBe(76.7);
  });
  it("returns null when count is zero", () => {
    expect(avgScore(0, 0)).toBeNull();
  });
});

describe("toClassReportRow", () => {
  it("maps counts to rates and passes through fill counts", () => {
    const r = toClassReportRow(
      row({
        attended: 8,
        markedLessons: 10,
        homeworkCompleted: 3,
        homeworkAssigned: 4,
        enrolled: 6,
        capacity: 8,
        testScoreSum: 150,
        testScoreCount: 2,
      }),
    );
    expect(r.attendancePct).toBe(80);
    expect(r.homeworkPct).toBe(75);
    expect(r.avgTestResult).toBe(75);
    expect(r.enrolled).toBe(6);
    expect(r.capacity).toBe(8);
  });
  it("uses null for empty denominators", () => {
    const r = toClassReportRow(row());
    expect(r.attendancePct).toBeNull();
    expect(r.homeworkPct).toBeNull();
    expect(r.avgTestResult).toBeNull();
  });
});

describe("rollupOrgWide", () => {
  it("weights by totals, not by averaging per-class rates", () => {
    // Class A: 1/1 attended (100%). Class B: 1/9 attended (11%).
    // Average-of-rates would be ~56%; weighted is 2/10 = 20%.
    const out = rollupOrgWide([
      row({ attended: 1, markedLessons: 1, enrolled: 1, capacity: 1 }),
      row({ attended: 1, markedLessons: 9, enrolled: 9, capacity: 10 }),
    ]);
    expect(out.attendancePct).toBe(20);
    expect(out.fillPct).toBe(91); // 10/11
  });
  it("returns nulls when there is nothing to roll up", () => {
    expect(rollupOrgWide([])).toEqual({
      attendancePct: null,
      homeworkPct: null,
      fillPct: null,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/admin/_lib/reports-metrics.test.ts`
Expected: FAIL - cannot find module `./reports-metrics`.

- [ ] **Step 3: Write the implementation**

Create `src/app/admin/_lib/reports-metrics.ts`:

```ts
export type ClassMetricRow = {
  classId: string;
  className: string;
  tutorName: string;
  attended: number;
  markedLessons: number;
  homeworkCompleted: number;
  homeworkAssigned: number;
  enrolled: number;
  capacity: number;
  testScoreSum: number;
  testScoreCount: number;
};

export type ClassReportRow = {
  classId: string;
  className: string;
  tutorName: string;
  attendancePct: number | null;
  homeworkPct: number | null;
  avgTestResult: number | null;
  enrolled: number;
  capacity: number;
};

export type OrgRollup = {
  attendancePct: number | null;
  homeworkPct: number | null;
  fillPct: number | null;
};

/** Integer percentage, or null when the denominator is zero. */
export function ratePct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

/** Average rounded to one decimal, or null when there are no values. */
export function avgScore(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

export function toClassReportRow(r: ClassMetricRow): ClassReportRow {
  return {
    classId: r.classId,
    className: r.className,
    tutorName: r.tutorName,
    attendancePct: ratePct(r.attended, r.markedLessons),
    homeworkPct: ratePct(r.homeworkCompleted, r.homeworkAssigned),
    avgTestResult: avgScore(r.testScoreSum, r.testScoreCount),
    enrolled: r.enrolled,
    capacity: r.capacity,
  };
}

export function rollupOrgWide(rows: ClassMetricRow[]): OrgRollup {
  const sum = (pick: (r: ClassMetricRow) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);
  return {
    attendancePct: ratePct(sum((r) => r.attended), sum((r) => r.markedLessons)),
    homeworkPct: ratePct(
      sum((r) => r.homeworkCompleted),
      sum((r) => r.homeworkAssigned),
    ),
    fillPct: ratePct(sum((r) => r.enrolled), sum((r) => r.capacity)),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/admin/_lib/reports-metrics.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/_lib/reports-metrics.ts src/app/admin/_lib/reports-metrics.test.ts
git commit -m "feat(reports): pure operational metrics module"
```

---

## Task 2: CSV serializer

**Files:**
- Create: `src/app/admin/_lib/reports-csv.ts`
- Test: `src/app/admin/_lib/reports-csv.test.ts`

**Interfaces:**
- Consumes: `ClassReportRow` from `reports-metrics.ts`.
- Produces: `classReportToCsv(rows: ClassReportRow[]): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/admin/_lib/reports-csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classReportToCsv } from "./reports-csv";
import type { ClassReportRow } from "./reports-metrics";

function r(over: Partial<ClassReportRow> = {}): ClassReportRow {
  return {
    classId: "c",
    className: "Maths",
    tutorName: "Chen",
    attendancePct: 80,
    homeworkPct: 75,
    avgTestResult: 78.5,
    enrolled: 6,
    capacity: 8,
    ...over,
  };
}

describe("classReportToCsv", () => {
  it("emits a header row then one row per class", () => {
    const csv = classReportToCsv([r()]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Class,Tutor,Attendance %,Homework %,Avg test result,Enrolled,Capacity",
    );
    expect(lines[1]).toBe("Maths,Chen,80,75,78.5,6,8");
  });
  it("renders null metrics as empty cells", () => {
    const csv = classReportToCsv([
      r({ attendancePct: null, homeworkPct: null, avgTestResult: null }),
    ]);
    expect(csv.split("\n")[1]).toBe("Maths,Chen,,,,6,8");
  });
  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = classReportToCsv([
      r({ className: "Maths, Yr10", tutorName: 'A "B"' }),
    ]);
    expect(csv.split("\n")[1]).toBe('"Maths, Yr10","A ""B""",80,75,78.5,6,8');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/admin/_lib/reports-csv.test.ts`
Expected: FAIL - cannot find module `./reports-csv`.

- [ ] **Step 3: Write the implementation**

Create `src/app/admin/_lib/reports-csv.ts`:

```ts
import type { ClassReportRow } from "./reports-metrics";

const HEADER = [
  "Class",
  "Tutor",
  "Attendance %",
  "Homework %",
  "Avg test result",
  "Enrolled",
  "Capacity",
];

function escape(field: string): string {
  if (/[",\n]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

function num(value: number | null): string {
  return value === null ? "" : String(value);
}

export function classReportToCsv(rows: ClassReportRow[]): string {
  const lines = [HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escape(row.className),
        escape(row.tutorName),
        num(row.attendancePct),
        num(row.homeworkPct),
        num(row.avgTestResult),
        String(row.enrolled),
        String(row.capacity),
      ].join(","),
    );
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/admin/_lib/reports-csv.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/_lib/reports-csv.ts src/app/admin/_lib/reports-csv.test.ts
git commit -m "feat(reports): CSV serializer for the per-class table"
```

---

## Task 3: Data-access queries

**Files:**
- Create: `src/app/admin/_lib/reports-queries.ts`

**Interfaces:**
- Consumes: `ClassMetricRow` from `reports-metrics.ts`.
- Produces:
  - `type TermOption = { id: string; label: string; startDate: string; endDate: string }`
  - `listTerms(): Promise<TermOption[]>`
  - `getCurrentTermId(todayIso: string): Promise<string | null>`
  - `getClassMetricRows(term: { startDate: string; endDate: string }): Promise<ClassMetricRow[]>`

Note: no automated test - the project has no DB test harness. Verify by `npm run typecheck` here, and functionally in Task 4 against the running app.

- [ ] **Step 1: Write the implementation**

Create `src/app/admin/_lib/reports-queries.ts`:

```ts
import "server-only";
import { and, asc, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  lessons,
  profiles,
  terms,
} from "@/db/schema";
import type { ClassMetricRow } from "./reports-metrics";

export type TermOption = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export async function listTerms(): Promise<TermOption[]> {
  const rows = await db
    .select({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));
  return rows.map((t) => ({
    id: t.id,
    label: `${t.year} Term ${t.termNumber}`,
    startDate: t.startDate,
    endDate: t.endDate,
  }));
}

export async function getCurrentTermId(todayIso: string): Promise<string | null> {
  const rows = await db
    .select({ id: terms.id })
    .from(terms)
    .where(and(lte(terms.startDate, todayIso), gte(terms.endDate, todayIso)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Exclusive upper bound: the day after `endDate`, so timestamp dueDates on the
 *  last day of term are included. */
function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function getClassMetricRows(term: {
  startDate: string;
  endDate: string;
}): Promise<ClassMetricRow[]> {
  const endExclusive = dayAfter(term.endDate);

  const classRows = await db
    .select({
      classId: classes.id,
      className: classes.name,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      capacity: classes.capacity,
    })
    .from(classes)
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .orderBy(asc(classes.name));

  const att = await db
    .select({
      classId: lessons.classId,
      attended: sql<number>`count(*) filter (where ${attendance.status} in ('present','late','left_early','makeup_attended'))`.mapWith(Number),
      marked: sql<number>`count(*)`.mapWith(Number),
    })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .where(and(gte(lessons.date, term.startDate), lte(lessons.date, term.endDate)))
    .groupBy(lessons.classId);

  const hw = await db
    .select({
      classId: homework.classId,
      completed: sql<number>`count(*) filter (where ${homeworkAssignments.status} in ('submitted','late','marked','returned'))`.mapWith(Number),
      assigned: sql<number>`count(*)`.mapWith(Number),
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(and(gte(homework.dueDate, term.startDate), lt(homework.dueDate, endExclusive)))
    .groupBy(homework.classId);

  const tst = await db
    .select({
      classId: homework.classId,
      scoreSum: sql<number>`coalesce(sum(${homeworkAssignments.score}), 0)`.mapWith(Number),
      scoreCount: sql<number>`count(${homeworkAssignments.score})`.mapWith(Number),
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(
      and(
        eq(homework.isTest, true),
        gte(homework.dueDate, term.startDate),
        lt(homework.dueDate, endExclusive),
      ),
    )
    .groupBy(homework.classId);

  const enr = await db
    .select({
      classId: enrollments.classId,
      enrolled: sql<number>`count(*)`.mapWith(Number),
    })
    .from(enrollments)
    .where(isNull(enrollments.withdrawnAt))
    .groupBy(enrollments.classId);

  const attMap = new Map(att.map((r) => [r.classId, r]));
  const hwMap = new Map(hw.map((r) => [r.classId, r]));
  const tstMap = new Map(tst.map((r) => [r.classId, r]));
  const enrMap = new Map(enr.map((r) => [r.classId, r]));

  return classRows.map((c) => ({
    classId: c.classId,
    className: c.className,
    tutorName: `${c.tutorFirst} ${c.tutorLast}`.trim(),
    attended: attMap.get(c.classId)?.attended ?? 0,
    markedLessons: attMap.get(c.classId)?.marked ?? 0,
    homeworkCompleted: hwMap.get(c.classId)?.completed ?? 0,
    homeworkAssigned: hwMap.get(c.classId)?.assigned ?? 0,
    enrolled: enrMap.get(c.classId)?.enrolled ?? 0,
    capacity: c.capacity,
    testScoreSum: tstMap.get(c.classId)?.scoreSum ?? 0,
    testScoreCount: tstMap.get(c.classId)?.scoreCount ?? 0,
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If Drizzle complains that `homework.classId` may be null in the `Map` key type, that is acceptable - null keys simply never match a real class id. If it errors on the type, change the map generic to `Map<string | null, ...>`.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_lib/reports-queries.ts
git commit -m "feat(reports): term-scoped per-class metric queries"
```

---

## Task 4: Reports page + term selector

**Files:**
- Create: `src/app/admin/reports/_components/term-select.tsx`
- Modify: `src/app/admin/reports/page.tsx` (replace the whole file)

**Interfaces:**
- Consumes: `listTerms`, `getCurrentTermId`, `getClassMetricRows` (Task 3); `toClassReportRow`, `rollupOrgWide` (Task 1).
- Produces: the rendered page. No exports consumed by later tasks except the shared route the CSV link points at (Task 5).

- [ ] **Step 1: Write the term-select client component**

Create `src/app/admin/reports/_components/term-select.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

type Option = { id: string; label: string };

export function TermSelect({
  terms,
  selectedId,
}: {
  terms: Option[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={selectedId}
      onChange={(e) => router.push(`/admin/reports?term=${e.target.value}`)}
      aria-label="Select term"
    >
      {terms.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </Select>
  );
}
```

- [ ] **Step 2: Replace the page**

Replace the entire contents of `src/app/admin/reports/page.tsx`:

```tsx
import Link from "next/link";
import { Download } from "lucide-react";
import { Card, CardHead, StatTile, PageHeader, Pill, Empty } from "@/components/admin/ui";
import { requireAdmin } from "@/app/admin/_lib/guard";
import {
  listTerms,
  getCurrentTermId,
  getClassMetricRows,
} from "@/app/admin/_lib/reports-queries";
import { toClassReportRow, rollupOrgWide } from "@/app/admin/_lib/reports-metrics";
import { TermSelect } from "./_components/term-select";

export const dynamic = "force-dynamic";

function pct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function score(value: number | null): string {
  return value === null ? "—" : String(value);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  await requireAdmin();
  const { term: termParam } = await searchParams;

  const terms = await listTerms();
  if (terms.length === 0) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <PageHeader eyebrow="Reports" title="Operational reports" />
        <Card>
          <Empty>No terms defined yet. Create a term to see reports.</Empty>
        </Card>
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentTermId = await getCurrentTermId(todayIso);
  const selected =
    terms.find((t) => t.id === termParam) ??
    terms.find((t) => t.id === currentTermId) ??
    terms[0];

  const metricRows = await getClassMetricRows(selected);
  const rows = metricRows.map(toClassReportRow);
  const org = rollupOrgWide(metricRows);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        eyebrow="Reports"
        title="Operational reports"
        sub="Attendance, homework completion, and class fill for the selected term."
        actions={
          <div className="flex items-center gap-3">
            <TermSelect terms={terms} selectedId={selected.id} />
            <Link
              href={`/admin/reports/export?term=${selected.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-bold text-ink hover:bg-surface-2 transition-colors"
            >
              <Download className="h-4 w-4" /> CSV
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Attendance" value={pct(org.attendancePct)} tone="brand" accent />
        <StatTile label="Homework completion" value={pct(org.homeworkPct)} tone="sky" accent />
        <StatTile label="Class fill (now)" value={pct(org.fillPct)} tone="mint" accent />
      </section>

      <Card>
        <CardHead
          title="By class"
          action={<Pill tone="default">{rows.length} classes</Pill>}
        />
        {rows.length === 0 ? (
          <Empty>No classes to report on for this term.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="px-5 py-2.5 font-bold">Class</th>
                  <th className="px-5 py-2.5 font-bold">Tutor</th>
                  <th className="px-5 py-2.5 font-bold text-right">Attendance</th>
                  <th className="px-5 py-2.5 font-bold text-right">Homework</th>
                  <th className="px-5 py-2.5 font-bold text-right">Avg test</th>
                  <th className="px-5 py-2.5 font-bold text-right">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.classId} className="hover:bg-surface-2 transition-colors">
                    <td className="px-5 py-3 font-bold text-ink">{r.className}</td>
                    <td className="px-5 py-3 text-ink-soft">{r.tutorName}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{pct(r.attendancePct)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{pct(r.homeworkPct)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{score(r.avgTestResult)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {r.enrolled}/{r.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Reconcile UI-kit imports**

Confirm `Card`, `CardHead`, `StatTile`, `PageHeader`, `Pill`, `Empty` are all exported from `src/components/admin/ui` (the stub already imported `Card`, `CardHead`, `Pill`, `StatTile`, `PageHeader`; confirm `Empty` exists - it is used on the revenue page import list). Confirm `Select` is exported from `src/components/ui/select` (used by `family-links-manager.tsx`). If a name differs, adjust the import to the actual export. Do not invent new components.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification (no automated harness for pages)**

Start the dev server (the user runs it; do not start it unsolicited). As an admin:
- Open `/admin/reports`. Confirm it defaults to the current term and shows three tiles plus a per-class table.
- Pick one class and hand-compute attendance % from its marked lessons in the term; confirm it matches.
- Confirm a class with no marked lessons / no homework / no tests shows the dash, not `0%` or a crash.
- Switch the term in the dropdown; confirm the URL gains `?term=...` and all figures change, while "Class fill (now)" stays constant.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/reports/page.tsx src/app/admin/reports/_components/term-select.tsx
git commit -m "feat(reports): live operational dashboard page"
```

---

## Task 5: CSV export route

**Files:**
- Create: `src/app/admin/reports/export/route.ts`

**Interfaces:**
- Consumes: `listTerms`, `getClassMetricRows` (Task 3); `toClassReportRow` (Task 1); `classReportToCsv` (Task 2); `requireAdmin`.
- Produces: `GET /admin/reports/export?term=<id>` returning a `text/csv` attachment.

- [ ] **Step 1: Write the route handler**

Create `src/app/admin/reports/export/route.ts`:

```ts
import { type NextRequest } from "next/server";
import { requireAdmin } from "@/app/admin/_lib/guard";
import { listTerms, getClassMetricRows } from "@/app/admin/_lib/reports-queries";
import { toClassReportRow } from "@/app/admin/_lib/reports-metrics";
import { classReportToCsv } from "@/app/admin/_lib/reports-csv";

export async function GET(req: NextRequest) {
  await requireAdmin();

  const termId = req.nextUrl.searchParams.get("term");
  const terms = await listTerms();
  const term = terms.find((t) => t.id === termId) ?? terms[0];
  if (!term) {
    return new Response("No term available", { status: 400 });
  }

  const rows = (await getClassMetricRows(term)).map(toClassReportRow);
  const csv = classReportToCsv(rows);
  const filename = `operational-report-${term.label.replace(/\s+/g, "-")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With the dev server running, as an admin: click the CSV link on `/admin/reports`. Confirm a file downloads whose rows match the table on screen, with dash cells rendered empty. As a non-admin, hitting `/admin/reports/export` must redirect/deny (inherited from `requireAdmin`).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/reports/export/route.ts
git commit -m "feat(reports): CSV export route for operational report"
```

---

## Task 6: Checklist update and final pass

**Files:**
- Modify: `docs/checklist.md`

- [ ] **Step 1: Update the reporting row**

In `docs/checklist.md`, find the Admin table row `| Reporting to parents/tutors | ...`. Update its FE/BE ticks and note. Set FE and BE to reflect that Operational shipped while Financial and Student remain unbuilt. Suggested note text:

```
**Operational reports shipped 2026-07-25** - `/admin/reports` now renders live term-scoped attendance %, homework completion %, class fill %, and per-class avg test result, with CSV export (`reports-queries.ts` + pure `reports-metrics.ts`/`reports-csv.ts`, tested; page + `export/route.ts`). Financial + Student sub-projects still unbuilt (Student blocked on quizzes + metric definition). Pending runtime click-through before marking fully done.
```

Because the row covers three sub-projects, keep it at partial (🔶) overall, not ✅, until all three land and are runtime-verified.

- [ ] **Step 2: Full test + typecheck sweep**

Run: `npx vitest run`
Expected: PASS (including the two new suites).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add docs/checklist.md
git commit -m "docs(checklist): operational reports shipped"
```

---

## Self-review notes (for the author, not a task)

- Spec coverage: term selector (Task 4), three rollup tiles (Task 4 + rollup in Task 1), per-class table with all six columns (Task 4), exact metric definitions (Tasks 1 + 3), score caveat (respected - avg is sum/count with the existing percentage convention), no PIN gate (page has none), CSV export (Tasks 2 + 5), non-goals excluded (no per-student, financial, at-risk, tutor workload, scheduling). Covered.
- Placeholder scan: no TBD/TODO; every code step shows full code.
- Type consistency: `ClassMetricRow`, `ClassReportRow`, `OrgRollup`, `TermOption` and the function names (`ratePct`, `avgScore`, `toClassReportRow`, `rollupOrgWide`, `classReportToCsv`, `listTerms`, `getCurrentTermId`, `getClassMetricRows`) are used identically across tasks.
