# Student & Admin Role Tiers - Spec 1: Foundation + Student Restricted/Unrestricted

**Date:** 2026-07-09
**Status:** Approved design, ready for implementation plan
**Scope:** The role-tier *foundation* (shared by all later tier work) plus the two
parent-parity features an unrestricted student needs today: own invoices/balance
and DM-admin. Reschedule and the admin split are separate specs (see
[Out of scope](#out-of-scope--captured-for-later-specs)).

Source of truth for the tier model: `docs/checklist.md` §"Role Tiering".

---

## 1. Problem

The live `userRoleEnum` is flat: `student | parent | tutor | admin`. `requireRole`
accepts exactly one role. There is no way to express:

- **`student_unrestricted`** - older / independently-enrolled students who have **no
  parent account** and therefore must self-serve the things a parent normally does
  for them (see their own invoices, pay, contact the office).
- **`student_restricted`** - younger, parent-dependent students = today's exact
  student scope.

This spec introduces the six-tier enum and delivers the unrestricted-student
capabilities that have no equivalent in the student portal today: **own invoices +
outstanding balance**, and **DM the admin office**. Everything else a parent-less
student needs is either already native to the student portal (homework, progress,
subjects, timetable, notifications, and tutor feedback embedded in progress/homework)
or lives in a later spec (reschedule).

---

## 2. Target enum

```
admin_unrestricted | admin_restricted | tutor | parent | student_unrestricted | student_restricted
```

`tutor` and `parent` are unchanged. This spec only *activates* the two student
tiers; the two admin tiers are added to the enum and migrated to (existing `admin`
→ `admin_unrestricted`) but their behavioural split is a later spec - after this
spec every admin is `admin_unrestricted`, i.e. **zero behaviour change for admins**.

---

## 3. Foundation (shared by every later tier spec)

### 3.1 Migrations (raw SQL only)

**Hazard:** `drizzle-kit push` disables RLS + drops every policy and the
`lesson_notes_safe` view (per project memory). These are hand-written raw-SQL
migrations. **No `db:generate`, no `db:push`.** Apply with the dev server stopped
(migration locks).

A new enum value cannot be *used* in the same transaction that adds it, so the add
and the use are split into two files:

**`supabase/migrations/0017_role_tiers_add_values.sql`**
```sql
alter type public.user_role add value if not exists 'admin_unrestricted';
alter type public.user_role add value if not exists 'admin_restricted';
alter type public.user_role add value if not exists 'student_unrestricted';
alter type public.user_role add value if not exists 'student_restricted';
```

**`supabase/migrations/0018_role_tiers_migrate.sql`**
1. Migrate `public.profiles.role`: `admin` → `admin_unrestricted`,
   `student` → `student_restricted`.
2. Backfill `auth.users.raw_app_meta_data->>'role'` with the same mapping (mirrors
   migration `0002`; this JWT claim is what `requireRole` **and** RLS read - the
   `profiles.role` column is not what gates access at runtime).
3. Redefine `public.is_admin()` to match **both** admin tiers (and the legacy
   value, harmlessly):
   ```sql
   create or replace function public.is_admin() returns boolean
   language sql stable as $$
     select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') like 'admin%', false);
   $$;
   ```
4. Recreate the `lesson_notes_safe` view, changing its inline
   `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` predicate to `like 'admin%'`
   (migration `0003`). Copy the existing view body verbatim except that predicate.

Legacy `admin` / `student` enum values physically remain in the type (Postgres
cannot cleanly drop enum values). They are intentionally unused after migration.

**Verification (part of the migration's Definition of Done):** under an admin JWT,
`select public.is_admin()` returns `true`, and an admin can still read a
student's `profiles` row (proves RLS admin policies survived the value change).

### 3.2 App code

- **`src/db/schema.ts`** - `userRoleEnum` lists the six canonical tiers. Add helper
  types: `AdminTier = 'admin_unrestricted' | 'admin_restricted'`,
  `StudentTier = 'student_unrestricted' | 'student_restricted'`.
- **`src/lib/auth.ts`** -
  - `requireRole` accepts `UserRole | UserRole[]` (a set); redirect unless the
    caller's tier is in the set.
  - Add `requireAdmin()` → any admin tier; `requireStudent()` → any student tier.
    Both return `{ user, role }` so callers can branch on tier.
- **`src/lib/supabase/middleware.ts`** - portal gates match tier families:
  `/admin/*` → any `admin_*`, `/student/*` → any `student_*`.
- **Role-literal audit (~43 sites).** Grep and update every hard-coded role
  comparison that breaks once rows carry the new values. Two kinds:
  - `requireRole("admin")` / `requireRole("student")` → `requireAdmin()` /
    `requireStudent()`.
  - Data-layer comparisons, e.g. `eq(profiles.role, "admin")` in
    `parent/_actions.ts::submitRescheduleRequest` → match both admin tiers
    (`inArray(profiles.role, ["admin_unrestricted","admin_restricted"])` or a shared
    constant `ADMIN_TIERS`). Define `ADMIN_TIERS` / `STUDENT_TIERS` arrays once and
    reuse.

  This audit is mechanical but load-bearing: a missed `= 'admin'` silently returns
  zero rows after migration.

---

## 4. Student capability model

- `studentTier(role): 'restricted' | 'unrestricted'` - a pure predicate in
  `src/lib/auth.ts` (or a small `src/lib/tiers.ts`).
- `requireUnrestrictedStudent()` - guard used by every new unrestricted-only page
  loader and server action. Redirects a `student_restricted` caller.

Restricted students retain today's exact scope; **no restricted-student code path
changes** except the DM-admin removal in §5.2.

---

## 5. Features (unrestricted students only)

### 5.1 Own invoices + outstanding balance

- **Query:** `getInvoicesForStudent(studentId)` = `invoices WHERE student_id = me`,
  ordered by issue date. Mirror `getInvoicesForParent` but keyed on `student_id`.
  `getOutstandingBalanceForStudent(studentId)` = sum of `unpaid` + `overdue`
  amounts. (Reuse the parent `_data.ts` shapes; do not import parent modules into
  the student portal - copy the small query into `student/_lib/queries.ts` to keep
  portal boundaries clean.)
- **Page:** `/student/payments` - read-only invoice table + status pills, styled
  with the student UI kit (`@/components/student/ui`). Guarded by
  `requireUnrestrictedStudent()`.
- **Dashboard:** an outstanding-balance stat tile, rendered only for unrestricted
  students.
- **Nav:** "Payments" item shown only for unrestricted students.
- **Note (not this spec):** actual online payment has no processor anywhere - this
  is invoice *view* only. `invoices.parent_id` is `NOT NULL`, so a truly
  parent-less student's invoices depend on the admin creation flow tolerating a
  null/​self parent - an **admin-spec** concern, flagged there, not here.

### 5.2 DM the admin office

- **`src/lib/dm-permissions.ts`** - replace the blanket
  `if (meRole === "admin" || targetRole === "admin") return true` with tier-aware
  logic:
  - `student_unrestricted ↔ admin_*` → allowed.
  - `student_restricted → admin_*` → **blocked** (removal of a capability restricted
    students have today).
  - `student ↔ tutor` shared-class rule unchanged for both tiers.
  - parent/tutor/admin-to-admin paths unchanged (still allowed).
- **Student messages UI** - show the "message the admin office" entry point only for
  unrestricted students. (`getAdminContact` already exists in the parent data layer;
  port the minimal version.)

### 5.3 Tutor feedback

No change. Already visible to students via `progress/[id]` and homework marking.
Listed only to record that it was checked and is intentionally untouched.

---

## 6. Enforcement (defence in depth)

1. **UI** hides affordances by tier (nav items, dashboard tiles, DM entry point).
2. **Server** is the real gate: every new page loader and server action calls
   `requireUnrestrictedStudent()`. Student/parent reads use server-side Drizzle that
   **bypasses RLS**, so the app-layer guard - not the database - is the security
   boundary here. This is consistent with the existing model documented in
   `docs/SECURITY.md`.

---

## 7. Success criteria

- `npm run typecheck` (or project equivalent) passes.
- Migration verification: under an admin JWT, `is_admin()` is `true` and an admin can
  read a student profile row (RLS admin policies survived).
- **Restricted student**: no Payments nav/route, no DM-admin entry, existing scope
  otherwise identical.
- **Unrestricted student**: sees `/student/payments` with their own invoices, an
  outstanding-balance tile on the dashboard, and can start a DM with the admin
  office.
- Admin / tutor / parent portals unaffected.
- Seed data includes one `student_unrestricted` demo account (and existing students
  become `student_restricted`).

---

## 8. Out of scope - captured for later specs

**Reschedule spec (next):**
- Add explicit `classType` enum (`one_on_one | group`) to `classes` (do **not**
  infer from `capacity`).
- **1-on-1** (`classType = one_on_one`): reschedule **always** requires tutor/admin
  push approval.
- **Group** (`classType = group`): switching to another same-subject session with
  capacity that week is **direct** if **≥24h** before the lesson; **<24h** requires
  push approval.
- Build a real approval subsystem: a `reschedule_requests` table (state:
  pending/approved/rejected) + accept/reject actions. Today's parent
  `submitRescheduleRequest` is a **stub** - it only notifies admins, creates no
  record, and reschedules nothing. "Push" = in-app notification for now; native
  device push is Phase 5.
- Applies to **both** `student_unrestricted` and **parents** (parent reschedules
  their child's class).
- Notifications on reschedule go to **tutor + linked parents + admin**.
- The existing admin `rescheduleStudentLesson` action (creates a per-student
  `makeup` lesson so classmates in a shared class are unaffected) is the execution
  primitive the approval flow calls on accept.
- **Known limitation to address:** `expandAvailability` does not subtract
  already-booked lessons, so double-booking is possible. Pre-existing (admin flow
  has it too); decide in the reschedule spec whether to fix.
- **Class tokens / make-up credits** (`docs/checklist.md:88`): the future fallback
  when a ≥24h reschedule finds no slot. Out of scope; noted as where it plugs in.

**Admin split spec (later):**
- Behavioural split of `admin_restricted` (reception) vs `admin_unrestricted`
  (owner): hide financials/role-management/audit-log at the **data layer** from
  reception; per-feature middleware gates (e.g. `/admin/payments/refund`).
- Owner **push-approval** flow: reception requests a sensitive action, owner
  accepts/rejects (no password - approval *is* the lock).
- `invoices.parent_id NOT NULL` handling for parent-less independent students.
