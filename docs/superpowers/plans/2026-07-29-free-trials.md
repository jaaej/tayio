# Free-Trial Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record a free trial (start + end date) on an enrollment, show tutors an "On trial" / "Trial ended" badge on their students, and give admin a trials worklist - at deploy-ready quality.

**Architecture:** Two nullable `date` columns on `enrollments` (mirroring the per-enrollment `deliveryMode` pattern), a pure `deriveTrialStatus` helper, an admin-only `setTrialDates` action wrapped in `withActor` for audit, a `/admin/trials` worklist, and a shared `TrialBadge` fed into the tutor's already class-scoped student queries. Trial status is visible to tutors and admins only, never to students or parents.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Drizzle over Postgres, Supabase auth + RLS, Zod, Tailwind v4, vitest (pure-logic tests only), lucide-react.

## Global Constraints

- Never use the em dash character; use a plain dash.
- Never add a co-author trailer to commits.
- Apply the migration with `node scripts/apply-sql.mjs supabase/migrations/0030_free_trials.sql`; never `db:push`/`drizzle-kit push`/`db:generate`.
- Trial status is visible to TUTORS (only for students they teach) and ADMINS only; it must never be selected into any student-facing or parent-facing query.
- `setTrialDates` is admin-only (`requireAdmin`), validates both-dates-or-neither and start <= end, and is wrapped in `withActor({ id, role: "admin" }, ...)` for audit, exactly like `setDeliveryMode`.
- Update `docs/checklist.md` in the same commit as the code it describes; FE stays 🔶 (never ✅) until owner browser QA; BE ✅ only when machine-verified (typecheck + tests + build + db:check-rls).
- When a task runs `npm run build`, wait for it to exit 0; do not background it or end the task while it runs.
- Pure-logic unit tests only (no DB/render harness).
- Write markdown docs one full sentence per physical line.

---

## File Structure

Backend:
- `supabase/migrations/0030_free_trials.sql` (new) - two columns + check constraint.
- `src/db/schema.ts` (modify) - `enrollments.trialStartsAt`, `enrollments.trialEndsAt`.
- `src/lib/trials.ts` (new) + `src/lib/trials.test.ts` (new) - pure status logic + tests.
- `src/app/admin/_lib/actions-enrollments.ts` (modify) - `setTrialDates`.
- `src/app/admin/_lib/queries.ts` (modify) - `getTrials()`.
- `src/app/tutor/_data.ts` (modify) - add trial fields to `getTutorStudents`, `getStudentProfile`, and the attendance/lesson roster query; class-roster page query.

Frontend:
- `src/app/admin/classes/[id]/_components/enrollments-manager.tsx` (modify) - trial control per student.
- `src/app/admin/trials/page.tsx` (new) + `_components/trial-actions.tsx` (new) - worklist + row actions.
- `src/components/tutor/trial-badge.tsx` (new) - shared badge.
- `src/components/admin/shell.tsx` (modify) - "Trials" nav entry.
- The four tutor surfaces (modify) - render the badge.

Records:
- `docs/changes/2026-07-29-free-trials.md` (new); `docs/checklist.md` (modify).

---

## Task 1: Schema (migration + columns)

**Files:**
- Create: `supabase/migrations/0030_free_trials.sql`
- Modify: `src/db/schema.ts` (enrollments table, near line 182)

**Interfaces:**
- Produces: `enrollments.trialStartsAt` (date, nullable), `enrollments.trialEndsAt` (date, nullable).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0030_free_trials.sql`:

```sql
-- 0030_free_trials.sql - per-enrollment free-trial start/end dates.
-- Additive. An enrollment is a trial iff trial_ends_at IS NOT NULL; both dates
-- are set together or both null. Existing rows (both null) satisfy the check.
-- (0028/0029 belong to the held feat/term-test branch and are already applied
-- to the live database; this continues at 0030.)

begin;

alter table public.enrollments
  add column if not exists trial_starts_at date,
  add column if not exists trial_ends_at date;

alter table public.enrollments
  add constraint enrollments_trial_shape check (
    (trial_starts_at is null) = (trial_ends_at is null)
    and (trial_starts_at is null or trial_starts_at <= trial_ends_at)
  );

