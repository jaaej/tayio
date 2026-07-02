# Security & RLS

Living document for the Security & RLS layer. Every migration that touches RLS / policies / triggers / views / grants is logged here so the access model can be reconstructed from this file alone.

## Migration boundary

- **Drizzle (`src/db/schema.ts`, `drizzle/`)** owns table DDL only — columns, types, foreign keys, indexes, enums.
- **Raw SQL (`supabase/migrations/`)** owns everything else — RLS policies, triggers, functions, views, grants, storage buckets and policies.

**Never re-define a policy or trigger in Drizzle.** Drizzle doesn't track raw SQL files; mixing the two silently drifts.

### ⛔ Do NOT run `db:push` (`drizzle-kit push`) — it WIPES all RLS

`drizzle-kit push` reconciles the DB to `src/db/schema.ts`. Because every RLS policy + the `lesson_notes_safe` view live in raw SQL (not `schema.ts`), push sees them as "drift" and **disables RLS + drops every policy + drops the view on ALL tables** — silently, and `--force` skips the confirmation. Functions/triggers survive; RLS/policies/views do not. (This caused a full RLS wipe on 2026-07-01; see 0012.)

`npm run db:push` is therefore blocked by a guard (`scripts/db-push-guard.mjs`). **Safe schema-change workflow:**

1. Update `src/db/schema.ts` (for Drizzle types only).
2. Write the DDL as a raw-SQL `ALTER TABLE` in a new `supabase/migrations/NNNN_*.sql`, and apply it with `node scripts/apply-sql.mjs supabase/migrations/NNNN_*.sql`.
3. Run **`npm run db:check-rls`** — audits every table and fails if any lost RLS. Run this after ANY database change.

If `db:push` ever does run (or you bypass the guard with `npx drizzle-kit push`), **re-apply `supabase/migrations/0003`–`0012` in order with the dev server stopped** (its connections hold locks that block `ALTER TABLE … ENABLE RLS`), then `npm run db:check-rls`.

## Applying migrations

```bash
node scripts/apply-sql.mjs supabase/migrations/<file>.sql
```

Prefers `DIRECT_URL` (session pooler `:5432`) over `DATABASE_URL` (transaction pooler `:6543`). The transaction pooler is **not safe for DDL** — no advisory locks, no session-level state, prepared statements unreliable. Migrations must use the session pooler.

The runtime Next.js app uses `DATABASE_URL` (transaction pooler) for connection scaling. That's intentional and unrelated.

## Migration log

### 0001 — Profile sync trigger

**File:** `supabase/migrations/0001_profile_sync_trigger.sql`
**Status:** Applied to live project.
**Risk:** Low. Additive; no existing data modified.

**What it does:** Adds `public.handle_new_auth_user()` (security definer) + `after insert` trigger on `auth.users`. When a new auth user is created, a matching `public.profiles` row is inserted automatically. Role + name are read from `app_metadata` first, falling back to `user_metadata`.

**Idempotency:** `on conflict (id) do nothing` on the insert; `drop trigger if exists` + `create or replace function` on definition.

**Failure mode:** If neither metadata bag has `role`, function logs a warning and skips the profile insert. Auth signup itself still succeeds.

**Reversible by:**
```sql
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user;
```

### 0002 — Role backfill to app_metadata

**File:** `supabase/migrations/0002_role_to_app_metadata.sql`
**Status:** Applied to live project. 20/20 users backfilled.
**Risk:** Low. Only writes to `auth.users.raw_app_meta_data`; preserves existing keys via `||` merge.

**What it does:** Copies `role`, `first_name`, `last_name` from `raw_user_meta_data` into `raw_app_meta_data` for every auth user that has them. Uses `jsonb_strip_nulls` so missing fields don't write literal nulls; `||` merge preserves Supabase-managed keys (`provider`, `providers`).

**Why this matters:** `user_metadata` is user-mutable via the Supabase client SDK — a signed-in user could set `role='admin'` on themselves. `app_metadata` is server-only.

