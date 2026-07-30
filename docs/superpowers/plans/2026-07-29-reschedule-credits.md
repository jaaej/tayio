# Reschedule / Cancellation Credits + Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-serve lesson cancellation with a class credit, per-term caps on cancellation and reschedule, a 7-day reschedule notice gate, and self-serve credit redemption, retiring the self-serve reschedule approval path.

**Architecture:** A pure, unit-tested logic module (`src/lib/reschedule-credits.ts`) holds the term resolution, notice gates, and lazy credit-expiry derivation. Two new tables (`class_credits`, `lesson_cancellations`) and their server-only DB layer (`src/lib/credits.ts`) sit alongside the existing reschedule primitives in `src/lib/reschedule.ts`, which is lightly reworked. Server actions gate every self-serve action by role and ownership; the student/parent timetable UIs gain Cancel + credit affordances; admin gains read-only credit/usage visibility.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), React 19, Drizzle ORM over Postgres, Supabase auth + RLS, Tailwind v4, Zod, vitest, lucide-react.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-29-reschedule-credits-design.md`.
- Never use the em dash "-"; use a plain dash.
- NEVER run `drizzle-kit push` / `db:generate` (wipes all RLS). Apply the raw SQL migration with `node scripts/apply-sql.mjs supabase/migrations/0031_reschedule_credits.sql`, then verify with `npm run db:check-rls`.
- Migration number is **0031** (next free; the live DB already has 0028/0029/0030 from held branches, which are absent as files on this branch - do not renumber).
- New tables get RLS enabled with **no** client policies (deny-by-default; all access is server-side Drizzle as the postgres role, which bypasses RLS), matching every other table.
- Notice gates and caps: cancel >= 24h notice and max 3/term; reschedule >= 7 days notice (group and one-on-one alike) and max 3/term, counted separately. The term is the one whose inclusive date range contains the original lesson's date.
- Self-serve = actor is `student_unrestricted` on their own lesson, or a `parent` linked to the student. Admin-initiated actions are uncapped, ungated, and never counted.
- Restricted students never see or reach any of this.
- Redeeming a credit consumes neither cap.
- Credit expiry is derived lazily at read time (no scheduled job).
- Follow the `ui-ux-pro-max:ui-ux-pro-max` ruleset for every UI change.
- Update `docs/checklist.md` and `docs/security-checklist.md` in the same change; FE rows stay partial (browser-QA-pending) until the owner clicks through; BE rows go done only when machine-verified.
- Values (magic numbers, enum strings, signatures) in this plan are authoritative; copy them verbatim.

---

## File Structure

**New files**
- `src/lib/reschedule-credits.ts` - pure logic: constants, `resolveTerm`, notice gates, `remaining`, `deriveCreditStatus`. No db/server-only imports.
- `src/lib/reschedule-credits.test.ts` - vitest unit tests for the above.
- `src/lib/credits.ts` - server-only DB layer: term lookup, counts, grant, cancel primitive, redemption slot listing + booking, admin overview.
- `src/app/_actions/credits.ts` - server actions: `cancelLesson`, `redeemCredit`, `loadCreditRedemption`.
- `src/components/reschedule/credit-panel.tsx` - shared student+parent credit balance + redeem UI (client).
- `supabase/migrations/0031_reschedule_credits.sql` - two enums, two tables, indexes, RLS enable.
- `docs/changes/2026-07-29-reschedule-credits.md` - change doc + browser-QA checklist.

**Modified files**
- `src/db/schema.ts` - add the two enums, two tables, and their inferred types.
- `src/lib/reschedule.ts` - export `markStudentAbsent`, `studentDisplayName`, `getAdminIds`, `notifyReschedule` helpers for reuse; add `hasSlots` awareness is not needed here.
- `src/app/_actions/reschedule.ts` - rework `submitReschedule` (7-day gate + cap + no-slot->credit + retire approval) and `loadRescheduleOptions` (return `hasSlots`).
- `src/app/student/_components/interactive-timetable.tsx` + `src/app/student/timetable/page.tsx` - per-lesson Cancel + Reschedule eligibility, allowance labels, gate/office states, credit panel.
- `src/app/parent/classes/reschedule/[lessonId]/page.tsx` + `src/components/reschedule/reschedule-form.tsx` + `src/app/parent/classes/page.tsx` - same for parents.
- `src/app/admin/reschedules/page.tsx` + `src/app/admin/_lib/queries.ts` - read-only credits + per-term usage.

---

## Task 1: Pure limit + credit logic (`src/lib/reschedule-credits.ts`)

**Files:**
- Create: `src/lib/reschedule-credits.ts`
- Test: `src/lib/reschedule-credits.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3-8):
  - `CANCEL_NOTICE_HOURS = 24`, `RESCHEDULE_NOTICE_DAYS = 7`, `CANCEL_CAP = 3`, `RESCHEDULE_CAP = 3`
  - `type TermRow = { id: string; startDate: string; endDate: string }`
  - `type CreditStatus = "active" | "redeemed" | "expired"`
  - `resolveTerm(dateIso: string, terms: TermRow[]): TermRow | null`
  - `meetsCancelNotice(now: Date, date: string, startTime: string): boolean`
  - `meetsRescheduleNotice(now: Date, date: string, startTime: string): boolean`
  - `remaining(cap: number, used: number): number`
  - `deriveCreditStatus(stored: CreditStatus, expiresAt: string, todayIso: string): CreditStatus`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/reschedule-credits.test.ts