commit;
```

- [ ] **Step 2: Apply and verify**

Run: `node scripts/apply-sql.mjs supabase/migrations/0030_free_trials.sql`
Then: `npm run db:check-rls`
Expected: applies cleanly; db:check-rls green (no RLS change; enrollments keeps its policies).

- [ ] **Step 3: Mirror in `src/db/schema.ts`**

In the `enrollments` table definition add (the `date` helper is already imported and used by `terms`):

```ts
    trialStartsAt: date("trial_starts_at"),
    trialEndsAt: date("trial_ends_at"),
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0030_free_trials.sql src/db/schema.ts
git commit -m "feat(free-trials): enrollment trial_starts_at/trial_ends_at columns"
```

---

## Task 2: Pure trial-status logic + tests

**Files:**
- Create: `src/lib/trials.ts`
- Test: `src/lib/trials.test.ts`

**Interfaces:**
- Produces:
  - `type TrialStatus = "none" | "on_trial" | "trial_ended"`
  - `deriveTrialStatus(trialStartsAt: string | null, trialEndsAt: string | null, today: string): TrialStatus` - dates are `YYYY-MM-DD`, compared lexicographically (date-only). `trialEndsAt` null -> `none`; `today <= trialEndsAt` -> `on_trial`; else `trial_ended`. `trialStartsAt` is not used for the status split (display only).
  - `isEndingSoon(trialEndsAt: string | null, today: string, withinDays?: number): boolean` - true when the trial is active and ends within `withinDays` (default 7).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/trials.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveTrialStatus, isEndingSoon } from "./trials";

describe("deriveTrialStatus", () => {
  it("is none when there is no end date", () => {
    expect(deriveTrialStatus(null, null, "2026-07-29")).toBe("none");
    expect(deriveTrialStatus("2026-07-01", null, "2026-07-29")).toBe("none");
  });
  it("is on_trial before the end date", () => {
    expect(deriveTrialStatus("2026-07-01", "2026-07-31", "2026-07-15")).toBe("on_trial");
  });
  it("is on_trial on the end date (inclusive)", () => {
    expect(deriveTrialStatus("2026-07-01", "2026-07-31", "2026-07-31")).toBe("on_trial");
  });
  it("is trial_ended the day after the end date", () => {
    expect(deriveTrialStatus("2026-07-01", "2026-07-31", "2026-08-01")).toBe("trial_ended");
  });
});

describe("isEndingSoon", () => {
  it("is false when not a trial", () => {
    expect(isEndingSoon(null, "2026-07-29")).toBe(false);
  });
  it("is true when active and ending within the window", () => {
    expect(isEndingSoon("2026-08-02", "2026-07-29")).toBe(true); // 4 days
  });
  it("is true exactly at the window boundary", () => {
    expect(isEndingSoon("2026-08-05", "2026-07-29", 7)).toBe(true); // 7 days
  });
  it("is false when ending beyond the window", () => {
    expect(isEndingSoon("2026-08-20", "2026-07-29", 7)).toBe(false);
  });
  it("is false when already ended", () => {
    expect(isEndingSoon("2026-07-20", "2026-07-29")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/trials.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/lib/trials.ts`**

```ts
export type TrialStatus = "none" | "on_trial" | "trial_ended";

/**
 * Derives a trial's status from its dates (YYYY-MM-DD strings compared
 * lexicographically, which is date-only and timezone-safe). An enrollment is a
 * trial only when it has an end date; the start date is informational and does
 * not affect the on_trial/ended split. Pure.
 */
export function deriveTrialStatus(
  trialStartsAt: string | null,
  trialEndsAt: string | null,
  today: string,
): TrialStatus {
  if (trialEndsAt === null) return "none";
  return today <= trialEndsAt ? "on_trial" : "trial_ended";
}

/** True when the trial is active and ends within `withinDays` (default 7). Pure. */
export function isEndingSoon(
  trialEndsAt: string | null,
  today: string,
  withinDays = 7,
): boolean {
  if (trialEndsAt === null) return false;
  if (today > trialEndsAt) return false;
  const end = Date.parse(`${trialEndsAt}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  const days = Math.round((end - now) / 86_400_000);
  return days <= withinDays;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/trials.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trials.ts src/lib/trials.test.ts
git commit -m "feat(free-trials): pure trial-status logic + tests"
```

---

## Task 3: Data layer (action + queries + trial fields)

**Files:**
- Modify: `src/app/admin/_lib/actions-enrollments.ts` (add `setTrialDates`)
- Modify: `src/app/admin/_lib/queries.ts` (add `getTrials`)
- Modify: `src/app/tutor/_data.ts` (add trial fields to the tutor's scoped student selects)

**Interfaces:**
- Consumes: `enrollments.trialStartsAt/trialEndsAt` (Task 1); `deriveTrialStatus` (Task 2).
- Produces:
  - `setTrialDates({ classId, studentId, trialStartsAt: string | null, trialEndsAt: string | null })` - admin-only, validated, audited.
  - `getTrials()` - all active-enrollment trials joined to student/class/subject/tutor, for `/admin/trials`.
  - `getTutorStudents`, `getStudentProfile`, and the attendance/lesson roster query each additionally return `trialStartsAt`/`trialEndsAt` for their (already tutor-scoped) rows.

- [ ] **Step 1: Add `setTrialDates` to `actions-enrollments.ts`**

Mirror `setDeliveryMode` exactly (admin guard, `withActor`, per-`(classId, studentId)` update, revalidate). Add:

```ts
const trialSchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
  trialStartsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  trialEndsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

