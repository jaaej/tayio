# Admin User Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/admin/users/[id]` as a tabbed record with a persistent summary rail, and replace its flat lesson list with the month calendar students already get, rescheduling inline instead of on a separate page.

**Architecture:** Phase 1 restructures the page into four `?tab=` routed panels plus a right rail; it is pure layout with no backend change. Phase 2 extracts the student month grid into a shared client component used by both portals, adds an admin lesson calendar with leave shading, and moves the existing slot picker into the shared side-panel slide-over. The reschedule server action already exists and is `requireAdmin` guarded; only its error reporting changes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Drizzle ORM, Zod, vitest.

## Global Constraints

- Never use the em dash character. Use a plain hyphen.
- No redundant subtitles or state narration. A heading that lists its own contents, or text that counts what the UI already shows, must not be added. See the microcopy rule in `CLAUDE.md`.
- Any surface shared across roles must look and behave the same in every role it appears in.
- `vitest.config.ts` sets `environment: "node"` and `include: ["src/**/*.test.ts"]`. There is no testing-library and no component test harness. Only pure TypeScript modules can be unit tested. UI correctness is verified by `npx tsc --noEmit`, `npm run build`, and a manual browser pass.
- Commit messages must not add a Co-Authored-By trailer.
- Update `docs/checklist.md` in the same commit as the code it describes.
- Verify before claiming: run the command and read the output. Never report a step as passing without it.

---

## File Structure

**Created**

- `src/lib/user-detail-tabs.ts` - pure tab identifiers and `?tab=` parsing. Testable, no React.
- `src/components/calendar/month-grid.tsx` - presentational month grid, client component, shared by student and admin.
- `src/app/admin/users/[id]/_components/user-tabs.tsx` - the tab bar.
- `src/app/admin/users/[id]/_components/at-a-glance.tsx` - read-only summary card for the rail.
- `src/app/admin/users/[id]/_components/lesson-calendar.tsx` - admin month calendar plus the reschedule panel.
- `src/lib/user-detail-tabs.test.ts` - tests for the tab parser.

**Modified**

- `src/app/admin/users/[id]/page.tsx` - restructured into header, tab panels and rail.
- `src/app/student/_components/month-calendar.tsx` - delegates its grid to the shared component.
- `src/app/admin/_lib/queries.ts` - adds a month-window lesson query.
- `src/app/admin/_lib/actions-reschedule.ts` - returns errors instead of redirecting.
- `docs/checklist.md` - status rows.

**Deleted**

- `src/app/admin/users/[id]/reschedule/[lessonId]/page.tsx`
- `src/app/admin/users/[id]/reschedule/[lessonId]/_components/slot-picker.tsx`

---

## Task 1: Tab identifiers and parsing

**Files:**
- Create: `src/lib/user-detail-tabs.ts`
- Test: `src/lib/user-detail-tabs.test.ts`

**Interfaces:**
- Consumes: `UserRole` and `coarseRole` from the existing `src/lib/roles.ts`.
- Produces: `type UserTab`, `tabsForRole(role: UserRole)`, `parseTabParam(value: string | undefined, role: UserRole): UserTab`.

Tab sets differ by role, because the sections differ by role.
A student has lessons, credits and reports; a tutor has neither, but has availability and payroll details; a parent or admin record has only a profile.

Parsing takes the role so a `?tab=` value that is valid for one role cannot render an empty panel on another.
`/admin/users/<a-tutor>?tab=credits` must fall back to Profile rather than showing a blank credits panel.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/user-detail-tabs.test.ts
import { describe, expect, it } from "vitest";
import { parseTabParam, tabsForRole } from "./user-detail-tabs";