import { describe, it, expect } from "vitest";
import {
  resolveTerm,
  meetsCancelNotice,
  meetsRescheduleNotice,
  remaining,
  deriveCreditStatus,
  type TermRow,
} from "./reschedule-credits";

const terms: TermRow[] = [
  { id: "t1", startDate: "2026-07-20", endDate: "2026-09-25" },
  { id: "t2", startDate: "2026-10-12", endDate: "2026-12-18" },
];

describe("resolveTerm", () => {
  it("matches a date inside a term", () => {
    expect(resolveTerm("2026-08-01", terms)?.id).toBe("t1");
  });
  it("is inclusive of both boundaries", () => {
    expect(resolveTerm("2026-07-20", terms)?.id).toBe("t1");
    expect(resolveTerm("2026-09-25", terms)?.id).toBe("t1");
  });
  it("returns null between/outside terms", () => {
    expect(resolveTerm("2026-10-01", terms)).toBeNull();
    expect(resolveTerm("2026-01-01", terms)).toBeNull();
  });
});

describe("notice gates", () => {
  const now = new Date("2026-08-01T09:00:00");
  it("cancel needs at least 24h notice", () => {
    expect(meetsCancelNotice(now, "2026-08-02", "10:00:00")).toBe(true); // 25h
    expect(meetsCancelNotice(now, "2026-08-02", "09:00:00")).toBe(true); // exactly 24h
    expect(meetsCancelNotice(now, "2026-08-02", "08:00:00")).toBe(false); // 23h
  });
  it("reschedule needs at least 7 days notice", () => {
    expect(meetsRescheduleNotice(now, "2026-08-08", "09:00:00")).toBe(true); // exactly 7d
    expect(meetsRescheduleNotice(now, "2026-08-09", "09:00:00")).toBe(true); // 8d
    expect(meetsRescheduleNotice(now, "2026-08-07", "09:00:00")).toBe(false); // 6d
  });
});

describe("remaining", () => {
  it("never goes negative", () => {
    expect(remaining(3, 1)).toBe(2);
    expect(remaining(3, 3)).toBe(0);
    expect(remaining(3, 5)).toBe(0);
  });
});

