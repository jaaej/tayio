# Student Curriculum Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the student curriculum page to a neutral minimalist canvas with colour reserved for important elements, a slim collapsible week rail that hover-expands as an overlay and can be pinned, and smooth client-side week switching.

**Architecture:** `getStudentCurriculum` already loads ALL weeks' full content (including signed URLs) for the selected term in one server pass. So week switching becomes pure client state - an instant swap of already-loaded data with a cross-fade, no per-week fetch. Term switching stays a server navigation (rare). A new client `CurriculumShell` owns the active-week state, syncs `?week=` shallowly, and reconciles progress-marking updates via `router.refresh()` (which preserves client state). A new client `WeekRail` replaces the static `WeekStrip`. `WeekContent` is restyled to neutral cards. Colour survives only in the header tile, the active week, and progress.

**Tech Stack:** Next.js 16 App Router (RSC + client components), React 19, Tailwind v4, Drizzle, lucide-react. Student theme scope `.theme-student` (cornflower v2). Per-subject accents from `src/lib/subject-colors.ts`.

## Global Constraints

- Never use the em dash character; use a plain dash `-`.
- Commit messages: no co-author trailer.
- Long Markdown: one sentence per physical line.
- Student page ONLY (`/student/subjects/[id]`). No tutor/parent changes in this plan.
- Follow the project design language: radii on the 14/22/28 scale, `text-ink`/`text-muted`/`bg-surface`/`bg-background`/`border-line`, `brand-*`, extrabold titles with tight tracking, uppercase muted eyebrows. 44px min touch targets, visible focus rings, `motion-reduce` guards on every transition.
- Colour-as-spotlight: subject accent (`getAccentTokens`) appears ONLY in the header initial tile, the active week indicator, and the progress ring/bar. Everywhere else is neutral.
- Do NOT change the curriculum data model, `_queries.ts` data shape, or progress-marking server actions in `_actions.ts` (restyle their UI only).
- Preserve existing behaviour: video-watched / booklet-opened progress marking, homework/quiz/notes links, deep-linkable `?week=` and `?term=`.
- The vitest harness is pure-logic only; this is UI, so verification is typecheck + build + owner browser click-through. Do not add render/DB tests.
- Run `ui-ux-pro-max:ui-ux-pro-max` before UI work (repo-mandated) and apply its rules.
- Verify commands: `npm run typecheck`, `npm run build`. (If typecheck shows "Duplicate identifier" in `.next/types/*d 2.ts`, that is an iCloud artifact - `rm -rf .next` and re-run.)

---

## File Structure

- `src/app/student/subjects/[id]/_components/week-rail.tsx` - CREATE. The slim collapsible/hover-overlay/pinnable rail (client). Replaces `week-strip.tsx`.
- `src/app/student/subjects/[id]/_components/curriculum-shell.tsx` - CREATE. Client shell: active-week state, `?week=` shallow sync, cross-fade, pin persistence, progress reconciliation. Composes rail + content.
- `src/app/student/subjects/[id]/page.tsx` - MODIFY. Pass all weeks + accent + term info to `CurriculumShell`; restyle the header to neutral.
- `src/app/student/subjects/[id]/_components/week-content.tsx` - MODIFY. Restyle to neutral cards + spotlight colour; receive the active week as a prop.
- `src/app/student/subjects/[id]/_components/video-player.tsx` - MODIFY. Restyle chrome only; keep progress marking; after marking, trigger `router.refresh()`.
- `src/app/student/subjects/[id]/_components/booklet-link.tsx` - MODIFY. Restyle chrome only; keep progress marking; after marking, trigger `router.refresh()`.
- `src/app/student/subjects/[id]/_components/week-strip.tsx` - DELETE (replaced by week-rail).
- `src/app/student/subjects/[id]/_components/week-sidebar.tsx` - DELETE (pre-existing dead code, no importers).
- `docs/checklist.md`, `docs/superpowers/specs/2026-07-28-curriculum-restyle-design.md`, `docs/changes/2026-07-28-curriculum-restyle.md` - MODIFY/CREATE. Records.

---

## Task 1: WeekRail - the slim collapsible/hover-overlay/pinnable rail

**Files:**
- Create: `src/app/student/subjects/[id]/_components/week-rail.tsx`

