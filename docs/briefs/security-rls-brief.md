You own the **Security & RLS** track. Right now the Postgres database has no row-level security - anyone with the anon JWT can read every row of every table. Your job is to lock it down.

**Required reading first:**
- `src/db/schema.ts` - every table you'll write policies for
- `src/lib/supabase/middleware.ts` and `src/lib/auth.ts` - how role is currently read (from `user_metadata`)
- `docs/AGENT_HANDOFF.md` - boundaries
- `docs/PRD_Student_Portal.md`, `PRD_Parent_Portal.md`, `PRD_Tutor_Portal.md`, `PRD_Admin_Portal.md` - the access matrix you need to enforce

**Your sandbox:**
- New folder: `supabase/migrations/` - SQL migration files for RLS + triggers
- New folder: `supabase/policies/` if you want to organise per-table policy files for clarity
- One surgical edit to `src/lib/auth.ts` and `src/lib/supabase/middleware.ts` - read role from `app_metadata` first, fall back to `user_metadata` (so we don't break existing sessions while migrating)
- One small edit to `scripts/seed-users.mjs` so new test users get `app_metadata.role` instead of `user_metadata.role`

Do not touch any `src/app/{student,parent,tutor,admin}/**` files - role frontend agents own those. Do not modify `src/db/schema.ts` itself; RLS lives in migrations, not in Drizzle schema.

**Scope:**
1. **Profile sync trigger** - Postgres function + trigger on `auth.users` that auto-creates a row in `public.profiles` with role + name pulled from the new user's metadata. Idempotent.
2. **Role hardening** - Migrate `role` from `user_metadata` (user-mutable!) to `app_metadata` (server-only). Backfill existing users via a one-time script or migration. Update `auth.ts` + `middleware.ts` to prefer `app_metadata.role`.
3. **RLS policies for every table:**
   - `profiles`: read own; admins read all
   - `family_links`: parent reads links where parent_id = auth.uid(); admin all
   - `subjects`: read for all authenticated users; write admin only
   - `classes`: students read classes they're enrolled in (via `enrollments`); parents read child's classes; tutors read classes they teach; admin all
   - `enrollments`: same shape as classes
   - `lessons`: same shape as classes
   - `lesson_notes`: tutor writes own; admin all; **students read only `parent_visible_comment` (NEVER `internal_note`)**; parents read only `parent_visible_comment` for their child's lessons
   - `attendance`: tutor writes own lessons; student/parent read own; admin all
   - `homework` + `homework_assignments`: tutor writes for own classes; student reads/updates own assignment row; parent reads child's; admin all
   - `progress_topics`: tutor writes for own students; student/parent read own; admin all
   - `invoices`: parent reads own; admin all writes
   - `announcements`: read by audience (role, class, or all); admin writes
   - `notifications`: user reads own only; service role writes
4. **Storage policies** - when homework attachments + submissions land, the storage bucket must enforce that students only read their own homework, only upload to their own submission path, etc. Even if the bucket isn't created yet, write the policies as migrations so they're ready.

**Verify before claiming done:**
- All migrations apply cleanly: `npx drizzle-kit push` still works AND your raw-SQL migrations run via Supabase CLI or psql
- Run a manual security test with the anon key: connect to Postgres as anon, try to `select * from profiles` as one user, confirm you only get your own row
- Sign in as `student@taiyo.com`, attempt to fetch another student's homework - should return zero rows
- Sign in as `parent@taiyo.com`, attempt to read `lesson_notes.internal_note` - column should be filtered out or the row hidden
- Admin can still see everything
- Document in `docs/SECURITY.md`: where policies live, how to add new ones, the access matrix as a table

**Workflow:**
```bash
git checkout -b feat/security-rls main
# write migrations, test against the live Supabase project
git push -u origin feat/security-rls
gh pr create
```

Rebase on `main` (don't merge) if main moves while you're working. Coordinate with the user before applying migrations to the live database - these changes are reversible but risky if rushed.
