You own the **Parent** portal redesign on your current branch.

**Step 0 — required before writing any code:** invoke these two skills in order so every visual decision is grounded:
1. Skill: `frontend-design:frontend-design`
2. Skill: `ui-ux-pro-max:ui-ux-pro-max`

Follow their guidance for typography, motion, contrast, touch targets, accessibility. Don't make a styling choice that contradicts either.

Apply the design language of the student dashboard (`src/app/student/page.tsx`) to the parent portal, **but the dashboard layout and content must be parent-specific** — different from student. Roles share visual primitives, not interfaces.

**Required reading**

- `src/db/schema.ts` — data contract (read only)
- `src/app/student/page.tsx` — visual reference for design language
- `docs/PRD_Parent_Portal.md` — feature spec
- `docs/AGENT_HANDOFF.md` — boundaries

**Your sandbox**

Modify only:
- `src/app/parent/**`
- `src/app/api/parent/**`

**Off-limits** (do not modify, only import from):
- `src/db/schema.ts`
- `src/lib/auth.ts`, `src/middleware.ts`
- `src/components/portal/shell.tsx`
- `src/components/ui/*`, `src/components/data/*`
- Any other role's folder (no peeking at student/_lib either — use the shared `src/lib/*`)

**Shared primitives — USE these, don't reinvent**

UI components:
- `<MiniWeekCalendar>` — `src/components/data/mini-week-calendar.tsx`
- `<ProgressBar>` / `<MasteryBar>` — `src/components/data/progress-bar.tsx`
- `<StatTile>` — `src/components/data/stat-tile.tsx`
- `<ScoreBadge>` — `src/components/data/score-badge.tsx`
- `<StatusBadge>` — `src/components/data/status-badge.tsx`
- `<Card>`, `<CardLabel>` — `src/components/ui/card.tsx`
- `<Button>` — `src/components/ui/button.tsx`

Helpers (import from `@/lib/format` and `@/lib/status`):
- All formatters: `formatTime`, `formatDateLong`, `formatDueDate`, `formatMoney`, `relativeTime`, `startOfMondayWeek`, `isoDate`
- All status maps: `ATTENDANCE_STATUS_LABEL/STYLE`, `HOMEWORK_STATUS_LABEL/STYLE`, `INVOICE_STATUS_LABEL/STYLE`, etc.

If you need a new shared primitive, **stop and ask the user**.

**Parent dashboard — what's different from student**

The parent isn't looking at *their own* work. They're watching their child(ren). The dashboard answers:

1. **Which child am I viewing?** A child switcher must be prominent — the existing `ChildSwitcher` is at `src/app/parent/_components/child-switcher.tsx`. Keep or refine; don't delete.
2. **Is my child attending?** Attendance rate, recent attendance pattern.
3. **Are they doing the work?** Homework completion rate (e.g., "11 / 12 on time"), not their own homework list.
4. **What did the tutor say?** Latest `parent_visible_comment` from `lesson_notes`. **Never render `internal_note`** — it's tutor/admin only.
5. **When is the next lesson?** From the selected child's perspective.
6. **Do I owe money?** Outstanding invoice balance with a "Pay" / "View invoices" link.
7. **Any announcements for parents?** Audience-scoped.

Suggested layout (use your judgement):
- Title + child switcher at top
- Stat strip: attendance %, homework completion ratio, next lesson, outstanding balance
- Main + aside grid (same shape as student, different content):
  - Main: tutor feedback feed, attendance recent history, upcoming lessons for the child
  - Aside: child's topic mastery, payments status, announcements

**Pages to ship (the routes already exist as stubs):**
- `/parent` (overview dashboard — the main thing)
- `/parent/attendance`
- `/parent/homework` (their child's homework status — read only)
- `/parent/feedback` (lesson notes feed)
- `/parent/payments` (invoices list — read + a "Pay" stub for now)

**Critical safety**

- Parent only sees data for kids linked via `family_links` where `parent_id = current user`. Enforce in your queries.
- `lesson_notes.internal_note` must NEVER appear anywhere parent-side.

**Verify before claiming done**

```bash
npm run typecheck
npm run dev -- --port 3002
```

Sign in as `parent@taiyo.com / parent`. Walk every page. Switch between children if multiple are linked. Confirm middleware blocks you from `/student`, `/tutor`, `/admin`.

**Workflow**

```bash
git push -u origin <your-branch>
```

When done: tell the user *"done — branch pushed"*.
