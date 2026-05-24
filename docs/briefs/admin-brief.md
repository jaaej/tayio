You own the **Admin** track for Phase 2 of the Tayio Tuition portal.

**Required reading first:**
- `docs/PRD_Admin_Portal.md` (your spec)
- `docs/AGENT_HANDOFF.md` (ownership boundaries)
- `src/db/schema.ts` (the shared data contract — read only)

**Your sandbox:** only modify files under
- `src/app/admin/**`
- `src/app/api/admin/**`

If you need a new shared UI primitive, *add* one to `src/components/ui/*` (don't change existing). Do not touch `src/db/schema.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `src/components/portal/shell.tsx`, or any other role's folder.

**MVP scope (P0 in the PRD):**
1. Operations dashboard (already stubbed at `src/app/admin/page.tsx` — replace placeholders with real aggregate queries)
2. User management: list/create/edit/deactivate `profiles` across all roles, manage `family_links`
3. Class management: CRUD over `classes` (set subject, tutor, capacity, location, recurrence)
4. Enrolment management: add/remove students to/from `classes` via `enrollments`, manage withdrawals
5. Invoice list: read/create `invoices`, manual mark-as-paid (Stripe integration is Phase 3)
6. Announcements: write `announcements` rows scoped to role / class / all-users

**Verify before claiming done:**
- `npm run typecheck` passes
- `npm run dev` and sign in as `admin@tayio.com` / `admin`, click through every page
- Admin can see and edit data across all roles (this is the only role with full access)
- Destructive operations (delete user, cancel class) must confirm before executing
- All mutations should use the service role key on the server, never the anon key client-side
- Confirm middleware still blocks you from `/student`, `/parent`, `/tutor`

**Workflow:**
```bash
git checkout -b feat/admin-phase2
# work, commit often with descriptive messages
git push -u origin feat/admin-phase2
gh pr create   # or open PR via GitHub web
```

Rebase on `main` (don't merge) if main moves while you're working.