**Reversible by:**
```sql
update auth.users set raw_app_meta_data =
  raw_app_meta_data - 'role' - 'first_name' - 'last_name';
```

### 0003 — `lesson_notes_safe` view

**File:** `supabase/migrations/0003_lesson_notes_safe_view.sql`
**Status:** Applied to live project.
**Risk:** Low. Adds a read-only view; no base-table mutations.

**What it does:** Creates `public.lesson_notes_safe` over `public.lesson_notes` that (a) omits the `internal_note` column and (b) self-enforces row visibility for student / parent / tutor / admin via a WHERE clause inside the view.

**Why a view (not column privileges):** Hiding `internal_note` from students/parents while keeping it visible to tutors/admins is a column-level concern that RLS alone (row-level) can't express. The view route is explicit; new sensitive columns are caught by the explicit column list.

**Why `security_invoker=false`:** The view bypasses RLS on the base table so its own WHERE clause is the sole gate. Migration 0004 locks `lesson_notes` (base table) to tutors + admins only — students and parents have **no** policy on the base table, so this view is their only path, and `internal_note` is unreachable for them by construction.

**Grants:** revoke all from `anon` and `authenticated`, then grant `SELECT` only to `authenticated`. Supabase's default privileges grant the full DML set to those roles on new views; we have to revoke explicitly.

**Supabase Advisor warning:** This view is flagged "Security Definer View — CRITICAL". That's a generic check against any `security_invoker=false` view. In our case the pattern is intentional and documented; the WHERE clause + revoked DML grants ARE the access control. The warning can be dismissed.

### 0004 — Enable RLS + write policies for all tables

**File:** `supabase/migrations/0004_rls_enable_and_policies.sql`
**Status:** Applied to live project. Verified via JWT impersonation matrix.
**Risk:** HIGH at apply time — locks every public table behind RLS. Wrapped in `BEGIN/COMMIT` so partial failures roll back fully.

**What it does:** Enables RLS on all 14 (now 15, see 0005) public tables and writes policies implementing the PRD access matrix. Defines 10 `SECURITY DEFINER` helper functions used by policies: `is_admin`, `is_parent_of`, `is_enrolled_in`, `is_tutor_of_class`, `is_parent_of_enrolled_in`, `is_tutor_of_student`, `is_tutor_of_lesson`, `has_homework_assignment`, `is_parent_of_assignee`, `is_tutor_of_homework`.

**Why SECURITY DEFINER helpers (not inline EXISTS):** Inline `EXISTS` subqueries in policies trigger RLS on the queried table. Two policies that reference each other's tables produce `infinite recursion in policy` (42P17). Helpers run as OWNER, bypassing RLS during the lookup. `search_path` is pinned (`public, auth`) on every helper to defeat search-path injection.

**Why service_role still works:** Supabase grants `bypassrls` to `service_role`. All server-side scripts (`seed-users.mjs`, `seed-demo.mjs`, `rename-users.mjs`, `seed-availability.mjs`) and any Next.js API route using the service role continue to work without policy exceptions. Same for raw `psql` / `DIRECT_URL` connections (postgres role bypasses RLS).

**Why server-side Drizzle queries are unaffected:** `src/db/client.ts` connects via `DATABASE_URL` as the `postgres` role, which also bypasses RLS. Trusted server-side reads/writes through Drizzle do not need policy exceptions. RLS is the defense-in-depth layer for any direct client-side query that goes through the Supabase JS SDK with a JWT.

**Reversible by:** `alter table public.<name> disable row level security;` per table.

### 0007 — Homework grading column lock

**File:** `supabase/migrations/0007_homework_grading_lock.sql`
**Status:** Applied to live project, verified 2026-05-27 (10/10 checks pass).
**Risk:** Low. Adds a `BEFORE UPDATE` trigger; no schema or data change.

**What it does:** Adds a `BEFORE UPDATE` trigger on `public.homework_assignments` that silently reverts changes to `score`, `feedback`, `marked_at`, `marked_by` unless the caller is an admin or the homework's authoring tutor. Closes security-checklist A9 (caveat §2 from migration 0004).