describe("deriveCreditStatus", () => {
  it("redeemed is terminal", () => {
    expect(deriveCreditStatus("redeemed", "2026-09-25", "2026-10-01")).toBe("redeemed");
  });
  it("active before expiry, inclusive of the expiry day", () => {
    expect(deriveCreditStatus("active", "2026-09-25", "2026-09-01")).toBe("active");
    expect(deriveCreditStatus("active", "2026-09-25", "2026-09-25")).toBe("active");
  });
  it("expired after the expiry day", () => {
    expect(deriveCreditStatus("active", "2026-09-25", "2026-09-26")).toBe("expired");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reschedule-credits.test.ts`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/reschedule-credits.ts
/**
 * Pure limit + credit logic for the self-serve reschedule/cancellation feature.
 * No database or server-only imports so it is fully unit-testable. See
 * docs/superpowers/specs/2026-07-29-reschedule-credits-design.md.
 */

export const CANCEL_NOTICE_HOURS = 24;
export const RESCHEDULE_NOTICE_DAYS = 7;
export const CANCEL_CAP = 3;
export const RESCHEDULE_CAP = 3;

export type TermRow = { id: string; startDate: string; endDate: string };
export type CreditStatus = "active" | "redeemed" | "expired";

/** The term whose inclusive [startDate, endDate] range contains `dateIso`
 *  (YYYY-MM-DD), or null if the date falls in no defined term. */
export function resolveTerm(dateIso: string, terms: TermRow[]): TermRow | null {
  return terms.find((t) => t.startDate <= dateIso && dateIso <= t.endDate) ?? null;
}

/** Milliseconds from `now` to the local lesson start (date + HH:MM:SS). */
function msUntilLessonStart(now: Date, date: string, startTime: string): number {
  return new Date(`${date}T${startTime}`).getTime() - now.getTime();
}

/** At least 24h before the lesson start. */
export function meetsCancelNotice(now: Date, date: string, startTime: string): boolean {
  return msUntilLessonStart(now, date, startTime) >= CANCEL_NOTICE_HOURS * 3_600_000;
}

/** At least 7 days before the lesson start. */
export function meetsRescheduleNotice(now: Date, date: string, startTime: string): boolean {
  return msUntilLessonStart(now, date, startTime) >= RESCHEDULE_NOTICE_DAYS * 24 * 3_600_000;
}

/** Remaining allowance, never negative. */
export function remaining(cap: number, used: number): number {
  return Math.max(0, cap - used);
}

/** Effective status, deriving expiry lazily. A credit is still active on its
 *  expiry day (today === expiresAt); redeemed is terminal. */
export function deriveCreditStatus(
  stored: CreditStatus,
  expiresAt: string,
  todayIso: string,
): CreditStatus {
  if (stored === "redeemed") return "redeemed";
  if (todayIso > expiresAt) return "expired";
  return "active";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reschedule-credits.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reschedule-credits.ts src/lib/reschedule-credits.test.ts
git commit -m "feat(reschedule-credits): pure limit + credit logic with unit tests"
```

---

## Task 2: Schema + migration (`class_credits`, `lesson_cancellations`)

**Files:**
- Modify: `src/db/schema.ts` (add enums + tables after the `rescheduleRequests` type export near line 299; references use lazy arrows so declaration order does not matter)
- Create: `supabase/migrations/0031_reschedule_credits.sql`

**Interfaces:**
- Produces: `classCredits`, `lessonCancellations` Drizzle tables; `creditGrantReasonEnum`, `creditStatusEnum`; types `ClassCredit`, `LessonCancellation`.

- [ ] **Step 1: Add enums + tables to `src/db/schema.ts`**

```ts
export const creditGrantReasonEnum = pgEnum("credit_grant_reason", [
  "cancellation",
  "reschedule_no_slot",
]);
export const creditStatusEnum = pgEnum("credit_status", [
  "active",
  "redeemed",
  "expired",
]);

export const classCredits = pgTable(
  "class_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
    grantReason: creditGrantReasonEnum("grant_reason").notNull(),
    grantedFromLessonId: uuid("granted_from_lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    grantedById: uuid("granted_by_id").notNull().references(() => profiles.id),
    status: creditStatusEnum("status").notNull().default("active"),
    redeemedOnLessonId: uuid("redeemed_on_lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    redeemedById: uuid("redeemed_by_id").references(() => profiles.id),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    expiresAt: date("expires_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("class_credits_student_status_idx").on(t.studentId, t.status),
    index("class_credits_term_idx").on(t.termId),
  ],
);
export type ClassCredit = typeof classCredits.$inferSelect;

export const lessonCancellations = pgTable(
  "lesson_cancellations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    cancelledById: uuid("cancelled_by_id").notNull().references(() => profiles.id),
    termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
    creditId: uuid("credit_id").references(() => classCredits.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lesson_cancellations_student_term_idx").on(t.studentId, t.termId)],
);
export type LessonCancellation = typeof lessonCancellations.$inferSelect;
```

- [ ] **Step 2: Create the migration file**

```sql
-- supabase/migrations/0031_reschedule_credits.sql
-- Class credits + lesson cancellations for the self-serve reschedule/cancellation
-- limits feature. Additive, non-destructive. RLS enabled with no client policies:
-- all access is server-side Drizzle as the postgres role (bypasses RLS);
-- deny-by-default for anon/authenticated, matching every other table.
--
-- Reversible by:
--   DROP TABLE public.lesson_cancellations;
--   DROP TABLE public.class_credits;
--   DROP TYPE public.credit_status;
--   DROP TYPE public.credit_grant_reason;

begin;

do $$ begin
  create type public.credit_grant_reason as enum ('cancellation', 'reschedule_no_slot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.credit_status as enum ('active', 'redeemed', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists public.class_credits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  grant_reason public.credit_grant_reason not null,
  granted_from_lesson_id uuid references public.lessons(id) on delete set null,
  granted_by_id uuid not null references public.profiles(id),
  status public.credit_status not null default 'active',
  redeemed_on_lesson_id uuid references public.lessons(id) on delete set null,
  redeemed_by_id uuid references public.profiles(id),
  redeemed_at timestamptz,
  expires_at date not null,
  created_at timestamptz not null default now()
);

create index if not exists class_credits_student_status_idx
  on public.class_credits(student_id, status);
create index if not exists class_credits_term_idx
  on public.class_credits(term_id);

alter table public.class_credits enable row level security;

create table if not exists public.lesson_cancellations (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  cancelled_by_id uuid not null references public.profiles(id),
  term_id uuid not null references public.terms(id) on delete cascade,
  credit_id uuid references public.class_credits(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists lesson_cancellations_student_term_idx
  on public.lesson_cancellations(student_id, term_id);

alter table public.lesson_cancellations enable row level security;

commit;
```

- [ ] **Step 3: Apply and verify**

Run:
```bash
node scripts/apply-sql.mjs supabase/migrations/0031_reschedule_credits.sql
npm run db:check-rls
npx tsc --noEmit
```
Expected: migration applies cleanly; `db:check-rls` reports both new tables RLS-enabled with no policies and no regressions; typecheck passes.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts supabase/migrations/0031_reschedule_credits.sql
git commit -m "feat(reschedule-credits): class_credits + lesson_cancellations tables + migration 0031"
```

---

## Task 3: Credit-grant + cancellation server layer (`src/lib/credits.ts`)

**Files:**
- Modify: `src/lib/reschedule.ts` (export the reused helpers)
- Create: `src/lib/credits.ts`

**Interfaces:**
- Consumes: pure fns from Task 1; tables from Task 2; from `src/lib/reschedule.ts` the (now exported) `markStudentAbsent(lessonId, studentId, reason, actorId)`, `studentDisplayName(studentId)`, `getAdminIds()`.
- Produces (consumed by Tasks 4, 5, 6, 7, 8):
  - `getTerms(): Promise<TermRow[]>` (all terms, for `resolveTerm`)
  - `getCancellationsUsed(studentId, termId): Promise<number>`
  - `getReschedulesUsed(studentId, termId): Promise<number>` (self-serve reschedule_requests in that term + `reschedule_no_slot` credits in that term)
  - `grantCredit(p: { studentId; subjectId; termId; reason: "cancellation" | "reschedule_no_slot"; fromLessonId; grantedById; expiresAt }): Promise<string>` (returns credit id)
  - `cancelLesson(p: { studentId; lessonId; reason: string; actorId: string }): Promise<{ ok: true; creditId: string } | { ok: false; error: string }>`

- [ ] **Step 1: Export the reused helpers from `src/lib/reschedule.ts`**

Rename the private `markAbsentOnOriginal` to an exported `markStudentAbsent` (same body/signature), and add `export` to `studentName` (renamed `studentDisplayName`) and `adminIds` (renamed `getAdminIds`). Update their internal call sites in the same file. This is a mechanical export-widening; do not change behaviour.

- [ ] **Step 2: Write `src/lib/credits.ts`**

Key behaviours (server-only, `import "server-only"`):

- `getTerms` selects `{ id, startDate, endDate }` from `terms`.
- `getCancellationsUsed` = `count(*)` from `lesson_cancellations` where `studentId` and `termId` match.
- `getReschedulesUsed` = (count of self-serve `reschedule_requests` whose original lesson falls in the term) + (count of `class_credits` with `grantReason = 'reschedule_no_slot'`, `studentId`, `termId`). "Self-serve" excludes rows whose `requestedById` profile has an admin-family role: join `profiles` on `requestedById` and filter `role` NOT IN the admin tiers (`ADMIN_TIERS`). Resolve the term of a reschedule by joining `lessons` on `originalLessonId` and comparing `lessons.date` to the term's `[startDate, endDate]`.
- `grantCredit` inserts one `class_credits` row and returns its id.
- `cancelLesson`: load the lesson + its class `subjectId`; if not found -> error. Resolve the term via `resolveTerm(lesson.date, await getTerms())`; if null -> `{ ok: false, error: "That lesson is outside a known term - message the office." }`. Re-check the 24h gate with `meetsCancelNotice` and the cap with `getCancellationsUsed < CANCEL_CAP` (defensive; the action also checks) -> error strings on failure. Then, sequentially: `markStudentAbsent(lessonId, studentId, reason, actorId)`, `grantCredit({... reason: "cancellation", expiresAt: term.endDate})`, insert a `lesson_cancellations` row linking the credit id, and notify tutor + linked parents + admins (reuse the notification row shape from `notifyReschedule`; title "Lesson cancelled", body naming the student, subject, date). Return `{ ok: true, creditId }`.

Provide the full function bodies in the implementation, following the existing query style in `src/lib/reschedule.ts` (Drizzle `db.select`/`db.insert`, `sql<number>\`count(*)::int\``, `inArray(profiles.role, ADMIN_TIERS)`).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: passes. (These are DB functions; correctness is exercised by Tasks 4-7 and owner QA. No new unit test here.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/reschedule.ts src/lib/credits.ts
git commit -m "feat(reschedule-credits): credit grant + cancellation server layer"
```

---

## Task 4: Reschedule rework (7-day gate, cap, no-slot -> credit, retire approval)

**Files:**
- Modify: `src/app/_actions/reschedule.ts`
- Modify: `src/lib/reschedule.ts` (only if a small helper is needed; prefer no change)

**Interfaces:**
- Consumes: Task 1 gates/caps, Task 3 `getTerms`/`getReschedulesUsed`/`grantCredit`, existing `getOneOnOneSlots`, `executeMakeupReschedule`, `recordDirectMakeup`, `markStudentAbsent`.
- Produces (consumed by Tasks 6, 7): reworked `loadRescheduleOptions` returning `{ ok, hasSlots, slots, lesson }` (drop `approvalRequired`/`secondReschedule`); reworked `submitReschedule(formData)`; new `grantRescheduleCredit(formData)` action for the no-slot path.

- [ ] **Step 1: Rework `submitReschedule`**

Replace the routing so that after resolving the student + lesson ownership and the "already started" check:
1. Resolve the term via `resolveTerm(original.date, await getTerms())`. If null -> `{ ok: false, error: "That lesson is outside a known term - message the office." }`.
2. If `!meetsRescheduleNotice(now, original.date, original.startTime)` -> `{ ok: false, error: "Reschedules need at least 7 days notice - message the office." }`.
3. If `remaining(RESCHEDULE_CAP, await getReschedulesUsed(studentId, term.id)) <= 0` -> `{ ok: false, error: "You have used all 3 reschedules this term - message the office." }`.
4. Validate the chosen slot against `getOneOnOneSlots` (as today), then execute directly via `executeMakeupReschedule` + `recordDirectMakeup`. Remove the `reschedulePath`/`createRescheduleRequest`/`hasPriorReschedule` approval branch from this action.

- [ ] **Step 2: Add `grantRescheduleCredit(formData)`**

For the "no slot available" path (the UI offers this when `hasSlots` is false): re-run the same gate + cap checks, then `markStudentAbsent(lessonId, studentId, reason, actorId)` and `grantCredit({ reason: "reschedule_no_slot", subjectId: original.subjectId, termId: term.id, fromLessonId: lessonId, grantedById: user.id, expiresAt: term.endDate })`. Notify. Return `{ ok: true, message: "Class credit added." }`. This counts as one reschedule via the credit row.

- [ ] **Step 3: Rework `loadRescheduleOptions`**

Return `hasSlots: slots.length > 0` and drop `approvalRequired`/`secondReschedule`. Keep returning `slots` + `lesson`. (Per-lesson notice/cap eligibility is computed by the page data layer in Tasks 6/7, not here.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass. Fix any now-unused imports YOUR change orphaned (e.g. `reschedulePath`, `createRescheduleRequest`, `hasPriorReschedule` if no longer referenced in this file - leave them exported from `src/lib/reschedule.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/app/_actions/reschedule.ts src/lib/reschedule.ts
git commit -m "feat(reschedule-credits): 7-day gate + per-term cap + no-slot credit; retire self-serve approval"
```

---

## Task 5: Redemption server layer + actions (`src/lib/credits.ts`, `src/app/_actions/credits.ts`)

**Files:**
- Modify: `src/lib/credits.ts`
- Create: `src/app/_actions/credits.ts`

**Interfaces:**
- Consumes: Task 1 `deriveCreditStatus`; existing `expandAvailability` (`src/lib/availability.ts`), `executeMakeupReschedule` pattern; Task 3 helpers.
- Produces (consumed by Tasks 6, 7, 8):
  - lib: `listRedeemableCredits(studentId): Promise<RedeemableCredit[]>` where `RedeemableCredit = { id; subjectName; expiresAt; grantReason }` (only credits whose `deriveCreditStatus(...today) === "active"`).
  - lib: `getRedemptionSlots(creditId, holderId): Promise<{ ok: true; slots: AvailableSlot[] } | { ok: false; error }>` - same-tutor availability slots from the credit's origin lesson tutor.
  - lib: `redeemCreditIntoSlot(p: { creditId; holderId; actorId; tutorId; date; startTime; endTime }): Promise<{ ok: true } | { ok: false; error }>` - double-booking guard, create makeup lesson on the origin class, add `makeup_attended` attendance, set credit `status='redeemed'` + `redeemedOnLessonId`/`redeemedById`/`redeemedAt`; notify.
  - actions: `cancelLesson(formData)`, `redeemCredit(formData)`, `loadCreditRedemption(creditId, studentIdArg?)`.

- [ ] **Step 1: Redemption lib functions in `src/lib/credits.ts`**

`listRedeemableCredits` selects the student's `active` credits joined to `subjects.name`, then filters in JS with `deriveCreditStatus(row.status, row.expiresAt, isoDate(new Date()))=== "active"`. `getRedemptionSlots` loads the credit -> its `grantedFromLessonId` -> lesson tutor + class, and returns `expandAvailability([{ id: tutorId, ... , isOriginal: true }], now, 4)`. `redeemCreditIntoSlot` mirrors `executeMakeupReschedule` minus the "mark original absent"/supersede steps (the missed lesson was already accounted for at grant time): guard the tutor slot is free, insert a `makeup` lesson on the credit's origin `classId` + tutor + slot, insert `makeup_attended` attendance for the student, update the credit row to redeemed, and notify tutor + parents + admins. Opportunistically flip any `active` credit found past its `expiresAt` to `expired` on read (best-effort update, correctness not dependent on it).

- [ ] **Step 2: Actions in `src/app/_actions/credits.ts`**

`"use server"`. Each action: `requireRole(["student_unrestricted", "parent"])`, resolve the student the same way `reschedule.ts` does (`resolveStudent` pattern - a parent must be linked; a student acts on self), verify ownership (the lesson for cancel via `studentOwnsLesson`; the credit's `studentId` must equal the resolved student for redeem), then call the lib function. `revalidatePath` the student + parent + admin surfaces (`/student/timetable`, `/parent/classes`, `/admin/reschedules`). `cancelLesson` also re-checks the 24h gate + cap before calling the lib (return the same office-routing error strings as the lib). `loadCreditRedemption` returns `{ ok, credit: {subjectName, expiresAt}, slots }`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/credits.ts src/app/_actions/credits.ts
git commit -m "feat(reschedule-credits): credit redemption server layer + cancel/redeem actions"
```

---

## Task 6: Student UI (Cancel + allowances + credit panel)

**Files:**
- Create: `src/components/reschedule/credit-panel.tsx`
- Modify: `src/app/student/timetable/page.tsx`, `src/app/student/_components/interactive-timetable.tsx`

**Interfaces:**
- Consumes: Task 3/5 lib functions, Task 4 `loadRescheduleOptions`/`grantRescheduleCredit`, actions `cancelLesson`/`redeemCredit`/`loadCreditRedemption`.
- Produces: reusable `<CreditPanel>` for Task 7.

**Load and follow the `ui-ux-pro-max:ui-ux-pro-max` skill before writing UI.**

- [ ] **Step 1: Data layer in `page.tsx`**

For the signed-in unrestricted student (restricted students already never mount the interactive timetable), compute per upcoming lesson: `canCancel` (`meetsCancelNotice` and cap not reached and lesson in a term) and `canReschedule` (`meetsRescheduleNotice` and cap not reached and in a term), plus the term's `cancelRemaining`/`rescheduleRemaining`, and `listRedeemableCredits`. Pass these into the client component and the new `<CreditPanel>`. Also pass the existing admin-contact link for the office-routing states.

- [ ] **Step 2: `credit-panel.tsx` (client)**

Renders active credits (subject + "expires <date>") and, per credit, a "Use credit" button that calls `loadCreditRedemption` then shows the same-tutor slot picker (reuse the slot-picker shape already in `interactive-timetable.tsx`), submitting `redeemCredit`. Empty state: nothing shown when there are no active credits. Calm status styling (semantic color, not color-only; single primary action per credit).

- [ ] **Step 3: Timetable menu (`interactive-timetable.tsx`)**

Extend the per-lesson action menu (the existing `Mode` state machine) so an eligible lesson offers **Reschedule** and **Cancel**. Each shows its remaining allowance ("2 of 3 left"). When `canReschedule`/`canCancel` is false, replace that action with the "Message the office" link. In the reschedule picker, when `loadRescheduleOptions` returns `hasSlots === false`, offer "Get a class credit instead" -> `grantRescheduleCredit`. Cancel opens a confirm ("This uses 1 of your 3 term cancellations and adds a class credit.") -> `cancelLesson`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass. Run through the `ui-ux-pro-max` checklist (touch targets, primary-action singularity, contrast, reduced-motion on any transition). Note in the report that browser QA is owner-pending.

- [ ] **Step 5: Commit**

```bash
git add src/components/reschedule/credit-panel.tsx src/app/student/timetable/page.tsx src/app/student/_components/interactive-timetable.tsx
git commit -m "feat(reschedule-credits): student cancel + allowances + credit redemption UI"
```

---

## Task 7: Parent UI (Cancel + allowances + credit panel)

**Files:**
- Modify: `src/app/parent/classes/reschedule/[lessonId]/page.tsx`, `src/components/reschedule/reschedule-form.tsx`, `src/app/parent/classes/page.tsx`

**Interfaces:**
- Consumes: everything from Task 6 including the shared `<CreditPanel>` (pass the child's `studentId` through).

**Load and follow the `ui-ux-pro-max:ui-ux-pro-max` skill before writing UI.**

- [ ] **Step 1: Parent data layer**

Mirror Task 6 for the parent acting on a linked child: compute per-lesson `canCancel`/`canReschedule`, term allowances, and `listRedeemableCredits(childId)`. The parent flows already pass `studentId`; thread it into `cancelLesson`/`redeemCredit`/`grantRescheduleCredit`.

- [ ] **Step 2: Reschedule form + classes page**

Add the Cancel action + allowance labels + no-slot "Get a class credit instead" branch to `reschedule-form.tsx`. Mount `<CreditPanel studentId={childId}>` on the parent classes view. Office-routing states reuse `getAdminContact`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass. Run the `ui-ux-pro-max` checklist; note browser QA owner-pending.

- [ ] **Step 4: Commit**

```bash
git add src/app/parent/classes/reschedule/[lessonId]/page.tsx src/components/reschedule/reschedule-form.tsx src/app/parent/classes/page.tsx
git commit -m "feat(reschedule-credits): parent cancel + allowances + credit redemption UI"
```

---

## Task 8: Admin visibility (read-only credits + per-term usage)

**Files:**
- Modify: `src/app/admin/_lib/queries.ts`, `src/app/admin/reschedules/page.tsx`

**Interfaces:**
- Consumes: Task 2 tables, Task 1 `deriveCreditStatus`.
- Produces: `getCreditsOverview()` returning granted/redeemed/expired credits (with student, subject, reason, source + target lesson labels) and per-student per-term cancel/reschedule usage.

**Load and follow the `ui-ux-pro-max:ui-ux-pro-max` skill before writing UI.**

- [ ] **Step 1: `getCreditsOverview` in `queries.ts`**

Select `class_credits` joined to student + subject; derive effective status with `deriveCreditStatus`; include the source and (if any) redemption lesson labels. Also aggregate `lesson_cancellations` and self-serve reschedule counts per student per current term for a small usage table. Server-side; admin-only page already guards the route.

- [ ] **Step 2: Surface on `/admin/reschedules`**

Add a "Class credits" section (granted / redeemed / expired) and a compact "This term's usage" table under the existing reschedule content. Read-only; no grant/revoke controls (out of scope). Match the admin v2 UI kit already used on that page.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass. `ui-ux-pro-max` checklist; browser QA owner-pending.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/_lib/queries.ts src/app/admin/reschedules/page.tsx
git commit -m "feat(reschedule-credits): admin read-only credit + per-term usage visibility"
```

---

## Task 9: Docs + checklist + security-checklist

**Files:**
- Create: `docs/changes/2026-07-29-reschedule-credits.md`
- Modify: `docs/checklist.md` (rows 161, 247, 248, 249; note approval-queue dormancy), `docs/security-checklist.md` (new row for the two RLS tables)

- [ ] **Step 1: Change doc**

Write `docs/changes/2026-07-29-reschedule-credits.md`: what shipped, the retired self-serve approval path + why, the lazy-expiry design, and a **browser-QA checklist** covering student, parent, tutor (no self-serve queue entries now), and admin (credit visibility). One full sentence per line.

- [ ] **Step 2: Checklist rows**

Update `docs/checklist.md`:
- Row 161 (class token / makeup credit): mark BE done / FE partial with the new table + route names + date; note it is now `class_credits`, not `class_tokens`.
- Rows 247-249 (cancellation -> credit, reschedule -> credit when no slot, reschedule/cancellation limits): BE done / FE partial, name the files + migration 0031 + date, and record the resolved [DECISION] (7-day = notice deadline; windows govern self-serve; caps 3/3 per term; admin uncapped).
- Add a one-line note that the self-serve reschedule approval queue is now dormant (kept, not fed by self-serve).
FE stays partial (browser-QA-pending) per the checklist protocol.

- [ ] **Step 3: Security-checklist row**

Add a row for `class_credits` + `lesson_cancellations`: RLS enabled, no client policies, server-side Drizzle only, `db:check-rls` verified; status code-verified, owner browser confirmation pending.

- [ ] **Step 4: Verify + commit**

Run: `npm test && npx tsc --noEmit && npm run build && npm run db:check-rls`
Expected: all green.

```bash
git add docs/changes/2026-07-29-reschedule-credits.md docs/checklist.md docs/security-checklist.md
git commit -m "docs(reschedule-credits): change doc + checklist + security-checklist"
```

---

## Self-Review

**Spec coverage:** cancellation->credit (Tasks 3,5,6,7), reschedule->credit when no slot (Task 4), notice gates + caps (Tasks 1,3,4), 7-day = notice deadline (Task 1 `meetsRescheduleNotice`), lazy expiry (Task 1 `deriveCreditStatus`, Task 5 read-time), self-serve approval retired (Task 4), admin visibility (Task 8), RLS + migration 0031 (Task 2), docs (Task 9). All spec sections map to a task.

**Placeholder scan:** pure logic + schema + migration carry full code; DB/UI tasks carry exact signatures + per-branch behaviour + verify commands, consistent with how DB-heavy tasks are specified in this repo (no render/DB unit harness exists).

**Type consistency:** `TermRow`, `CreditStatus`, `grantReason` values (`cancellation`/`reschedule_no_slot`), status values (`active`/`redeemed`/`expired`), caps (3/3), and helper names (`markStudentAbsent`, `getAdminIds`, `studentDisplayName`, `getTerms`, `getReschedulesUsed`, `getCancellationsUsed`, `grantCredit`, `cancelLesson`, `listRedeemableCredits`, `getRedemptionSlots`, `redeemCreditIntoSlot`) are used identically across tasks.
