You own the **Tutor** track for Phase 2 of the Tayio Tuition portal.

**Required reading first:**
- `docs/PRD_Tutor_Portal.md` (your spec)
- `docs/AGENT_HANDOFF.md` (ownership boundaries)
- `src/db/schema.ts` (the shared data contract — read only)

**Your sandbox:** only modify files under
- `src/app/tutor/**`
- `src/app/api/tutor/**`

If you need a new shared UI primitive, *add* one to `src/components/ui/*` (don't change existing). Do not touch `src/db/schema.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `src/components/portal/shell.tsx`, or any other role's folder.

**MVP scope (P0 in the PRD):**
1. Today dashboard (already stubbed at `src/app/tutor/page.tsx` — replace placeholders with real queries of today's `lessons` for this tutor)
2. Class list: `src/app/tutor/classes/page.tsx` — `classes` where `tutor_id` = current user
3. Student profile: `src/app/tutor/students/[id]/page.tsx` — student details + their `attendance`, `homework_assignments`, `lesson_notes` history (only for students the tutor teaches)
4. Attendance marking: in-lesson UI to write `attendance` rows
5. Lesson note form: write `lesson_notes` with two distinct fields — `parent_visible_comment` and `internal_note` (visually separated, clearly labelled)
6. Homework: upload (with attachment to Supabase Storage) + mark submissions in `homework_assignments`

**Verify before claiming done:**
- `npm run typecheck` passes
- `npm run dev` and sign in as `tutor@tayio.com` / `tutor`, click through every page
- A tutor must only see *their* assigned students/classes — enforce in queries, not just UI
- The two note fields must be clearly distinguished so a tutor never accidentally writes internal content into the parent-visible field
- Confirm middleware still blocks you from `/student`, `/parent`, `/admin`

**Workflow:**
```bash
git checkout -b feat/tutor-phase2
# work, commit often with descriptive messages
git push -u origin feat/tutor-phase2
gh pr create   # or open PR via GitHub web
```

Rebase on `main` (don't merge) if main moves while you're working.