**Why this matters:** Migration 0004's `homework_assignments_student_update` RLS policy is row-restricted (own assignment) but not column-restricted. A student calling `supabase.from('homework_assignments').update({ score: 100 }).eq(...)` via the JS SDK would have their UPDATE accepted at the RLS layer. This trigger enforces column-level rules at the DB layer.

**Carve-outs (trusted callers, no restriction):**
- `current_user` not in `('authenticated', 'anon')` — postgres role (Drizzle via `DATABASE_URL`) or service_role.
- `public.is_admin()` — admin via authenticated JWT.
- `public.is_tutor_of_homework(homework_id)` — the homework's authoring tutor via authenticated JWT.

**Why SECURITY INVOKER (not DEFINER):** With `SECURITY DEFINER`, `current_user` inside the function is always the function owner (postgres), so the bypass check would always succeed for any caller. `SECURITY INVOKER` makes `current_user` reflect the actual calling role. The helpers this function uses (`is_admin`, `is_tutor_of_homework`) are themselves `SECURITY DEFINER` and handle their own table access.

**Behavior is silent revert, not error:** the student's UPDATE statement appears to succeed (no error returned), but the disallowed columns retain their previous values. Optimistic UI in the student portal will not throw — it just won't visibly change the grade. If a future audit shows a student attempted such an UPDATE, the audit log (migration 0006) captures the attempt as an INSERT/UPDATE row.

**Reversible by:**
```sql
drop trigger if exists homework_assignments_grading_lock on public.homework_assignments;
drop function if exists public.enforce_homework_assignment_grading_lock;
```

### 0006 — Audit logs

**File:** `supabase/migrations/0006_audit_logs.sql`
**Status:** Applied to live project, verified 2026-05-27 (8/8 checks pass).
**Risk:** Low. Adds a new table, function, and triggers; does not alter existing data.

**What it does:** Creates an append-only `public.audit_logs` table + `public.handle_audit_log()` trigger function (SECURITY DEFINER) + AFTER INSERT/UPDATE/DELETE triggers on six watched tables: `profiles`, `family_links`, `classes`, `enrollments`, `invoices`, `announcements`. Each row mutation writes an audit entry containing `actor_id` (from `auth.uid()`), `actor_role` (from JWT `app_metadata.role`), action (`INSERT`/`UPDATE`/`DELETE`), table name, full old + new row state as JSONB, and timestamp.

**Why this list of tables:** these are the high-stakes operational tables an admin mutates. Tutor-driven high-volume tables (`homework`, `lesson_notes`, `attendance`, `progress_topics`) are deliberately excluded — auditing every attendance mark would balloon the log without adding security value.

**Tamper-resistance:**
- RLS enabled on `audit_logs`; `SELECT` granted to admins only via `audit_logs_admin_read` policy.
- No `INSERT`/`UPDATE`/`DELETE` policy granted to any role. The trigger function bypasses RLS because it runs `SECURITY DEFINER` (owner = postgres).
- `authenticated` role has `SELECT` only; `anon` has no grants.

**Caveat — actor identification is partial:**