/**
 * Set (or clear) a student's free-trial window within a class. Both dates set =
 * a trial; both null = a regular enrollment (convert-to-regular). Admin only.
 */
export async function setTrialDates(input: z.infer<typeof trialSchema>) {
  const user = await requireAdmin();
  const data = trialSchema.parse(input);
  if ((data.trialStartsAt === null) !== (data.trialEndsAt === null)) {
    return { ok: false as const, error: "Set both a start and end date, or clear both." };
  }
  if (data.trialStartsAt && data.trialEndsAt && data.trialStartsAt > data.trialEndsAt) {
    return { ok: false as const, error: "Trial end date must be on or after the start date." };
  }
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .update(enrollments)
      .set({ trialStartsAt: data.trialStartsAt, trialEndsAt: data.trialEndsAt })
      .where(
        and(
          eq(enrollments.classId, data.classId),
          eq(enrollments.studentId, data.studentId),
        ),
      ),
  );
  revalidatePath("/admin/trials");
  revalidatePath(`/admin/classes/${data.classId}`);
  return { ok: true as const };
}
```

- [ ] **Step 2: Add `getTrials` to `src/app/admin/_lib/queries.ts`**

Select active-enrollment trials (`trial_ends_at IS NOT NULL AND withdrawn_at IS NULL`) joined to `profiles` (student), `classes`, `subjects`, and the tutor profile, returning: studentId, student name, classId, class name, subject name, tutor name, trialStartsAt, trialEndsAt. Order by `trial_ends_at asc`. Follow the join/`alias` style already used in `queries.ts` (e.g. `getDiscontinuedStudents`). The page derives status/grouping with `deriveTrialStatus`/`isEndingSoon`; do not compute grouping in SQL.

- [ ] **Step 3: Add trial fields to the tutor's scoped selects in `src/app/tutor/_data.ts`**

In `getTutorStudents` (aggregates a student across the tutor's classes): add `trialStartsAt`/`trialEndsAt`. Because a student may be in several of the tutor's classes, surface the trial from the enrollment with the latest `trial_ends_at` (a student "on trial" in any of this tutor's classes reads as on trial in the list); document this choice in a comment.
In `getStudentProfile` and the attendance/lesson roster query (`getLessonForTutor`'s roster select, and the class-roster page query in `src/app/tutor/classes/[id]/students/page.tsx`): these are per-class, so return the enrollment's own `trialStartsAt`/`trialEndsAt` directly.
Do not add trial fields to any student-facing or parent-facing query.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/_lib/actions-enrollments.ts src/app/admin/_lib/queries.ts src/app/tutor/_data.ts
git commit -m "feat(free-trials): setTrialDates action, getTrials, tutor-scoped trial fields"
```

---

## Task 4: Admin UI (enrollment control + trials view + nav)

**Files:**
- Modify: `src/app/admin/classes/[id]/_components/enrollments-manager.tsx`
- Create: `src/app/admin/trials/page.tsx`, `src/app/admin/trials/_components/trial-actions.tsx`
- Modify: `src/components/admin/shell.tsx` (nav)

**Interfaces:**
- Consumes: `setTrialDates`, `withdrawStudent` (existing), `getTrials` (Task 3); `deriveTrialStatus`/`isEndingSoon` (Task 2); admin UI primitives (`Pill`, `Button` from `@/components/admin/ui`).

- [ ] **Step 1: Load the ui-ux-pro-max skill and run the UI through its ruleset.**

- [ ] **Step 2: Trial control in the enrollments manager**

