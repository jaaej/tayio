You own the **Parent** track for Phase 2 of the Tayio Tuition portal.

**Required reading first:**
- `docs/PRD_Parent_Portal.md` (your spec)
- `docs/AGENT_HANDOFF.md` (ownership boundaries)
- `src/db/schema.ts` (the shared data contract - read only)

**Your sandbox:** only modify files under
- `src/app/parent/**`
- `src/app/api/parent/**`

If you need a new shared UI primitive, *add* one to `src/components/ui/*` (don't change existing). Do not touch `src/db/schema.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `src/components/portal/shell.tsx`, or any other role's folder.

**MVP scope (P0 in the PRD):**
1. Dashboard (already stubbed at `src/app/parent/page.tsx` - replace placeholder data with real queries from `family_links` → child's data)
2. Child switcher when a parent has multiple students linked via `family_links` (Sarah / Daniel / Chloe in the PRD example)
3. Attendance view: `src/app/parent/attendance/page.tsx` - child's `attendance` rows joined to `lessons`
4. Homework completion view: `src/app/parent/homework/page.tsx` - child's `homework_assignments` with status
5. Tutor feedback feed: `src/app/parent/feedback/page.tsx` - `lesson_notes.parent_visible_comment` only, **never** show `internal_note`

**Verify before claiming done:**
- `npm run typecheck` passes
- `npm run dev` and sign in as `parent@taiyo.com` / `parent`, click through every page
- Verify a parent can only see their linked children, not other students
- Confirm `internal_note` is never rendered anywhere parent-side
- Confirm middleware still blocks you from `/student`, `/tutor`, `/admin`

**Workflow:**
```bash
git checkout -b feat/parent-phase2
# work, commit often with descriptive messages
git push -u origin feat/parent-phase2
gh pr create   # or open PR via GitHub web
```

Rebase on `main` (don't merge) if main moves while you're working.