describe("tabsForRole", () => {
  it("gives a student their learning record", () => {
    expect(tabsForRole("student_unrestricted").map((t) => t.key)).toEqual([
      "profile",
      "lessons",
      "credits",
      "reports",
    ]);
  });

  it("applies to every student tier", () => {
    expect(tabsForRole("student_restricted").map((t) => t.key)).toEqual(
      tabsForRole("student_unrestricted").map((t) => t.key),
    );
  });

  it("gives a tutor their own sections", () => {
    expect(tabsForRole("tutor").map((t) => t.key)).toEqual([
      "profile",
      "tutor",
      "availability",
    ]);
  });

  it("gives a parent or admin a profile only, so no tab bar renders", () => {
    expect(tabsForRole("parent")).toHaveLength(1);
    expect(tabsForRole("admin_unrestricted")).toHaveLength(1);
  });
});

describe("parseTabParam", () => {
  it("defaults to profile when the param is absent", () => {
    expect(parseTabParam(undefined, "student_unrestricted")).toBe("profile");
  });

  it("accepts a tab the role actually has", () => {
    expect(parseTabParam("credits", "student_unrestricted")).toBe("credits");
    expect(parseTabParam("availability", "tutor")).toBe("availability");
  });

  it("rejects a tab belonging to a different role", () => {
    // A stale link must not render an empty panel.
    expect(parseTabParam("credits", "tutor")).toBe("profile");
    expect(parseTabParam("availability", "student_unrestricted")).toBe("profile");
  });

  it("falls back to profile on an unknown value", () => {
    expect(parseTabParam("nonsense", "tutor")).toBe("profile");
    expect(parseTabParam("", "tutor")).toBe("profile");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/user-detail-tabs.test.ts`
Expected: FAIL, cannot resolve `./user-detail-tabs`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/user-detail-tabs.ts
import { coarseRole, type UserRole } from "./roles";

/**
 * Tabs on /admin/users/[id]. Pure so the tab bar, the page and the tests
 * agree on one list, and so an unknown or wrong-role ?tab= has one defined
 * fallback rather than an empty panel.
 */
export type UserTab =
  | "profile"
  | "lessons"
  | "credits"
  | "reports"
  | "tutor"
  | "availability";

type Tab = { key: UserTab; label: string };

const PROFILE: Tab = { key: "profile", label: "Profile" };

const STUDENT_TABS: ReadonlyArray<Tab> = [
  PROFILE,
  { key: "lessons", label: "Lessons & leave" },
  { key: "credits", label: "Credits & activity" },
  { key: "reports", label: "Term reports" },
];

const TUTOR_TABS: ReadonlyArray<Tab> = [
  PROFILE,
  { key: "tutor", label: "Tutor" },
  { key: "availability", label: "Availability" },
];

/** Sections this role's record actually has. One entry means no tab bar. */
export function tabsForRole(role: UserRole): ReadonlyArray<Tab> {
  const coarse = coarseRole(role);
  if (coarse === "student") return STUDENT_TABS;
  if (coarse === "tutor") return TUTOR_TABS;
  return [PROFILE];
}

export function parseTabParam(
  value: string | undefined,
  role: UserRole,
): UserTab {
  const hit = tabsForRole(role).find((tab) => tab.key === value);
  return hit ? hit.key : "profile";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/user-detail-tabs.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-detail-tabs.ts src/lib/user-detail-tabs.test.ts
git commit -m "feat(admin/users): tab identifiers and ?tab= parsing"
```

---

## Task 2: Tab bar component

**Files:**
- Create: `src/app/admin/users/[id]/_components/user-tabs.tsx`

**Interfaces:**
- Consumes: `tabsForRole`, `UserTab` from Task 1.
- Produces: `<UserTabs active={UserTab} role={UserRole} basePath={string} />`, rendering one `<Link>` per tab the role has.

Links rather than buttons: the tab is a URL, so it must be middle-clickable, shareable and restored by the back button.

The component renders nothing when the role has a single tab, so a parent or admin record shows no tab bar and the caller does not have to branch.

- [ ] **Step 1: Write the component**

```tsx
// src/app/admin/users/[id]/_components/user-tabs.tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/db/schema";
import { tabsForRole, type UserTab } from "@/lib/user-detail-tabs";

/**
 * Tab bar for the user record. Links, not buttons: the active tab lives in
 * the URL so it survives the back button and can be shared. Renders nothing
 * for a role with one section, so the caller never branches on it.
 */
export function UserTabs({
  active,
  role,
  basePath,
}: {
  active: UserTab;
  role: UserRole;
  basePath: string;
}) {
  const tabs = tabsForRole(role);
  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label="User sections"
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`${basePath}?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-4 py-3 text-[14px] font-bold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              isActive
                ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-600"
                : "text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/users/[id]/_components/user-tabs.tsx"
git commit -m "feat(admin/users): tab bar component"
```

---

## Task 3: At a glance rail card

**Files:**
- Create: `src/app/admin/users/[id]/_components/at-a-glance.tsx`

**Interfaces:**
- Consumes: `Card`, `CardBody` from `@/components/admin/ui`.
- Produces: `<AtAGlance rows={Array<{ label: string; value: ReactNode }>} />`.

The caller assembles the rows, so this component holds no knowledge of students, trials or roles and can summarise any record.

- [ ] **Step 1: Write the component**

```tsx
// src/app/admin/users/[id]/_components/at-a-glance.tsx
import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/admin/ui";

/**
 * Read-only summary for the record rail. The caller supplies the rows, so
 * this stays a layout component with no opinion about what it is summarising.
 */
export function AtAGlance({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
          At a glance
        </div>
        <dl className="mt-3 space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="text-[13px] text-ink-soft">{row.label}</dt>
              <dd className="min-w-0 truncate text-right text-[13px] font-bold text-ink">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/users/[id]/_components/at-a-glance.tsx"
git commit -m "feat(admin/users): at-a-glance rail card"
```

---

## Task 4: Restructure the page into tabs and rail

**Files:**
- Modify: `src/app/admin/users/[id]/page.tsx`
- Modify: `docs/checklist.md`

**Interfaces:**
- Consumes: `parseTabParam` (Task 1), `UserTabs` (Task 2), `AtAGlance` (Task 3).
- Produces: the page shell that Task 8 drops the calendar into.

This is a move, not a rewrite. Every existing card keeps its current props and children; only its position changes.

Layout rules:
- Two columns at `lg` and up, main content plus a `320px` rail. Below `lg` the rail stacks underneath, so the working area is never pushed off the first screen.
- The rail renders on every tab. Its Parents card is student-only; a tutor record shows the At a glance card alone.
- `UserTabs` renders nothing for a parent or admin record, so those show Profile with no tab bar without the page branching.
- `Save changes` renders only when the active tab is `profile`. Every other tab acts immediately, and an inert Save teaches people to distrust whether their change was applied.

- [ ] **Step 1: Widen the searchParams type**

In the page signature, replace:

```tsx
  searchParams: Promise<{ reschedule?: string }>;
```

with:

```tsx
  searchParams: Promise<{ reschedule?: string; tab?: string; month?: string }>;
```

and replace:

```tsx
  const { reschedule } = await searchParams;
```

with:

```tsx
  const { reschedule, tab } = await searchParams;
  const activeTab = parseTabParam(tab, user.role);
```

`user` is already loaded above this line, so the role is available. Parsing against the role means a stale cross-role link falls back to Profile instead of rendering an empty panel.

Add to the imports:

```tsx
import { parseTabParam } from "@/lib/user-detail-tabs";
import { UserTabs } from "./_components/user-tabs";
import { AtAGlance } from "./_components/at-a-glance";
```

- [ ] **Step 2: Build the rail and the two-column frame**

Wrap the existing card sections in this structure. `mainForTab` is filled in Step 3.

```tsx
      <UserTabs
        active={activeTab}
        role={user.role}
        basePath={`/admin/users/${id}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">{mainForTab}</div>
        <aside className="space-y-6">
          <AtAGlance
            rows={[
              { label: "Status", value: user.isActive ? "Active" : "Inactive" },
              { label: "Role", value: user.role },
              ...(isStudent
                ? [
                    { label: "Year level", value: user.yearLevel ?? "Not set" },
                    { label: "School", value: user.school ?? "Not set" },
                  ]
                : []),
              { label: "Phone", value: user.phone ?? "Not provided" },
              ...(isStudent
                ? [
                    {
                      label: "Free trial",
                      value: trial ? "On trial" : "Not on trial",
                    },
                  ]
                : []),
            ]}
          />
          {isStudent && (
            <FamilyLinksManager
              /* keep the exact props this component is given today */
            />
          )}
        </aside>
      </div>
```

- [ ] **Step 3: Route the existing cards to their tab**

Assign each existing section to a tab, keeping its current JSX verbatim:

- `profile` - the Profile card (`EditUserForm`), and for a student the Free trial card (`StudentTrialManager`).
- `lessons` - the Upcoming lessons card and the Leave / holidays card (`StudentLeaveManager`).
- `credits` - `CreditManagement`.
- `reports` - `StudentReportControls`.

The `tutor` and `availability` panels are built in Task 4b. For now render an empty fragment for those two keys so the page compiles.

For a parent or admin, only `profile` is reachable, so the Profile card renders and `UserTabs` returns null.

- [ ] **Step 4: Make Save changes conditional**

The header action slot renders `Message` always, and the `Save changes` submit only when `activeTab === "profile"`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors, all tests pass, build compiles.

- [ ] **Step 6: Manual browser check**

Start the dev server yourself only if the owner asks. Otherwise ask the owner to confirm:
- each tab shows its own content and the rail stays put
- `?tab=credits` deep-links correctly and the back button returns to the previous tab
- a tutor or parent record shows no tab bar
- `Save changes` is absent on all tabs except Profile

- [ ] **Step 7: Update the checklist and commit**

Add a row to `docs/checklist.md` recording the tabbed layout, the route, and the date, with FE marked partial until the owner has confirmed in a browser.

```bash
git add "src/app/admin/users/[id]/page.tsx" docs/checklist.md
git commit -m "feat(admin/users): tabbed record layout with a persistent summary rail"
```

---

## Task 4b: Tutor and Availability tabs

**Files:**
- Modify: `src/app/admin/_lib/queries.ts`
- Modify: `src/app/admin/users/[id]/page.tsx`

**Interfaces:**
- Consumes: `TutorBankForm` from `src/app/admin/tutors/_components/tutor-bank-form.tsx`, `TutorAvailabilityEditor` from `src/app/admin/tutors/availability/_components/availability-editor.tsx`, `isUnrestrictedAdmin` from `src/lib/roles.ts`.
- Produces: `getTutorRecord(tutorId: string)` and `getTutorAvailabilityForTutor(tutorId: string)` in `src/app/admin/_lib/queries.ts`.

Both existing components are already per-tutor: `TutorBankForm` takes `{ tutorId, initial }` and `TutorAvailabilityEditor` takes `{ tutorId, subjects, slots }`. They drop into tabs unchanged. What is missing is single-tutor data: `getTutorDirectory()` and `getTutorWeeklyAvailabilityBoard()` both return every tutor, because they back board views at `/admin/tutors` and `/admin/tutors/availability`.

**Security, do not skip.** `/admin/tutors` gates its whole page with `requireUnrestrictedAdmin()` because it renders bank details. Those live in `tutor_bank_details`, a deny-all RLS table holding payroll PII (security checklist A-series, migration 0035). Putting `TutorBankForm` on the user record without that gate would let a reception admin (`admin_restricted`) read tutor bank accounts, which is a privilege escalation. The page already computes `canManageRoles` from `isUnrestrictedAdmin`; reuse that exact value to decide whether the bank section renders, and do not fetch the bank row at all when it is false.

- [ ] **Step 1: Add the single-tutor queries**

In `src/app/admin/_lib/queries.ts`, add two functions modelled on the existing board queries, filtered to one tutor:

```ts
/**
 * One tutor's teaching record: the classes they take and their bank details.
 * Sibling of getTutorDirectory, which returns the whole board.
 *
 * `bank` is only populated when includeBank is true. The caller passes the
 * result of isUnrestrictedAdmin, because tutor_bank_details is payroll PII
 * that a reception admin must not see. Gating at the query keeps the data out
 * of the payload entirely rather than merely hiding it in the markup.
 */
export async function getTutorRecord(
  tutorId: string,
  includeBank: boolean,
): Promise<{
  classes: Array<{
    id: string;
    name: string;
    subjectName: string;
    studentCount: number;
  }>;
  bank: { accountName: string; bsb: string; accountNumber: string } | null;
}>;

/**
 * One tutor's weekly availability plus the subjects they can be scoped to.
 * Sibling of getTutorWeeklyAvailabilityBoard, filtered to a single tutor and
 * shaped to TutorAvailabilityEditor's { subjects, slots } props.
 */
export async function getTutorAvailabilityForTutor(
  tutorId: string,
): Promise<{
  subjects: Array<{ id: string; name: string }>;
  slots: Array<{
    id: string;
    weekday: number;
    startTime: string;
    endTime: string;
    subjectId: string | null;
  }>;
}>;
```

Read the two existing board queries first and mirror their joins and column names exactly, so the editor and form receive the shapes they already expect.

- [ ] **Step 2: Load the data on the page**

Alongside the existing `isStudent` branch, add a tutor branch:

```tsx
  const isTutor = coarseRole(user.role) === "tutor";
  const [tutorRecord, tutorAvailability] = isTutor
    ? await Promise.all([
        getTutorRecord(id, canManageRoles),
        getTutorAvailabilityForTutor(id),
      ])
    : [null, null];
```

`canManageRoles` is already computed on this page from `isUnrestrictedAdmin`.

- [ ] **Step 3: Render the tutor panel**

For `activeTab === "tutor"`: a Classes card listing the classes this tutor takes, each linking to `/admin/classes/<id>`, with an `Empty` state reading `Not assigned to any classes yet.` when the list is empty.

Below it, only when `canManageRoles` is true, a Bank details card wrapping `<TutorBankForm tutorId={id} initial={tutorRecord.bank} />`.

When `canManageRoles` is false, render nothing in place of the bank card. Do not render a locked or greyed placeholder: per the gate-do-not-dangle rule in `CLAUDE.md`, a section a reception admin can never open should not advertise itself.

- [ ] **Step 4: Render the availability panel**

For `activeTab === "availability"`: a single card wrapping

```tsx
<TutorAvailabilityEditor
  tutorId={id}
  subjects={tutorAvailability.subjects}
  slots={tutorAvailability.slots}
/>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean.

- [ ] **Step 6: Manual browser check**

Ask the owner to confirm on a tutor record:
- the tab bar shows Profile, Tutor, Availability and no student tabs
- the Classes card lists the right classes
- editing availability saves and the change survives a reload
- signed in as an `admin_restricted` (reception) account, the Bank details card is absent, and `?tab=tutor` still renders the Classes card rather than erroring

That last check is the security one. If bank details appear for a reception admin, stop and fix before continuing.

- [ ] **Step 7: Update the checklist and commit**

```bash
git add src/app/admin/_lib/queries.ts "src/app/admin/users/[id]/page.tsx" docs/checklist.md
git commit -m "feat(admin/users): tutor and availability tabs on the tutor record"
```

---

## Task 5: Month-window lesson query

**Files:**
- Modify: `src/app/admin/_lib/queries.ts`

**Interfaces:**
- Consumes: the existing `StudentLesson` type and the `lessons` table already imported in this file.
- Produces: `getStudentLessonsInRange(studentId: string, fromIso: string, toIso: string): Promise<StudentLesson[]>`.

`getStudentUpcomingLessons(studentId, days)` only looks forward from today, so it cannot fill a calendar the admin can page backwards through. Add a sibling that takes explicit bounds and leave the existing function alone; other callers still use it.

- [ ] **Step 1: Add the query**

Copy the body of `getStudentUpcomingLessons`, replacing its computed `today` / `horizon` bounds with the passed `fromIso` and `toIso`, and keeping its existing joins, column selection and ordering identical so both return the same shape.

```ts
/**
 * Lessons for one student between two local calendar dates, inclusive.
 * Sibling of getStudentUpcomingLessons, which only looks forward from today
 * and so cannot fill a calendar the admin can page backwards through.
 */
export async function getStudentLessonsInRange(
  studentId: string,
  fromIso: string,
  toIso: string,
): Promise<StudentLesson[]> {
  // ... same select/join/order as getStudentUpcomingLessons, with
  // gte(lessons.date, fromIso) and lte(lessons.date, toIso)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_lib/queries.ts
git commit -m "feat(admin): month-window lesson query for the student calendar"
```

---

## Task 6: Reschedule action returns errors

**Files:**
- Modify: `src/app/admin/_lib/actions-reschedule.ts`

**Interfaces:**
- Produces: `rescheduleStudentLesson(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }>`.

Today every validation failure calls `redirect()` at `/admin/users/[id]/reschedule/[lessonId]?error=...`. A slide-over cannot follow a redirect, and that route is deleted in Task 9, so the redirects would 404.

Change only the error reporting. The transaction body that creates the make-up lesson, marks the original absent and sends notifications is money- and entitlement-adjacent; do not touch it.

- [ ] **Step 1: Replace each error redirect with a return**

Four failure paths exist. Map them:

| Current redirect | Replace with |
|---|---|
| `?reschedule=error` (missing ids / reason too long) | `return { ok: false, error: "Missing lesson details." }` |
| `?error=invalid-slot` | `return { ok: false, error: "That slot is no longer valid." }` |
| `?error=lesson-past` | `return { ok: false, error: "That lesson has already happened." }` |
| `?error=slot-taken` | `return { ok: false, error: "Someone just took that slot. Pick another." }` |

- [ ] **Step 2: Return success instead of redirecting**

Keep the existing `revalidatePath` calls. Replace the success redirect with `return { ok: true }`, so the panel can close itself and let the revalidated page repaint.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors. Type errors at the old call site are expected and are fixed in Task 9, which deletes it. If the build must stay green between tasks, do Task 9 in the same commit.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/_lib/actions-reschedule.ts
git commit -m "refactor(admin/reschedule): return errors instead of redirecting"
```

---

## Task 7: Shared month grid

**Files:**
- Create: `src/components/calendar/month-grid.tsx`
- Modify: `src/app/student/_components/month-calendar.tsx`

**Interfaces:**
- Produces:

```ts
export type MonthChip = {
  id: string;
  date: string;          // YYYY-MM-DD, local calendar date
  label: string;
  sublabel?: string;
  tone: string;          // caller-supplied class string for the chip
  href?: string | null;  // renders a Link when set
};

export function MonthGrid(props: {
  year: number;
  month: number;         // 0-indexed, matching Date
  chips: MonthChip[];
  shadedDates?: Set<string>;
  onChipClick?: (chipId: string) => void;
}): JSX.Element;
```

This is the riskiest task in the plan because it touches a working student surface. It is worth doing now precisely because the current beta is admin and tutor only, so no student is on this component today.

The grid is a client component. A chip renders as a `<Link>` when `href` is set and as a `<button>` when `onChipClick` is supplied, which is how one grid serves a server-rendered student page passing hrefs and a client-side admin page passing a handler. Do not accept a render prop: functions cannot cross the server-to-client boundary, so the student page could not use one.

- [ ] **Step 1: Extract the grid**

Move the day-cell layout from `MonthCalendar` into `MonthGrid`: the Monday-offset calculation, the six-row cell grid, the today marker, and the grouping of chips by date. Take the `shadedDates` set into a background class on the cell.

Leave in `month-calendar.tsx`: the `MonthLesson` and `MonthHomework` types, the mapping from those into `MonthChip`, and the month navigation header.

- [ ] **Step 2: Point the student calendar at the shared grid**

`MonthCalendar` keeps its exported signature unchanged so every existing caller is unaffected. Internally it maps lessons and homework into `MonthChip[]`, passing `rescheduleHref` through as `href`, and renders `MonthGrid`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors, tests pass, build compiles.

- [ ] **Step 4: Manual cross-role browser check**

This step is not optional. Sharing the grid is the entire point of the task, so both consumers must be looked at. Ask the owner to confirm on the student timetable and the student subject pages that lessons and homework still land on the right days, the today marker is right, and reschedule chips still navigate.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/month-grid.tsx src/app/student/_components/month-calendar.tsx
git commit -m "refactor(calendar): extract the month grid for student and admin to share"
```

---

## Task 8: Admin lesson calendar with inline rescheduling

**Files:**
- Create: `src/app/admin/users/[id]/_components/lesson-calendar.tsx`
- Modify: `src/app/admin/users/[id]/page.tsx`
- Modify: `src/app/admin/_lib/actions-reschedule.ts`

**Interfaces:**
- Consumes: `MonthGrid` and `MonthChip` (Task 7), `getStudentLessonsInRange` (Task 5), `rescheduleStudentLesson` (Task 6), `isOnLeave` from `src/lib/student-leave.ts`, `SidePanel` from `src/components/ui/side-panel.tsx`.
- Produces: `<AdminLessonCalendar studentId year month lessons leavePeriods />`, and a new server action `loadAdminRescheduleOptions`.

- [ ] **Step 1: Add the slot-loading action**

In `src/app/admin/_lib/actions-reschedule.ts`, add:

```ts
/**
 * Slots an admin may move a lesson into. Mirrors the student's
 * loadRescheduleOptions, but returns all-tutor slots as well as same-subject
 * ones: an admin may move a lesson to any tutor, which a student may not.
 */
export async function loadAdminRescheduleOptions(
  studentId: string,
  lessonId: string,
): Promise<
  | {
      ok: true;
      sameSubject: AvailableSlot[];
      allTutors: AvailableSlot[];
    }
  | { ok: false; error: string }
>;
```

Guard with `requireAdmin()`. Body reuses exactly what the page being deleted already calls: `getLessonContextForStudent`, then `getEligibleTutors` and `getAllTutors`, then `expandAvailability(tutors, now, 4)` for each, then `markTakenSlots`. Return `{ ok: false, error: "Lesson not found." }` when `getLessonContextForStudent` returns null.

- [ ] **Step 2: Build the calendar component**

Client component. Holds `selectedLessonId` state. Maps lessons into `MonthChip[]`, computes `shadedDates` from `leavePeriods` using `isOnLeave`, renders month navigation that pushes `?tab=lessons&month=YYYY-MM`, and renders `MonthGrid` with an `onChipClick` that opens the panel.

Past lessons are not clickable: a lesson whose date is before today gets no `onChipClick` and is rendered muted, because it cannot be rescheduled.

- [ ] **Step 3: Build the panel body**

Inside `SidePanel`, titled `Move lesson`:
- the lesson being moved, its current date, time and tutor
- a segmented control switching the slot list between same-subject tutors and all tutors
- the slot list, each slot a radio
- when the chosen slot's date satisfies `isOnLeave`, an inline warning naming the date. Warn, do not block: an admin may have a reason to override.
- an optional reason field, `maxLength={2000}` to match the action's existing guard
- footer with Cancel and Move lesson

On submit, call `rescheduleStudentLesson`. On `{ ok: false }` show `error` inline and keep the panel open. On `{ ok: true }` close the panel and call `router.refresh()`.

- [ ] **Step 4: Wire it into the lessons tab**

In `page.tsx`, replace the Upcoming lessons card with `AdminLessonCalendar`. Parse `?month=` with the existing `parseMonthParam` and derive the range with `monthBounds`, both already exported from `src/app/student/_components/month-calendar.tsx`. Load lessons with `getStudentLessonsInRange`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean.

- [ ] **Step 6: Manual browser check**

Ask the owner to confirm, on a student with lessons:
- lessons appear on the right days, month navigation works both directions
- a leave period shades the right days
- clicking a lesson opens the panel with slots
- moving a lesson succeeds, the panel closes, the calendar repaints with the lesson on its new date
- picking a slot inside a leave period shows the warning but still allows the move
- a past lesson is not clickable

- [ ] **Step 7: Commit**

```bash
git add "src/app/admin/users/[id]/_components/lesson-calendar.tsx" \
        "src/app/admin/users/[id]/page.tsx" \
        src/app/admin/_lib/actions-reschedule.ts
git commit -m "feat(admin/users): month calendar with inline lesson rescheduling"
```

---

## Task 9: Delete the standalone reschedule route

**Files:**
- Delete: `src/app/admin/users/[id]/reschedule/[lessonId]/page.tsx`
- Delete: `src/app/admin/users/[id]/reschedule/[lessonId]/_components/slot-picker.tsx`
- Modify: `docs/checklist.md`

Two implementations of one flow is the drift the cross-role consistency rule exists to prevent, and a bug fixed in one would silently persist in the other.

- [ ] **Step 1: Confirm nothing links to it**

Run: `grep -rn "reschedule/" src | grep -v "components/reschedule" | grep -v actions-reschedule`
Expected: no hits under `src/app/admin/users`. The only historical caller was the lesson list replaced in Task 8. Investigate any hit before deleting.

- [ ] **Step 2: Delete the route**

```bash
git rm -r "src/app/admin/users/[id]/reschedule"
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean. A type error here means a caller was missed in Step 1.

- [ ] **Step 4: Update the checklist and commit**

Record in `docs/checklist.md` that admin rescheduling now happens inline on the user record and that the standalone route is gone, so a later reader does not go looking for it.

```bash
git add -A
git commit -m "refactor(admin/users): drop the standalone reschedule route, superseded by the inline panel"
```

---

## Self-Review

**Spec coverage.** Phase 1 tabs (Tasks 1, 2, 4), rail (Tasks 3, 4), conditional Save (Task 4), tutor and availability tabs (Task 4b), shared grid extraction (Task 7), admin calendar (Task 8), leave shading via the existing `isOnLeave` (Task 8), inline panel (Task 8), action error returns (Task 6), route deletion (Task 9), month-window data (Task 5). Out-of-scope items in the spec have no tasks, correctly.

Task 4b was added after the spec was approved, at the owner's request. The spec covers a student record; the tutor and availability tabs extend the same shell to tutor records. Update the spec if it is used as the reference later.

**Placeholders.** Task 4 Step 3 and Task 5 Step 1 describe moves of existing code rather than reproducing it verbatim, because reproducing several hundred lines of unchanged JSX and SQL would obscure what actually changes. Both name the exact source and the exact edit. Every genuinely new module is given in full.

**Type consistency.** `UserTab` and `parseTabParam` are used identically in Tasks 1, 2 and 4. `MonthChip` and `MonthGrid` are defined in Task 7 and consumed in Task 8. `rescheduleStudentLesson` returns `{ ok, error }` from Task 6 onwards and Task 8 consumes exactly that. `getStudentLessonsInRange` is defined in Task 5 and consumed in Task 8. `isOnLeave` and `SidePanel` are pre-existing and used with their current signatures.

**Ordering.** Task 6 leaves the old page's call site type-broken until Task 9 deletes it. This is called out in Task 6 Step 3, with the option to combine the two commits if the build must stay green at every commit.