**Interfaces:**
- Consumes: the existing week-strip item shape from `page.tsx` (`subjectWeekId`, `weekNumber`, `title`, `topicId`, `topicName`, `videoWatched`, `bookletOpened`, `homeworkTotal`, `homeworkDone`), plus `termsAvailable`, `currentTermId`, `subjectId`, and `accent` tokens.
- Produces: `WeekRail` (client component) with props:
  ```ts
  type WeekRailProps = {
    subjectId: string;
    currentTermId: string;
    termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
    weeks: Array<{ subjectWeekId: string; weekNumber: number; title: string;
      topicId: string | null; topicName: string | null;
      videoWatched: boolean; bookletOpened: boolean;
      homeworkTotal: number; homeworkDone: number }>;
    activeWeekId: string | null;
    currentWeekIdHint: string | null;
    onSelectWeek: (subjectWeekId: string) => void;
    pinned: boolean;
    onTogglePin: () => void;
    accent: ReturnType<typeof import("@/lib/subject-colors").getAccentTokens>;
  };
  ```

- [ ] **Step 1: Load ui-ux-pro-max and read the current rail**

Invoke `ui-ux-pro-max:ui-ux-pro-max`. Read the current `src/app/student/subjects/[id]/_components/week-strip.tsx` in full to reuse its week-item data handling, topic grouping, and completion/HW-chip logic; you are replacing its look and interaction, not its data.

- [ ] **Step 2: Build the rail**

Implement `WeekRail` as a neutral, collapsible rail:
- Collapsed (default when not pinned): a slim ~56px column. Each week is a 44px-tall button showing its `weekNumber`; the ACTIVE week gets the accent (e.g. `accent.arrow` text or a small accent fill/left-bar); completed weeks (video+booklet+all HW done) get a subtle check. A pin button sits at the top; the term selector is a compact control (icon-triggered or a small select) that navigates on change to `?term=<id>` (server nav via `window.location` or a `<Link>` - term switching is NOT client-only).
- Expanded (on hover when not pinned, or always when pinned): ~248px. Full week list grouped by topic (topic heading only when more than one topic), each row showing "Week N", the title (2-line clamp), a completion tick, and an HW `done/total` chip. The active row is accent-highlighted.
- Hover-expand overlay: when NOT pinned, the expanded rail is `absolute` and floats OVER the content (does not reflow it); it appears on `onMouseEnter`/focus-within and collapses on `onMouseLeave`/blur. Width/opacity transition ~200ms ease with `motion-reduce:transition-none`.
- Pinned: the expanded rail is in normal flow (the grid gives it a 248px column - handled by the shell in Task 2). The pin button toggles `onTogglePin` and shows `aria-pressed={pinned}`.
- Week rows call `onSelectWeek(subjectWeekId)` (NOT navigation) - they are `<button>`s, not links. Keyboard accessible; visible focus rings.
- Neutral surfaces: `bg-surface`/`bg-background`, `border-line`, `text-ink`/`text-muted`. NO per-subject gradient backgrounds. Accent only on the active/selected week and (optionally) the pin when active.

