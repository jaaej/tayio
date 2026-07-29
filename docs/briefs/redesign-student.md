You own the **Student** dashboard redesign on your current branch.

**Step 0 - required before writing any code:** invoke these two skills in order so every visual decision is grounded:
1. Skill: `frontend-design:frontend-design`
2. Skill: `ui-ux-pro-max:ui-ux-pro-max`

Follow their guidance for typography, motion, contrast, touch targets, accessibility. Don't make a styling choice that contradicts either.

The student dashboard on `main` is already redesigned. You're polishing it, NOT rebuilding. Read `src/app/student/page.tsx` to see the current state.

**Your goal**

Polish, fix anything broken, add small refinements the user discovers. You may also build out the other student routes that are still stubs (timetable, lessons list, progress, resources) using the same design language.

**Required reading**

- `src/db/schema.ts` - data contract (read only)
- `docs/PRD_Student_Portal.md` - feature spec
- `docs/AGENT_HANDOFF.md` - boundaries

**Your sandbox**

Modify only:
- `src/app/student/**`
- `src/app/api/student/**`

**Off-limits** (do not modify, only import from):
- `src/db/schema.ts`
- `src/lib/auth.ts`, `src/middleware.ts`
- `src/components/portal/shell.tsx`
- `src/components/ui/*`, `src/components/data/*`
- Any other role's folder

**Shared primitives - USE these, don't reinvent**

UI components:
- `<MiniWeekCalendar>` - `src/components/data/mini-week-calendar.tsx`
- `<ProgressBar>` / `<MasteryBar>` - `src/components/data/progress-bar.tsx`
- `<SubjectCard>` - `src/components/data/subject-card.tsx`
- `<StatTile>` - `src/components/data/stat-tile.tsx`
- `<ScoreBadge>` - `src/components/data/score-badge.tsx`
- `<StatusBadge>` - `src/components/data/status-badge.tsx`
- `<Card>` / `<CardLabel>` - `src/components/ui/card.tsx`
- `<Button>` - `src/components/ui/button.tsx`

Helpers:
- `formatTime`, `formatWeekday`, `formatDateLong`, `formatDueDate`, `formatMoney`, `relativeTime`, `startOfMondayWeek`, `isoDate` - `src/lib/format.ts`
- `LESSON_STATUS_LABEL/STYLE`, `HOMEWORK_STATUS_LABEL/STYLE`, `ATTENDANCE_STATUS_LABEL/STYLE`, `INVOICE_STATUS_LABEL/STYLE` - `src/lib/status.ts`

If you need a new shared primitive, **stop and ask the user** - don't fork.

**Design rules**

- Periwinkle palette only (no italic, no Instrument Serif)
- Sidebar navigation (already in shell)
- Sections use the established `Card` + section-header pattern (see student/page.tsx)
- Stat tiles where there's a number to surface
- Use `MiniWeekCalendar` for any week view of lessons + homework

**Verify before claiming done**

```bash
npm run typecheck
npm run dev -- --port 3001    # use a port other roles aren't on
```

Sign in as `student@taiyo.com / student`. Click through every page. Edge cases: empty timetable, no homework, no grades. Confirm middleware still blocks you from `/parent`, `/tutor`, `/admin`.

**Workflow**

You should already be on your branch. Work, commit often, push:

```bash
git push -u origin <your-branch>
```

When you're done: tell the user *"done - branch pushed"*. They'll merge.
