# Curriculum weeks page - cross-role revamp (2026-08-06)

Owner-requested visual revamp of the curriculum "weeks" page, applied to **all four roles** (student, parent, tutor, admin) to keep the shared feature consistent.

## What changed

Three asks, all four roles:

1. **Colour only on the head block.**
The subject accent (the red-maths / amber-english rainbow) is now spent exactly once per page - on the per-week **hero head block**.
Everything else (the weeks rail, overview, lesson/booklet, tutor notes, quiz, homework) is neutral (`ink` / `surface` / `line` tokens), with semantic `good` / `warn` / `bad` only for status and the portal `brand` only for primary action buttons.
Page-header subject tints (initial tile + subject name) were also neutralised.

2. **Collapsible weeks tab.**
The left weeks rail can now be collapsed on desktop; the content column reclaims the width. State persists per portal in `localStorage`. Mobile always stacks the rail (collapse is a desktop affordance).

3. **One connected content block.**
Overview / Lesson + materials / Tutor notes / Quiz / Homework are now a single bordered block split by thin dividers, tied to the active week, instead of separate floating cards.

## New shared components (one implementation, reused by every role)

- `src/components/subjects/curriculum-rail.tsx` - `CurriculumRail`: neutral, topic-grouped weeks rail. Active week = neutral `ink` fill; "Now" + status via semantic tokens; generic `pills` + optional `footer` slot (admin "+ Add week"). Builds all links from `basePath` + optional `extraParams` (parent's `child` id).
- `src/components/subjects/curriculum-layout.tsx` - `CurriculumLayout`: collapsible two-column shell owning the collapse state; animates `grid-template-columns`; `motion-reduce` respected.

## Deleted (replaced by the two shared components above)

- `src/components/subjects/week-strip.tsx` (was shared by student + parent)
- `src/app/tutor/classes/[id]/curriculum/_components/week-strip-tutor.tsx`
- `src/app/admin/subjects/[id]/curriculum/_components/week-strip-admin.tsx`

This collapses the previous 3-way duplication of the weeks rail into one component.

## Files touched

- Student: `src/app/student/subjects/[id]/page.tsx` + `_components/week-content.tsx`
- Parent: `src/app/parent/subjects/[id]/page.tsx` + `_components/week-content.tsx` (gained a coloured hero head + unified block to match student; hero reflects the child's progress)
- Tutor: `src/app/tutor/classes/[id]/curriculum/page.tsx` + `_components/section-editor.tsx` (form logic untouched; only styling + block structure)
- Admin: `src/app/admin/subjects/[id]/curriculum/page.tsx` (already brand-neutral; swapped its strip for the shared collapsible rail; `WeekEditor` form left as-is)

## Follow-up (same day): learning objectives + rectangular rail

Two owner-requested additions after the first pass:

### 1. Weekly learning objectives ("By the end of this week you can")

Admin-set per-week objectives, shown to students, parents, and tutors as a two-column checklist inside the week Overview.

- **Migration `0038_subject_week_objectives.sql`** - additive nullable `subject_weeks.objectives text`, one objective per line. **APPLIED to the connected Supabase DB** (`db:check-rls` green, 46/46; inherits existing `subject_weeks` RLS, no policy change).
- Schema: `objectives` added to `subjectWeeks` in `src/db/schema.ts`.
- Admin entry: a "Learning objectives" textarea in `week-editor.tsx`; `weekInputSchema` in `actions-curriculum.ts` gained `objectives` (persists via the existing create/update spread).
- Threaded through `StudentCurriculumWeek` / `ParentCurriculumWeek` / `TutorCurriculumWeek` (type + mapping; the week fetch is a full-row select so no query column change was needed).
- Display: new shared `src/components/subjects/week-objectives.tsx` (purple `brand` eyebrow + check-square grid), rendered in the Overview of the student, parent, and tutor curriculum. Renders nothing when there are no objectives; the tutor "No overview set" placeholder now also accounts for objectives-only weeks.

Note: because the schema now references `objectives`, the migration had to be applied before the curriculum pages would load - done above.

### 2. Weeks rail is now one rectangular major block

`CurriculumRail` wraps the term selector + week list in a single **square-cornered (rectangular) bordered block** (`bg-surface-2`). The weeks stay as individual **rounded sub-cards** inside it (active card = `ink` fill), so the weeks read as subblocks of the one major rectangular block. The admin "+ Add week" is a rounded dashed sub-card at the end. Only the outer block is rectangular; sub-cards and the objectives block keep the normal rounded style, per the owner's choice.

## Follow-up refinements (same day, student page)

- **Rail attached + flush to top.** `CurriculumLayout` gained an `attached` mode (set on the student page): the rail block sits flush against the nav sidebar and reaches up to the header divider, with the content column carrying the page padding. The collapse control moved to a small floating handle on the rail's right edge so the rectangle runs edge-to-edge (no toggle row above it).
- **Term dropdown removed for learner views.** `CurriculumRail` gained `showTermSelect` (default true); student + parent pass `false` (current term auto-resolves; `?term=` still works via URL). Tutor + admin keep the term switcher (they work across terms).
- **Shadows.** Added elevation shadow to the weeks rail block and to the unified content block (student / parent / tutor).
- **Subject-coloured header.** The student subject title + initial tile are subject-tinted again (matching the hero), reversing the earlier full neutralisation of the page header (the per-week hero is no longer the *only* coloured element - the page title now echoes it).

Still page-scoped to student: the `attached` flush layout was applied to the student page only; the tutor curriculum (the other full-bleed page) keeps the padded layout for now - mirror on request.

## Verification (all passes)

- `npx tsc --noEmit` clean
- `npm run test` - 87/87 pass (13 files)
- `npm run build` - all four curriculum routes compile
- `npm run db:check-rls` - 46/46 tables green (after migration 0038)

**Pending owner browser QA** (per the success-claim rule this stays unverified until clicked through): collapse/expand + persistence on desktop, mobile stacking, hero-only colour across several subjects, the rectangular rail, the objectives checklist (enter objectives as admin → confirm they render for student/parent/tutor), and that the tutor edit forms (note/upload/link/promote/homework) still submit correctly after the restyle.