`auth.uid()` only returns a non-null UUID when the database session has a JWT context. Two types of operations:
- **User-context operations** (Supabase JS SDK with a user's JWT, or `set local request.jwt.claims` in server code): `actor_id` and `actor_role` are populated.
- **Server-context operations** (Drizzle's `db` client connecting as the `postgres` role, or `service_role`): both are NULL. The audit row still captures what changed and when, but identifies the actor as "system / server."

For most admin portal mutations today (which go through server-side Drizzle), audit rows will have `actor_id = NULL`. To get reliable actor capture for admin actions, server actions need to either (a) make the mutation through a Supabase-client session that carries the admin's JWT, or (b) `SET LOCAL request.jwt.claims` before the Drizzle query. Filed as a follow-up; not a security hole, just a logging gap.

**Reversible by:**
```sql
drop trigger if exists audit_profiles on public.profiles;
drop trigger if exists audit_family_links on public.family_links;
drop trigger if exists audit_classes on public.classes;
drop trigger if exists audit_enrollments on public.enrollments;
drop trigger if exists audit_invoices on public.invoices;
drop trigger if exists audit_announcements on public.announcements;
drop function if exists public.handle_audit_log;
drop table if exists public.audit_logs;
```

### 0005 — `tutor_availability` RLS

**File:** `supabase/migrations/0005_tutor_availability_rls.sql`
**Status:** Applied to live project. Verified.
**Risk:** Low.

**What it does:** Enables RLS on `public.tutor_availability` (added to the schema after 0004) and writes policies: `tutor_availability_tutor_all` (own rows) + `tutor_availability_admin_all`. No student/parent policy — those portals query via server-side Drizzle which bypasses RLS.

**Why it exists:** Supabase Advisor flagged it CRITICAL (RLS Disabled in Public) because the table was added after 0004. This is the catch-up.

### 0009 — `subject_topics` RLS

**File:** `supabase/migrations/0009_subject_topics_rls.sql`
**Status:** Pending apply (DB-apply step deferred to controller checkpoint).
**Risk:** Low. Additive — enables RLS on a new table and writes two new policies. No existing rows or policies modified.

**What it does:** Enables RLS on `public.subject_topics` (added to the schema in the curriculum-topics feature branch) and writes policies mirroring the existing `subjects` table pattern: `subject_topics_select_authenticated` (SELECT for any authenticated user) + `subject_topics_admin_all` (full DML for admins via `public.is_admin()`). Revokes all grants from `anon`; grants `SELECT` to `authenticated`.

**Why it mirrors `subjects`:** `subject_topics` is a reference/lookup table (curriculum metadata), not user-scoped data. Any authenticated user needs to read it to populate dropdowns and views; only admins should create/update/delete entries.

**Reversible by:**
```sql
alter table public.subject_topics disable row level security;
```

### 0010 — `tutor_week_sections` + `tutor_week_attachments` RLS

**File:** `supabase/migrations/0010_tutor_week_sections_rls.sql`
**Status:** Pending apply (DB-apply step deferred to controller checkpoint).
**Risk:** Low. Additive — enables RLS on two new tables, adds a `SECURITY DEFINER` helper function, and writes six new policies. No existing rows or policies modified.

**What it does:** Enables RLS on `public.tutor_week_sections` and `public.tutor_week_attachments` (both added to the schema in Task 1) and writes policies:

- `tutor_week_sections_select_authenticated` — SELECT for any authenticated user.
- `tutor_week_sections_tutor_all` — full DML gated on `tutor_id = auth.uid()`.
- `tutor_week_sections_admin_all` — full DML for admins via `public.is_admin()`.
- `tutor_week_attachments_select_authenticated` — SELECT for any authenticated user.
- `tutor_week_attachments_tutor_all` — full DML gated on `public.is_owner_of_tutor_section(section_id)`.
- `tutor_week_attachments_admin_all` — full DML for admins via `public.is_admin()`.

Adds `SECURITY DEFINER` helper `public.is_owner_of_tutor_section(p_section_id uuid) returns boolean`: resolves whether the current authenticated user owns the parent `tutor_week_sections` row that an attachment hangs off. Follows the same pattern as existing helpers in 0004 — `search_path` pinned to `public, auth`, returns bool only (no data leaked), `stable` language SQL.

**Why a helper for `tutor_week_attachments`:** the attachment table has no direct `tutor_id` column — ownership is inherited through `section_id → tutor_week_sections.tutor_id`. An inline EXISTS in the policy would trigger RLS on `tutor_week_sections` during policy evaluation, risking 42P17 (infinite recursion). The `SECURITY DEFINER` helper bypasses RLS on `tutor_week_sections` for that single ownership lookup only.

Revokes all grants from `anon`; grants `SELECT` to `authenticated` for both tables.

**Reversible by:**
```sql
alter table public.tutor_week_sections disable row level security;
alter table public.tutor_week_attachments disable row level security;
drop function if exists public.is_owner_of_tutor_section(uuid);
```

### 0011 — tutor section read scoping

**File:** `supabase/migrations/0011_tutor_section_read_scope.sql`
**Status:** Pending apply (DB-apply step deferred to controller checkpoint).
**Risk:** Low. Replaces two permissive `using(true)` select policies with scoped ones; write policies from 0010 are unchanged.

**What it does:** Replaces the 2a broad-read policies (`tutor_week_sections_select_authenticated` and `tutor_week_attachments_select_authenticated`, both `using(true)`) with policies gated by two new `SECURITY DEFINER` helper functions:

- `public.can_read_tutor_section(p_tutor_id uuid, p_subject_week_id uuid) returns boolean` — returns true if the caller is the section's tutor, an admin, a student enrolled with that tutor for that subject's week, or a parent of such a student.
- `public.can_read_tutor_section_att(p_section_id uuid) returns boolean` — resolves the parent `tutor_week_sections` row and delegates to `can_read_tutor_section`. Needed because `tutor_week_attachments` has no direct `tutor_id` or `subject_week_id` column; an inline EXISTS would risk 42P17 recursion.

Both helpers follow the existing pattern: `language sql stable security definer set search_path = public, auth`, return bool only (no data leaked).

**Why now (Part 2b):** 0010 shipped with `using(true)` select policies as a deliberate first-pass to unblock the tutor UI. Any authenticated user (including students and parents of unrelated students) could read all tutor sections. 0011 closes that gap.

**Note — `class_week_overrides` dropped in Part 2b:** The companion Drizzle schema migration (`npm run db:push`, controller-gated Step 1 of Task 4) drops the `class_week_overrides` table entirely. That table was introduced in Task 1 but never populated — no data is lost. It had no RLS policies in 0010 (table was not present in that migration) and no rows in any environment. No SECURITY.md matrix entry existed for it; none is needed post-drop.

**Reversible by:**
```sql
drop function if exists public.can_read_tutor_section(uuid, uuid);
drop function if exists public.can_read_tutor_section_att(uuid);

-- on tutor_week_sections
drop policy if exists tutor_week_sections_select_scoped on public.tutor_week_sections;
create policy tutor_week_sections_select_authenticated on public.tutor_week_sections
  for select to authenticated using (true);

-- on tutor_week_attachments
drop policy if exists tutor_week_attachments_select_scoped on public.tutor_week_attachments;
create policy tutor_week_attachments_select_authenticated on public.tutor_week_attachments
  for select to authenticated using (true);
```

### 0012 — RLS for previously-uncovered tables

**File:** `supabase/migrations/0012_uncovered_tables_rls.sql`
**Status:** Applied.
**Risk:** Medium at apply time — enables RLS on 8 tables that previously had none. Wrapped in `BEGIN/COMMIT`. Requires the dev server stopped first (its connections hold locks that block `ALTER TABLE … ENABLE RLS`).

**What it does:** Enables RLS + policies on 8 tables that shipped without any committed RLS and had relied only on server-side Drizzle (which bypasses RLS): `terms`, `subject_weeks`, `student_week_progress`, `discussion_threads`, `discussion_replies`, `dm_threads`, `dm_messages`, `dm_reads`. Adds one helper `public.is_dm_participant(p_thread_id uuid)` (`security definer`, pinned `search_path`, bool only, bypasses `dm_threads` RLS to avoid recursion).

- **terms, subject_weeks** — read all authenticated, write admin (mirrors `subjects`).
- **student_week_progress** — student own (read+write), parent of that student (read), admin all.
- **discussion_threads / discussion_replies** — read all authenticated; author INSERT/UPDATE own; admin all (moderation + soft-delete).
- **dm_threads / dm_messages** — participants read/write; **admin READ** (safeguarding oversight, see below); `dm_messages` INSERT requires `sender_id = auth.uid()` AND participant.
- **dm_reads** — own only (read receipts stay private; no admin access).

**Why admins can read DMs:** students are minors. Under the Victorian **Reportable Conduct Scheme** the organisation must be able to investigate reported conduct against workers/volunteers, which requires access to the relevant messages; **Child Safe Standards Standard 9** balances that against the child's right to privacy. Chosen model (per owner decision): admins *can* read for investigation/safeguarding, and that access should be accountable. **Follow-up owed:** (1) log admin DM reads (needs-basis, accountable); (2) a "report conversation" flow so access is report-triggered. Not legal advice — confirm against the org's Child Safety Policy.

**Reversible by:** `alter table public.<t> disable row level security;` for each of the 8 tables, plus `drop function if exists public.is_dm_participant(uuid);`.

### 0013 — `profiles.role` update lock

**File:** `supabase/migrations/0013_profiles_role_lock.sql`
**Status:** Applied 2026-07-02. Verified via JWT impersonation (4/4: self-promote blocked, non-role field updates while role pinned, admin can change, postgres/server bypasses).
**Risk:** Low. Adds a `BEFORE UPDATE` trigger + function; no schema or data change.

**What it does:** Closes checklist A8 / Known caveat §1. `profiles_update_own` (from 0004) lets a user UPDATE any column on their own row, including `role`. This adds `public.enforce_profiles_role_lock()` (`SECURITY INVOKER`, pinned `search_path`) + a `BEFORE UPDATE` trigger that silently reverts `role` to its OLD value unless the caller is an admin (`is_admin()`) or a trusted server context (`current_user not in ('authenticated','anon')` → postgres/service_role). Mirrors the silent-revert pattern of 0007.

**Why it matters:** the authoritative role lives in `auth.users.app_metadata` (server-only) and every policy reads role from `auth.jwt()`, so a self-set `profiles.role` grants no access *today*. This pins the display column too, so any future code path that trusts `profiles.role` for authz can't become a privilege-escalation vector.

**Reversible by:**
```sql
drop trigger if exists profiles_role_lock on public.profiles;
drop function if exists public.enforce_profiles_role_lock;
```

### 0014 — rate limiting

**File:** `supabase/migrations/0014_rate_limits.sql`
**Status:** Applied 2026-07-02. Function verified (fixed-window allow-then-deny + window-reset PASS).
**Risk:** Low. New table + function; no existing data touched.

**What it does:** Backend rate limiting (checklist B3 / C4). Adds `public.rate_limits (bucket, identifier, window_started_at, count)` and `public.check_rate_limit(bucket, identifier, max, window_seconds) returns boolean` — an atomic fixed-window counter (upsert with a CASE that resets once the window elapses; all SET expressions see the pre-update row so window/count stay consistent). Postgres-backed so it works across serverless instances.

**Access:** RLS enabled with an explicit deny-all policy (`rate_limits_no_client_access`, `using(false)`) plus `revoke all` from anon/authenticated — unreachable via the client SDK. `EXECUTE` on `check_rate_limit` is **revoked from public/anon/authenticated** too: because the function increments the counter, a granted client could call it with a victim's identifier to lock them out (broken access control / DoS). Only the owner (postgres role, used by Drizzle) executes it. Consumed server-side by `src/lib/rate-limit.ts` (login action, DM send, discussion thread/reply).

**Reversible by:**
```sql
drop function if exists public.check_rate_limit(text, text, integer, integer);
drop table if exists public.rate_limits;
```

---

## Access matrix

Read access. "✓" = full row visibility for own data; "limited" = subset of columns or rows; "no" = denied at RLS level.

| Table                  | Anon | Student          | Parent                  | Tutor                          | Admin |
|------------------------|------|------------------|-------------------------|--------------------------------|-------|
| `profiles`             | no   | own row          | own + linked children   | own + enrolled students        | all   |
| `family_links`         | no   | own (as student) | own (as parent)         | no                             | all   |
| `subjects`             | no   | all              | all                     | all                            | all   |
| `classes`              | no   | enrolled in      | child enrolled in       | own taught                     | all   |
| `enrollments`          | no   | own              | child's                 | for own classes                | all   |
| `lessons`              | no   | enrolled in      | child enrolled in       | own taught                     | all   |
| `lesson_notes` (base)  | no   | **no** — use view| **no** — use view       | own taught                     | all   |
| `lesson_notes_safe`    | no   | own (no internal_note) | child's (no internal_note) | own taught (no internal_note) | all |
| `attendance`           | no   | own              | child's                 | for own lessons                | all   |
| `homework`             | no   | assigned to      | child assigned to       | own authored                   | all   |
| `homework_assignments` | no   | own (R+U\*)      | child's (R)             | for own homework               | all   |
| `progress_topics`      | no   | own              | child's                 | for own students               | all   |
| `invoices`             | no   | own (as student) | own (as parent)         | no                             | all   |
| `announcements`        | no   | by audience      | by audience             | by audience                    | all   |
| `notifications`        | no   | own (R+U-read)   | own (R+U-read)          | own (R+U-read)                 | all   |
| `tutor_availability`   | no   | no (RLS)\*\*     | no (RLS)\*\*            | own                            | all   |
| `subject_topics`       | no   | all              | all                     | all                            | all   |
| `tutor_week_sections`  | no   | enrolled with section's tutor | child enrolled with section's tutor | own (tutor_id match) | all |
| `tutor_week_attachments` | no | enrolled with section's tutor | child enrolled with section's tutor | own (via parent section) | all |
| `terms`                | no   | all              | all                     | all                            | all   |
| `subject_weeks`        | no   | all              | all                     | all                            | all   |
| `student_week_progress`| no   | own              | child's                 | no                             | all   |
| `discussion_threads`   | no   | all              | all                     | all                            | all   |
| `discussion_replies`   | no   | all              | all                     | all                            | all   |
| `dm_threads`           | no   | participant      | participant             | participant                    | all (read) |
| `dm_messages`          | no   | participant      | participant             | participant                    | all (read) |
| `dm_reads`             | no   | own              | own                     | own                            | own   |

\* `homework_assignments` UPDATE by student is row-restricted but **not** column-restricted — see Known caveats.
\*\* student/parent portals read this via server-side Drizzle (bypasses RLS); not a real restriction in practice.

Write access. INSERT/UPDATE/DELETE; service_role bypasses all of this.

| Table                  | Student              | Parent | Tutor                          | Admin |
|------------------------|----------------------|--------|--------------------------------|-------|
| `profiles`             | UPDATE own           | —      | —                              | all   |
| `family_links`         | —                    | —      | —                              | all   |
| `subjects`             | —                    | —      | —                              | all   |
| `classes`              | —                    | —      | —                              | all   |
| `enrollments`          | —                    | —      | —                              | all   |
| `lessons`              | —                    | —      | UPDATE own taught              | all   |
| `lesson_notes`         | —                    | —      | INSERT/UPDATE/DELETE own taught| all   |
| `attendance`           | —                    | —      | INSERT/UPDATE for own lessons  | all   |
| `homework`             | —                    | —      | INSERT/UPDATE/DELETE own       | all   |
| `homework_assignments` | UPDATE own row\*     | —      | INSERT/UPDATE for own homework | all   |
| `progress_topics`      | —                    | —      | INSERT/UPDATE for own students | all   |
| `invoices`             | —                    | —      | —                              | all   |
| `announcements`        | —                    | —      | —                              | all   |
| `notifications`        | UPDATE own (read_at) | —      | —                              | all   |
| `tutor_availability`   | —                    | —      | INSERT/UPDATE/DELETE own       | all   |
| `subject_topics`       | —                    | —      | —                              | all   |
| `tutor_week_sections`  | —                    | —      | INSERT/UPDATE/DELETE own       | all   |
| `tutor_week_attachments` | —                  | —      | INSERT/UPDATE/DELETE own\*\*\* | all   |
| `terms`                | —                    | —      | —                              | all   |
| `subject_weeks`        | —                    | —      | —                              | all   |
| `student_week_progress`| INSERT/UPDATE own    | —      | —                              | all   |
| `discussion_threads`   | author own (I/U)     | author own (I/U) | author own (I/U)     | all   |
| `discussion_replies`   | author own (I/U)     | author own (I/U) | author own (I/U)     | all   |
| `dm_threads`           | participant          | participant | participant               | — (read-only) |
| `dm_messages`          | INSERT own (sender)  | INSERT own (sender) | INSERT own (sender) | — (read-only) |
| `dm_reads`             | own                  | own    | own                            | own   |

\*\*\* "own" for `tutor_week_attachments` means the attachment's parent section is owned by the caller (`is_owner_of_tutor_section`).

---

## Adding a new policy

1. **Identify the access pattern.** Simple column match (`x = auth.uid()`) goes inline. Cross-table lookups MUST go through a `SECURITY DEFINER` helper to avoid RLS recursion.
2. **Add a helper if needed.** Helpers live alongside the existing ones in 0004. Pattern: `language sql stable security definer set search_path = public, auth`. Body must only return `true`/`false` about the caller's relationships — never return data.
3. **Drop-and-create the policy in a new migration** (`supabase/migrations/000N_<topic>.sql`). Always include `drop policy if exists` before `create policy` so the migration is re-runnable.
4. **Wrap in `BEGIN/COMMIT`** if the migration touches more than one policy. Atomic apply prevents a half-locked state.
5. **Verify with a JWT impersonation script.** Pattern: `set local role authenticated; set local request.jwt.claims = '...';` inside a transaction, then test positive (returns expected rows) and negative (returns 0) cases. Also test anon.
6. **Apply via `scripts/apply-sql.mjs`** — prefers `DIRECT_URL` (session pooler) which is required for DDL.
7. **Append a migration log entry to this file** with status, risk, what-it-does, reversibility.

### Forbidden patterns

- **Inline cross-table EXISTS in policies** — use a `SECURITY DEFINER` helper instead. Recursion 42P17 is the failure mode.
- **`SECURITY DEFINER` helpers without pinned `search_path`** — search-path injection attack vector.
- **`SECURITY DEFINER` helpers that return data** — they bypass RLS, so any data they return leaks. Return bool only.
- **Re-defining policies in Drizzle (`src/db/schema.ts`)** — Drizzle owns table DDL; policies/triggers/views/grants live in `supabase/migrations/`.

---

## Known caveats

These are documented compromises, not currently-exploitable bugs. Worth fixing as follow-ups.

### 1. `profiles.role` is user-editable

`profiles_update_own` lets a user UPDATE any column on their own profile row, including `role`. The `role` column on `profiles` is for display/joins only — the authoritative role lives in `auth.users.raw_app_meta_data` (which the user **cannot** modify). Every other table's RLS policy reads role from `auth.jwt()`, not from `profiles.role`. Changing your own `profiles.role` grants no access.

**Fix:** column-level `REVOKE UPDATE (role)` from authenticated, or a `BEFORE UPDATE` trigger that resets `role` to its prior value unless the caller is admin.

### 2. `homework_assignments` UPDATE is not column-restricted

`homework_assignments_student_update` allows the student to UPDATE any column on their own assignment row, including `score`, `feedback`, `marked_at`, `marked_by`. The student portal API code MUST restrict the column set in `UPDATE` statements.

**Fix:** split submissions into a `SECURITY DEFINER` function that only writes the student-mutable subset, or use column-level UPDATE grants.

### 3. ~~Auth code reads `user_metadata` first~~ — FIXED 2026-05-27

`src/lib/auth.ts`, `src/lib/supabase/middleware.ts`, `scripts/seed-users.mjs`, `scripts/seed-demo.mjs` now read/write `app_metadata.role` first, with `user_metadata.role` as a fallback only for users who predate migration 0002's backfill.

History: the original flip was made on 2026-05-25 but reverted by a salvage merge that day. Restored 2026-05-27.
