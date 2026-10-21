# Microcopy purge + curriculum colour/toggle + admin/users filter redesign (2026-08-08)

## 1. Redundant-microcopy purge (all four portals)

Enforcing the CLAUDE.md non-negotiable ("no redundant subtitles or state-narration"). Removed ~35 descriptive subtitles, state-narration lines, and info duplicated elsewhere on the same screen. These were removed deliberately - do NOT re-add them.

Removed `sub=` / `subtitle=` / `description=` descriptive props on:
- **admin**: quizzes, attendance, payments, announcements, tutors/availability, revenue, reschedules, reports, discussions.
- **tutor**: discussions, notes, attendance, classes ("N students · M lessons"), classes/[id]/students ("N enrolled"), timetable, resources, quizzes.
- **student**: subjects ("Tap a subject…", "N subjects · M homework open"), timetable ("Click a lesson…", "Browse upcoming…", + the duplicate "{firstName}'s schedule" CardHead under the "Your schedule" PageHead), messages, homework (the "N open · X/Y done" that duplicated the stat tiles below), discussions, progress ("Across all subjects" re-labelling the "Overall" number).
- **parent**: dashboard greeting ("Here's how … tracking this week"), feedback (x2), classes schedule instruction, reschedule.

Component change: `DiscussionsBoardsView` `subtitle` is now optional (`src/components/discussions/boards-view.tsx`).

`src/components/student/subject-card.tsx`: removed the "Mastery {n}%" text (the `ProgressRing` already shows the number) and the "Next · … / No upcoming class" line (duplicated the dashboard "This week" calendar). The `nextLabel` prop was dropped from the component + both call sites (dashboard, subjects index). The mastery ring stays as a glanceable visual.

**Kept (functional, not redundant):** lesson date/time/location, homework attachment links, "N overdue" actionable counts, payment status tiles. The tutor dashboard `RichHeader` taglines were left (status + encouragement, not duplicated) pending an owner call on tone.

## 2. Curriculum page (student)

- Subject **colour restored** on the hero banner + the "Year 9 English" header title/initial tile (the page's anchor). Rest stays neutral.
- Weeks rail is now **click-to-toggle** (not hover): press the "Weeks" tab to open; it PUSHES the content (grid column animates, content shrinks), a close chevron collapses it, and the open/closed state persists across week navigation (`src/components/subjects/curriculum-layout.tsx`).

## 3. admin/users - per-column header filters

The top filter row is gone. Filters now sit in the table header next to the column they act on: a two-state A-Z/Z-A **sort** on Name, and funnel **filter** dropdowns on Role, Year/School, and Status (`src/app/admin/users/_components/user-table-filters.tsx`, native `<select>` overlaid for a11y/mobile, URL-driven). Controls + admin `Button` are rectangular (`rounded-[8px]`, not pills); the shared `ui/input` + `ui/select` radius was tightened `rounded-xl` -> `rounded-[10px]` (app-wide). Low-contrast inputs use the stronger `border-line-field` (#8790ad) so they read against the white card.

## 4. Follow-up polish (same day)

- **Action buttons reverted to pill.** Admin `Button` sizes went back to `rounded-full` (owner reversed the earlier rectangular call). The table-header filter/sort controls stay `rounded-[8px]` (they are controls, not action buttons). Shared `ui/input`/`ui/select` stay rectangular `rounded-[10px]` app-wide (owner confirmed).
- **Count pills purged from admin headers.** Removed the "N quizzes / N classes / N resources / N notices / N accounts" state-narration pills (`admin/quizzes`, `classes`, `resources`, `announcements`, `users`). Kept `admin/revenue`'s "Unlocked" pill (real status). Also removed a stray `admin/resources` descriptive subtitle.
- **Admin CardHead legibility.** `src/components/admin/ui/card.tsx` CardHead now reads as a header band: faint `bg-surface-2` fill, `border-b border-line-strong` (was near-invisible `border-line`), title bumped to `text-[15px] font-extrabold`. Applies to every admin card.
- **Tutor dashboard taglines stripped.** The `RichHeader` `tagline` is now optional and the two chatty taglines on `/tutor` ("Everyone's on track…", "N fresh submissions waiting", etc.) were removed. Title + count badge remain.
- **admin/users mobile filter sheet.** New `src/app/admin/users/_components/user-mobile-filters.tsx` - a `lg:hidden` collapsible "Filters" panel (Role / Year-School / Status / Name-sort) above the Accounts table, sharing the same URL params as the desktop header controls. Desktop unchanged. (Desktop header controls are left present-but-scrolled-off on mobile; harmless, in sync via URL.)

## Verification
- `npx tsc --noEmit` clean · `npm run test` 87/87 · `npm run build` compiles all 48 routes.

## Pending owner browser QA (NONE of this session's UI has been clicked through)

Curriculum (all 4 roles):
- [ ] Student: coloured hero + header; weeks tab click-to-open PUSHES content + persists across weeks; objectives checklist renders when set; mobile stacks the rail.
- [ ] Parent / tutor / admin curriculum still render (rail, content block, objectives read-only where applicable).
- [ ] Enter objectives on a week as admin -> confirm they show for student/parent/tutor.

Microcopy purge:
- [ ] Spot-check a page per portal (admin/quizzes, tutor/classes, student/subjects, parent) - no orphaned/empty header where a subtitle was removed; headings still read cleanly.

admin/users:
- [ ] Desktop: set each per-column filter (Role/School/Status) + Name sort; confirm active chip renders and grouping/URL behave.
- [ ] Empty result: header controls survive (table still renders the "No accounts" row).
- [ ] Mobile (<lg): "Filters" sheet opens, all four controls work, active-count badge correct.
- [ ] Buttons are pill again; inputs read against the white card (line-field border).

Admin cards:
- [ ] CardHead band reads as a distinct header vs body across a few admin pages.

Data:
- [ ] Migration 0038 (`subject_weeks.objectives`) is applied to the connected DB (done) - and must be applied to prod before deploy.
