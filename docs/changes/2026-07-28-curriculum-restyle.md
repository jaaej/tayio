# Student Curriculum Restyle

Date: 2026-07-28
Branch: `feat/curriculum-restyle`
Status: All four tasks implemented, typecheck and production build green.
Owner browser verification remains pending as of 2026-07-28.

## Requested outcomes

The owner wanted the student curriculum page, `/student/subjects/[id]`, moved from a loud per-subject-gradient look to a calm minimalist canvas where colour is reserved for the things that matter, with a slimmer week rail and smoother week switching.
This restyle covers the student page only.
Tutor and parent equivalents are a follow-up after owner approval of this direction.

Six design outcomes were approved and built.

1. Neutral canvas with colour as spotlight.
The page background, cards, and rail are now neutral surfaces using `bg-surface`, `bg-background`, and `border-line`.
Subject accent color survives in exactly three places: the header initial tile, the active week indicator in the rail, and the progress ring or bar.
Every other surface, including the video, booklet, tutor-notes, quiz, and homework cards, is neutral.

2. A slim collapsible rail that hover-expands as an overlay and can be pinned.
`week-rail.tsx` collapses to a 56px column of week-number buttons by default.
On hover or focus-within it expands to roughly 248px as an absolutely positioned overlay that floats over the content without reflowing the page.
A pin control keeps it expanded in normal document flow instead of as an overlay, and the pin state persists in `localStorage` across reloads.
The active week is accent-highlighted, completed weeks show a check, and each row shows an HW done/total chip.

3. Client-side instant week switching with a cross-fade.
`curriculum-shell.tsx` is a new client component that owns `activeWeekId` state and swaps which week's content renders without any network request or full page reload.
Switching weeks shallow-syncs the URL with `window.history.replaceState` so `?week=` stays deep-linkable, but does not call `router.push`, which would re-run the server component and lose the instant swap.
The swap is wrapped in a keyed container with a roughly 200ms opacity/translate cross-fade, guarded by `motion-reduce`.
Term switching is unchanged and still a full server navigation, since terms are rare and load a different data set.

4. Softer, non-rigid shapes.
Cards and controls move to the project's 14/22/28px radius scale in place of the previous harder-edged brackets, with a single subtle shadow tier and generous padding.

5. Status pills replace coloured bars.
The old full-width coloured status bars on video, booklet, and homework cards are replaced by a small neutral pill with colour confined to its status dot.

6. Dead rail removal.
`week-strip.tsx`, the previous always-expanded static rail, and `week-sidebar.tsx`, a pre-existing unused component with no importers, are both deleted.
A repo-wide grep confirmed no remaining references to either file before deletion.

## Architecture note: why week switching can be instant

`getStudentCurriculum` already loads every week's full content, including signed media URLs, for the selected term in a single server pass.
Because all of a term's weeks are already present in the page's props, switching the active week client-side is just picking a different already-loaded object out of an array; there is nothing left to fetch.
`curriculum-shell.tsx` composes this: the server page (`page.tsx`) still does the one data load and resolves the initially selected week, then hands the full `weeks` array plus lightweight rail metadata to the shell, which owns which week is "active" from then on.
Progress-marking actions in `video-player.tsx` and `booklet-link.tsx` call `router.refresh()` after a successful mark instead of `router.push()`.
`router.refresh()` re-runs the server component and delivers fresh `weeks` props, but React preserves the client shell's own `activeWeekId` and `pinned` state across that refresh, so the newly-ticked progress appears on the week the student is already looking at instead of bouncing them back to whatever week the URL or server logic would otherwise pick.
The accepted cost of this design is that every week's content, including every signed media URL, is generated and shipped on first load of the page even though the student may only look at one or two weeks in a sitting.
This is flagged here as a candidate for a follow-up performance pass, for example lazy-loading media URLs per week instead of signing them all upfront, if term sizes grow large enough for it to matter.

## Files touched

- `src/app/student/subjects/[id]/_components/week-rail.tsx` - new client component, the slim rail.
- `src/app/student/subjects/[id]/_components/curriculum-shell.tsx` - new client component, week state, URL sync, cross-fade, progress reconciliation.
- `src/app/student/subjects/[id]/page.tsx` - server page rewired to load all weeks and hand them to the shell; header restyled to neutral.
- `src/app/student/subjects/[id]/_components/week-content.tsx` - restyled to neutral cards.
- `src/app/student/subjects/[id]/_components/video-player.tsx` - restyled chrome, added `router.refresh()` after marking watched.
- `src/app/student/subjects/[id]/_components/booklet-link.tsx` - restyled chrome, added `router.refresh()` after marking opened.
- `src/app/student/subjects/[id]/_components/week-strip.tsx` - deleted, replaced by `week-rail.tsx`.
- `src/app/student/subjects/[id]/_components/week-sidebar.tsx` - deleted, pre-existing dead code with no importers.

## Still pending: owner browser checks

None of the following have been clicked through in a real browser yet, so the checklist row for this page stays at 🔶 rather than ✅ until they are confirmed.

- The rail collapses to the slim 56px strip, hover-expands as an overlay without pushing the content, and the pin toggles it into normal flow and persists across a reload.
- Switching weeks cross-fades smoothly with no full-page reload.
- The page reads as a neutral canvas with colour only on the header tile, the active week, and progress.
- Marking a video watched or a booklet opened updates its tick without the student losing their place on the active week.
- `?week=` and `?term=` deep links still land on the correct week and term.
- Reduced-motion settings disable the cross-fade and rail transitions.
- The layout holds up cleanly at a 375px mobile width.
