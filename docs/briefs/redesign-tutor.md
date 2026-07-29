You own the **Tutor** portal redesign on your current branch.

**Step 0 - required before writing any code:** invoke these two skills in order so every visual decision is grounded:
1. Skill: `frontend-design:frontend-design`
2. Skill: `ui-ux-pro-max:ui-ux-pro-max`

Follow their guidance for typography, motion, contrast, touch targets, accessibility. Don't make a styling choice that contradicts either.

Apply the design language of the student dashboard (`src/app/student/page.tsx`) to the tutor portal, **but the dashboard layout and content must be tutor-specific** - different from student. Roles share visual primitives, not interfaces.

**Required reading**

- `src/db/schema.ts` - data contract (read only)
- `src/app/student/page.tsx` - visual reference for design language
- `docs/PRD_Tutor_Portal.md` - feature spec
- `docs/AGENT_HANDOFF.md` - boundaries

**Your sandbox**

Modify only:
- `src/app/tutor/**`
- `src/app/api/tutor/**`

**Off-limits** (do not modify, only import from):
- `src/db/schema.ts`
- `src/lib/auth.ts`, `src/middleware.ts`
- `src/components/portal/shell.tsx`
- `src/components/ui/*`, `src/components/data/*`
- Any other role's folder

**Shared primitives - USE these, don't reinvent**

UI components: `<MiniWeekCalendar>`, `<ProgressBar>`, `<StatTile>`, `<ScoreBadge>`, `<StatusBadge>`, `<Card>`, `<CardLabel>`, `<Button>` - all in `src/components/data/*` and `src/components/ui/*`.

Helpers: `@/lib/format` (all formatters), `@/lib/status` (all status maps).

If you need a new shared primitive, **stop and ask the user**.

**Tutor dashboard - what's different from student**

The tutor isn't a learner. The tutor is the one *teaching*. The dashboard answers:

1. **Who am I teaching today?** Today's classes in time order, each linking to a class detail page.
2. **What do I need to mark?** Count of `homework_assignments` for my students with status `submitted` (awaiting marking).
3. **Which lesson notes are overdue?** Completed lessons I taught in the last 7 days that have no `lesson_notes` row from me.
4. **Who are my students?** Roster across all my classes, click-through to individual profiles.
5. **What's on my schedule this week?** Week calendar of lessons I'm teaching.

Suggested layout:
- Title + today's date
- Stat strip: today's classes count, submissions awaiting marking, notes pending, this week's lesson count
- Main + aside:
  - Main: today's schedule (chronological), submissions to mark, lessons missing notes (link to write one)
  - Aside: week calendar, recent activity (students who improved, students at risk)

**Pages to ship:**
- `/tutor` (overview)
- `/tutor/classes` (classes I teach)
- `/tutor/students` (roster) + `/tutor/students/[id]` (profile)
- `/tutor/homework` (homework I've assigned, with submissions to mark) + `/tutor/homework/[id]` (mark UI)
- `/tutor/notes` (lessons I taught + write-note flow)
- `/tutor/lessons/[id]` (lesson detail - write attendance + note)
- `/tutor/availability` (stub OK)

**Critical safety**

- Tutor only sees classes where `tutor_id = current user` and lessons in those classes. Enforce in queries.
- `lesson_notes` form must visually separate `parent_visible_comment` and `internal_note` so a tutor doesn't accidentally write internal content into the parent-visible field. Label clearly: e.g., "Parent will see this" vs "Only you and admin see this".

**Verify before claiming done**

```bash
npm run typecheck
npm run dev -- --port 3003
```

Sign in as `tutor@taiyo.com / tutor`. Walk every page. Write a test lesson note with both fields. Confirm middleware blocks you from `/student`, `/parent`, `/admin`.

**Workflow**

```bash
git push -u origin <your-branch>
```

When done: tell the user *"done - branch pushed"*.