Keep the file focused on presentation + the callbacks; no data fetching, no URL logic (that is the shell's job).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`. Expected: the file compiles in isolation once Task 2 wires it (a temporary unused-import error is acceptable until Task 2). If `WeekRail` alone has type errors, fix them.

- [ ] **Step 4: Commit**

```bash
git add src/app/student/subjects/[id]/_components/week-rail.tsx
git commit -m "feat(curriculum): slim collapsible week rail with hover-overlay and pin"
```

---

## Task 2: CurriculumShell - client week state, URL sync, cross-fade, page rewiring

**Files:**
- Create: `src/app/student/subjects/[id]/_components/curriculum-shell.tsx`
- Modify: `src/app/student/subjects/[id]/page.tsx`

**Interfaces:**
- Consumes: `WeekRail` (Task 1); the full `data.weeks` array (type `StudentCurriculumWeek[]` from `_queries.ts`) and the derived rail items; `WeekContent` (Task 3, but wire against its current props now - it takes `week` + `subjectName`).
- Produces: `CurriculumShell` (client) props:
  ```ts
  type CurriculumShellProps = {
    subjectId: string;
    subjectName: string;
    currentTermId: string;
    termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
    weeks: StudentCurriculumWeek[];              // full content, all weeks
    railItems: WeekRailProps["weeks"];           // lightweight rail metadata
    initialWeekId: string;                        // the server-resolved selected week
    currentWeekIdHint: string | null;
    accent: ReturnType<typeof getAccentTokens>;
  };
  ```

- [ ] **Step 1: Build the shell**

Implement `CurriculumShell` (client):
- `const [activeWeekId, setActiveWeekId] = useState(initialWeekId)`.
- `const [pinned, setPinned] = useState(false)`; on mount, read `localStorage.getItem("curriculum-rail-pinned")` and set it (guard for SSR - read in a `useEffect`). `onTogglePin` writes it back.
- `onSelectWeek(id)`: `setActiveWeekId(id)` and shallow-sync the URL without a server navigation - `window.history.replaceState(null, "", \`?term=${currentTermId}&week=${id}\`)` (preserve term). Do NOT call `router.push` (that would re-run the server component and lose the smooth swap).
- Active week content: `const activeWeek = weeks.find(w => w.subjectWeekId === activeWeekId) ?? weeks[0]`.
- Cross-fade: wrap `WeekContent` in a keyed container (`key={activeWeekId}`) with an enter transition (opacity/translate ~200ms, `motion-reduce` guarded). A CSS `@keyframes` fade-in or a small `useState` transition class is fine; keep it lightweight.
- Layout: a grid whose left column is the rail. When `pinned`, the grid is `lg:grid-cols-[248px_minmax(0,1fr)]` (rail in flow). When not pinned, the grid is `lg:grid-cols-[56px_minmax(0,1fr)]` and the rail's expanded state is an overlay (Task 1 handles the overlay; the shell just reserves the 56px slot). Below `lg`, stack: render the rail as a top control/drawer (a simple collapsible list is acceptable for mobile; do not attempt the hover-overlay on touch).
- Compose `<WeekRail ... activeWeekId onSelectWeek pinned onTogglePin />` and the cross-faded `<WeekContent week={activeWeek} subjectName={subjectName} />`.
- Progress reconciliation: video-player/booklet-link (Task 3) call `router.refresh()` after marking. `router.refresh()` re-runs the server page, which passes fresh `weeks` props while React preserves this client component's `activeWeekId`/`pinned` state - so the active week re-renders with the new tick and the user stays put. No extra code needed here beyond using `useState` (not deriving active content from a prop that resets).

- [ ] **Step 2: Rewire page.tsx**

In `src/app/student/subjects/[id]/page.tsx`: keep the server data load and the `selectedWeek`/`currentWeekHint` resolution. Replace the `<WeekStrip>` + `<WeekContent>` block with a single `<CurriculumShell ... />`, passing `weeks={data.weeks}`, `railItems={weekStripItems}`, `initialWeekId={selectedWeek.subjectWeekId}`, `currentWeekIdHint={currentWeekHint}`, `accent={tokens}`, and the subject/term fields. Restyle the header block to neutral: keep the small accent initial tile + subject name, drop any gradient; use `border-line`, `bg-background`, muted back-link. Keep the full-bleed wrapper.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`. Expected: PASS. `WeekContent` still uses its current styling at this point (restyle is Task 3) - that is fine; the app must compile and week switching must be client-side.

- [ ] **Step 4: Commit**

```bash
git add src/app/student/subjects/[id]/_components/curriculum-shell.tsx src/app/student/subjects/[id]/page.tsx
git commit -m "feat(curriculum): client week switching via CurriculumShell with shallow URL sync"
```

---

## Task 3: Restyle WeekContent + media cards to neutral canvas / spotlight colour

**Files:**
- Modify: `src/app/student/subjects/[id]/_components/week-content.tsx`
- Modify: `src/app/student/subjects/[id]/_components/video-player.tsx`
- Modify: `src/app/student/subjects/[id]/_components/booklet-link.tsx`

**Interfaces:**
- Consumes: `activeWeek: StudentCurriculumWeek` + `subjectName` (unchanged props). `accent` tokens if needed for the progress element only.

- [ ] **Step 1: Load ui-ux-pro-max and read the current content**

Invoke `ui-ux-pro-max:ui-ux-pro-max`. Read `week-content.tsx`, `video-player.tsx`, `booklet-link.tsx` in full.

- [ ] **Step 2: Restyle to the neutral system**

Apply the spec's neutral-canvas / colour-as-spotlight system:
- Replace the loud gradient hero with a calm header row: muted uppercase "Week N" eyebrow, the week title (extrabold, tight tracking), and a slim progress indicator (the ONE place the accent/progress colour appears, e.g. the `ProgressRing` or a thin bar).
- Video / booklet / tutor-notes / quiz / homework become neutral cards: `bg-surface`, `border-line` hairline, radii on the 14/22 scale, one subtle shadow tier, generous padding. Remove the coloured left status bars; use a small status `Pill` with colour only in its dot.
- `booklet-link.tsx`: replace the old `rounded-lg border-hairline/60 bg-card ... hover:bg-brand-50` chrome with the neutral card system; keep the mark-booklet-opened behaviour and add a `router.refresh()` after a successful mark.
- `video-player.tsx`: keep the `<video>` + mark-watched behaviour; restyle the surrounding card; add `router.refresh()` after a successful mark.
- Keep all homework/quiz/notes links and their hrefs; only the presentation changes. Preserve `motion-reduce` guards and 44px targets.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`. Expected: PASS.

- [ ] **Step 4: Owner browser check (owner-run)**

The owner opens `/student/subjects/[id]` and confirms: neutral canvas with colour only on the header tile, active week, and progress; the rail collapses to a slim strip with the active week marked, hover-expands as an overlay without reflow, pins open and persists across reload; week switching cross-fades with no full-page reload; marking a video watched updates the tick without losing the active week; `?week=`/`?term=` deep links still work; reduced-motion disables animations; layout holds at 375px. Do not claim visual success before this.

- [ ] **Step 5: Commit**

```bash
git add src/app/student/subjects/[id]/_components/week-content.tsx src/app/student/subjects/[id]/_components/video-player.tsx src/app/student/subjects/[id]/_components/booklet-link.tsx
git commit -m "feat(curriculum): neutral canvas restyle of week content and media cards"
```

---

## Task 4: Remove dead code + records

**Files:**
- Delete: `src/app/student/subjects/[id]/_components/week-strip.tsx`
- Delete: `src/app/student/subjects/[id]/_components/week-sidebar.tsx`
- Modify: `docs/checklist.md`, `docs/superpowers/specs/2026-07-28-curriculum-restyle-design.md`
- Create: `docs/changes/2026-07-28-curriculum-restyle.md`

- [ ] **Step 1: Delete the replaced + dead rails**

Confirm no importers remain (`grep -rn "week-strip\|week-sidebar" src`), then delete both files.

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`. Expected: PASS (no dangling imports).

- [ ] **Step 3: Records**

Update `docs/checklist.md` (add/adjust a "Student curriculum restyle" row, FE 🔶 pending owner browser verification, name files + date 2026-07-28). Flip the spec Status line to implementation-complete-pending-browser-verification. Create `docs/changes/2026-07-28-curriculum-restyle.md` summarizing the neutral restyle, the client-week-switching architecture (all weeks preloaded, instant swap, term switch stays server), the new rail, the removed dead code, and the pending owner browser checks. One sentence per line. No em dash.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(curriculum): remove replaced rails; records for restyle"
```

---

## Self-Review

**Spec coverage:** neutral canvas + colour-as-spotlight -> Tasks 2 (header) + 3 (content). Slim collapsible hover-overlay + pin rail -> Task 1 + shell layout in Task 2. Client-side smooth week switching -> Task 2 (instant swap + cross-fade; corrected from the spec's fetch-on-switch since all weeks are preloaded). Softer shapes/tokens -> Task 3. Remove dead `week-sidebar` -> Task 4. Student-first, propagate later -> out of scope by design.

**Type consistency:** `onSelectWeek(subjectWeekId: string)`, `pinned`/`onTogglePin`, and `accent` are defined in Task 1 and consumed by the shell in Task 2. `activeWeekId`/`initialWeekId` are `string`. `WeekContent` keeps its current `{ week, subjectName }` props through Task 2 and is restyled in Task 3 without a prop change.

**Placeholder scan:** no TBDs; UI restyle steps intentionally give the token system + structure rather than full transcription, since the implementer reads the current files and the owner iterates the visual in-browser - the novel logic (rail interaction, shell state/URL sync/cross-fade, progress reconciliation) is specified concretely.
