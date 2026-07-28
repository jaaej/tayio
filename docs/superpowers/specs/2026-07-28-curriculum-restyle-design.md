# Student Curriculum Restyle - Design Spec

Date: 2026-07-28
Status: Approved (owner approved the design direction; proceeding to plan + build)
Target branch: `feat/curriculum-restyle` (off main)
Scope: student `/student/subjects/[id]` only. Translate to tutor + parent after owner browser approval.

## Context

The student curriculum page renders at `/student/subjects/[id]`.
Today it uses per-subject accent gradients on the rail, hero, and nearly every card, hardcoded bracket radii, a static always-expanded week rail (`week-strip.tsx`), and a full-page navigation (`?week=`) on every week change.
There is a dead, unused `week-sidebar.tsx` to remove.
The theme scope is `.theme-student` in `globals.css` (v2 cornflower palette); per-subject accents come from `ACCENT_TOKENS` in `src/lib/subject-colors.ts`, applied via inline styles.

The owner wants a minimalist restyle: a calm neutral canvas where colour is reserved for the important elements, softer non-rigid shapes, a collapsible week rail that expands on hover and can be pinned, and clean smooth motion.

## Goals

Restyle the student curriculum page to a neutral, minimalist system where subject colour is a spotlight (not decoration), with a slim collapsible week rail that hover-expands as an overlay and pins open, and smooth client-side week switching.

## Non-goals

- No change to the underlying curriculum data model, progress-marking actions, or what content a week contains.
- No change to the resource/quiz/homework features themselves - only their presentation on this page.
- No tutor/parent changes yet (a follow-up after owner approves the student look).

## Approved design decisions

### 1. Canvas and colour (neutral canvas, colour as spotlight)

- Remove per-subject gradient backgrounds from the rail, hero, and cards.
- The page becomes a neutral surface: `--background` page, white (`--surface`) cards, `--line` hairline borders, generous whitespace.
- Subject accent (from `ACCENT_TOKENS`) survives in exactly three places: a small subject-tinted tile beside the subject name in the header, the ACTIVE week indicator in the rail, and the progress ring/bar.
- Status stays semantic (`--good`/`--warn`/`--bad`) but expressed as a small dot on a neutral pill, not a full coloured bar.

### 2. Header (replaces the loud gradient hero)

- A calm header row: subject name with a small accent tile, a muted uppercase "Week N" eyebrow, the week title, and a slim progress indicator.
- Hierarchy carried by type (extrabold title, tight tracking; muted eyebrow), not colour.

### 3. Content cards

- Video, booklet, tutor-notes, quiz, and homework render as clean neutral cards: radii on the project scale (14/22), hairline borders, one subtle shadow tier, more padding.
- Replace the coloured left status bars with a neutral card plus a small status pill; colour only in the pill's dot.

### 4. The slim collapsible rail (signature interaction)

- Collapsed default: a ~56px slim strip listing week numbers, with the ACTIVE week accent-highlighted (the user always sees where they are). Includes a pin button and the term selector (as a compact control).
- Hover: smoothly expands to ~248px as an OVERLAY that floats over the content (content does not reflow), showing full week titles + homework chips + completion ticks.
- Pin: a pin toggle locks it open; the pinned state persists in `localStorage`. When pinned, the layout grid gives the rail a real 248px column (content sits beside it, no overlay).
- Motion: width/opacity transition ~200ms ease, `motion-reduce` guarded. The rail is keyboard accessible (focus reveals it; pin button is a real button with `aria-pressed`).

### 5. Motion and week switching (client-side)

- Week switching stops being a full server navigation. The active week is client state, so switching is instant with a subtle cross-fade (~200ms, `motion-reduce` guarded).
- Architecture: the rail's lightweight metadata (week number, title, completion, homework count) loads once server-side for all weeks. The heavier per-week content (with signed resource URLs) is fetched on demand via a lightweight server action when a week is selected, rendered with a cross-fade and a skeleton for any load exceeding ~200ms; the current and next week are prefetched so most switches are instant. This avoids signing every week's URLs upfront.
- The URL syncs shallowly (history `replaceState` or router shallow update with `?week=`) so deep links and refresh still land on the right week.

### 6. Shapes and type tokens

- Radii consolidated to the 14/22/28 scale; pill chips at 999px; one consistent shadow scale.
- Extrabold titles with tight tracking; uppercase muted eyebrows with wide tracking.
- No scattered bracket radii or hand-written arbitrary shadows.

## Architecture and files

Current files (from scout): `src/app/student/subjects/[id]/{page.tsx,_queries.ts,_actions.ts}` and `_components/{week-strip.tsx,week-content.tsx,video-player.tsx,booklet-link.tsx,week-sidebar.tsx (dead)}`. Shared primitives in `src/components/student/{card,pill,progress-ring}.tsx`. Accents in `src/lib/subject-colors.ts`. Theme in `globals.css`.

Planned shape:

- `page.tsx` (server): loads all weeks' rail metadata + the initially-selected week's full content; renders a new client shell.
- New `_components/curriculum-shell.tsx` (client): owns active-week state, rail collapsed/pinned state (localStorage), URL sync, and the cross-fade; composes the rail + the content area.
- New `_components/week-rail.tsx` (client): the slim/collapsed + hover-overlay + pinnable rail. Replaces `week-strip.tsx`.
- `_components/week-content.tsx` (restyled): neutral cards, header, status pills; receives the active week's content as a prop.
- New lightweight server action in `_actions.ts` (or `_queries.ts` server action) to fetch a single week's full content on switch, with signed URLs.
- Remove dead `_components/week-sidebar.tsx`.
- `video-player.tsx` / `booklet-link.tsx` keep their progress-marking behaviour; restyle only.
- `subject-colors.ts` accents retained but applied only in the three spotlight locations.

The `.theme-student` palette and semantic tokens are reused; no globals.css palette change is required (this is a token-usage and layout change, not a new palette).

## Verification

- Typecheck + build clean.
- Owner browser click-through (the real gate): rail collapses to a slim strip with the active week marked; hovering expands the full list as an overlay without reflowing content; pin locks it open and persists across reloads; switching weeks cross-fades smoothly with no full-page reload; deep-linking `?week=` still lands correctly; the page reads as neutral with colour only on the header tile, active week, and progress; reduced-motion disables the animations; layout holds at 375px mobile (rail behaviour degrades sensibly to a top control or drawer on narrow screens).
- No regression to progress marking (video watched, booklet opened) or to homework/quiz/notes links.

## Rollout

Student page only in this spec.
After owner approves the student look in the browser, a follow-up translates the same neutral system + rail to the tutor and parent curriculum views.