For each enrolled student, add (next to the delivery-mode select) two `type="date"` inputs (start, end) plus a "Set trial" action that calls `setTrialDates`, a "Clear" action that calls it with both null, and a status pill (`deriveTrialStatus` against today) - "On trial" / "Trial ended". The page passes today as a prop (compute `new Date().toISOString().slice(0,10)` in the server page) so the client component stays pure. Show the action error inline (the manager already has an `error` slot). Enrolled-student rows need `trialStartsAt`/`trialEndsAt` in their props (add to the class page's enrolled-students query).

- [ ] **Step 3: `/admin/trials` worklist**

`page.tsx` (server, `requireAdmin`): load `getTrials()`, compute each row's status + ending-soon with the pure helpers against today, group into Active (ending soon first) / Ended, render a table per group (student, class + subject, tutor, start/end, status pill). Empty state when there are no trials. `trial-actions.tsx` (client): per-row "Convert to regular" (`setTrialDates` both null, with a confirm) and "Withdraw" (`withdrawStudent`, with a confirm), plus a link to `/admin/classes/[classId]`. Reuse admin UI primitives and existing table styling; no new visual system.

- [ ] **Step 4: Nav entry**

In `src/components/admin/shell.tsx`, add `{ label: "Trials", href: "/admin/trials", icon: <Sparkles className={IC} /> }` (import `Sparkles` from lucide-react) in the nav list near "Classes"/"Attendance".

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. Wait for the build to exit 0; do not background it.

- [ ] **Step 6: Update the checklist and commit**

Set the "Free-trial tracking" row: FE 🔶, BE 🔶 (still partial until the tutor badges land); name the routes/files + date. Commit code + checklist together:

```bash
git add src/app/admin docs/checklist.md src/components/admin/shell.tsx
git commit -m "feat(free-trials): admin trial control + /admin/trials worklist"
```

---

## Task 5: Tutor badges

**Files:**
- Create: `src/components/tutor/trial-badge.tsx`
- Modify: `src/app/tutor/students/page.tsx`, `src/app/tutor/students/[id]/page.tsx`, `src/app/tutor/classes/[id]/students/page.tsx`, `src/app/tutor/attendance/page.tsx`

**Interfaces:**
- Consumes: `deriveTrialStatus` (Task 2); the trial fields added to the tutor queries (Task 3).

- [ ] **Step 1: Load the ui-ux-pro-max skill and run the UI through its ruleset.**

- [ ] **Step 2: `TrialBadge`**

Create `src/components/tutor/trial-badge.tsx`: a server-safe component taking `{ trialStartsAt: string | null; trialEndsAt: string | null; today: string }`, computing `deriveTrialStatus`, rendering nothing for `none`, a neutral-info pill "On trial" for `on_trial`, and a muted/warn pill "Trial ended" for `trial_ended`. Reuse the tutor/student pill styling already in these pages; do not introduce a new token.

- [ ] **Step 3: Drop the badge into the four surfaces**

In each page, compute `today` once (`new Date().toISOString().slice(0,10)`) in the server component and render `<TrialBadge .../>` next to the student's name using the `trialStartsAt`/`trialEndsAt` now present on each row. Keep layout consistent with the existing name/row styling.

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS (wait for exit 0).

- [ ] **Step 5: Update the checklist and commit**

Set the "Free-trial tracking" row BE ✅ (machine-verified) / FE 🔶. Commit:

```bash
git add src/components/tutor/trial-badge.tsx src/app/tutor docs/checklist.md
git commit -m "feat(free-trials): tutor On trial / Trial ended badges"
```

---

## Task 6: Documentation

**Files:**
- Create: `docs/changes/2026-07-29-free-trials.md`
- Modify: `docs/checklist.md`

- [ ] **Step 1: Write the change doc**

Record: the two `enrollments` columns + migration 0030, the pure status model (on_trial/trial_ended, ending-soon), `setTrialDates` (validation + `withActor` audit), the `/admin/trials` worklist and convert-to-regular/withdraw actions, the tutor badge surfaces, the tutor/admin-only visibility (never student/parent), and the deferred [INFRA] auto-notifications with the trials "ended" bucket as their non-scheduler substitute.

- [ ] **Step 2: Finalize the checklist row**

Ensure the "Free-trial tracking" row reflects reality: BE ✅ (migration applied + db:check-rls + typecheck + tests + build green), FE 🔶 until owner browser QA; Notes name the routes/files + date 2026-07-29 and the deferred [INFRA] pieces.

- [ ] **Step 3: Commit**

```bash
git add docs/changes/2026-07-29-free-trials.md docs/checklist.md
git commit -m "docs(free-trials): change record + checklist"
```

---

## Self-Review Notes

- Spec coverage: data model (Task 1); pure status incl. ending-soon (Task 2); action + queries + tutor-scoped fields (Task 3); admin control + worklist + convert/withdraw (Task 4); tutor visibility (Task 5); deferred-notification note + docs (Task 6). All spec sections map to a task.
- Type consistency: `deriveTrialStatus`/`isEndingSoon`/`TrialStatus` defined in Task 2 and consumed in Tasks 4/5; `trialStartsAt`/`trialEndsAt` defined in Task 1 and threaded through Tasks 3/4/5; `setTrialDates`/`getTrials` defined in Task 3 and consumed in Task 4.
- Deploy-ready guards: admin-only + validated + audited action (Task 3); trial status never in student/parent queries (Tasks 3/5); check constraint enforces both-or-neither at the DB (Task 1).
- Access risk to watch in review: every tutor query that gains trial fields must remain `classes.tutorId`-scoped so a tutor cannot see trial status for a student they do not teach.
