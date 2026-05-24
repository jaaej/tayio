You own the **Student** track for Phase 2 of the Tayio Tuition portal.

**Required reading first:**
- `docs/PRD_Student_Portal.md` (your spec)
- `docs/AGENT_HANDOFF.md` (ownership boundaries)
- `src/db/schema.ts` (the shared data contract — read only)

**Your sandbox:** only modify files under
- `src/app/student/**`
- `src/app/api/student/**`

If you need a new shared UI primitive, *add* one to `src/components/ui/*` (don't change existing). Do not touch `src/db/schema.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `src/components/portal/shell.tsx`, or any other role's folder.

**MVP scope (P0 in the PRD):**
1. Dashboard (already stubbed at `src/app/student/page.tsx` — replace placeholder data with real queries)
2. Timetable: `src/app/student/timetable/page.tsx` — lessons grouped by week, statuses from `lesson_status` enum
3. Homework list + submission flow: `src/app/student/homework/page.tsx` and detail route — read `homework_assignments` for this student, allow upload via Supabase Storage
4. Lesson recap viewer: `src/app/student/lessons/[id]/page.tsx` — `parent_visible_comment` only (never show `internal_note`)

**Verify before claiming done:**
- `npm run typecheck` passes
- `npm run dev` and sign in as `student@tayio.com` / `student`, click through every page you built
- Hit edge cases: empty homework list, missed lesson, lesson not yet started
- Confirm middleware still blocks you from `/parent`, `/tutor`, `/admin`

**Workflow:**
```bash
git checkout -b feat/student-phase2
# work, commit often with descriptive messages
git push -u origin feat/student-phase2
gh pr create   # or open PR via GitHub web
```

Rebase on `main` (don't merge) if main moves while you're working.
