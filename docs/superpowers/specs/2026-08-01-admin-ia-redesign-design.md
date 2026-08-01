# Admin portal - information-architecture redesign

Date: 2026-08-01.
Status: design, pending owner approval.

## Goal

Make the admin portal traversable by a first-time, non-technical user with zero training.
This applies the "Intuitive navigation & information architecture" rule in CLAUDE.md, the same lens used on the tutor portal (`2026-08-01-tutor-ia-redesign-design.md`).

Unlike the tutor portal, the admin portal is deliberately handled with maximum conservatism.
Most of its ~17 nav items are genuinely distinct back-office functions that only look adjacent.
The honest finding is that admin has **almost no true tab redundancy to collapse** - its intuitive-nav defects are about labelling and dangling affordances, not overlapping destinations.
So this pass makes one small, undeniable label fix and flags the larger, more opinionated ideas for the owner rather than implementing them.

## Current admin IA

Shell: `src/components/admin/shell.tsx`, nav rendered by `src/components/admin/nav-links.tsx`.
Four sections, 17 items (Revenue is PIN-gated for reception, Settings is owner-only and hidden from reception - both preserved exactly):

- **Operations**: Operations (`/admin`), Users, Classes, Quizzes, Attendance, Reschedules, Tutor availability.
- **Schedule & money**: Terms, Payments.
- **Comms**: Announcements, Discussions, Resources, Messages, Notifications.
- **Insight**: Reports, Revenue, Settings.

Routes that exist but are intentionally not in the nav (already relocated in context, left dormant): `/admin/enrolments` (bulk enrolment; the per-class enrolment manager lives on `/admin/classes/[id]`), `/admin/leaving` (linked from the Users page's "Discontinued students" section), `/admin/subjects/[id]/curriculum` (opened from a class).

## Why almost nothing is being combined

Each item was checked against the intuitive-nav bullet "if two tabs surface the same data or the same task, combine them":

- **Attendance vs Reports** - Attendance corrects per-lesson marks; Reports is term-level analytics (attendance %, homework %, fill). Different grain, distinct. Keep.
- **Payments vs Revenue** - Payments is the operational invoice workflow (create invoice, who-has-paid); Revenue is the owner's PIN-gated finance figures. Distinct, and Revenue's gating must not move. Keep.
- **Reschedules** - a read-only monitoring table of class credits and term usage; its own header states there is no approval queue. Distinct oversight surface, not a duplicate of Attendance. Keep.
- **Comms cluster** - Announcements (one-way broadcast), Discussions (forum boards), Messages (1:1 DM), Notifications (shared system inbox), Resources (library moderation) are five different jobs. Keep all; the shared notification inbox is non-negotiable and untouched.
- **Quizzes** - an admin authoring + tutor-request hub, not just an inbox. Distinct from the tutor portal's quiz tab (which was removed because it was only an inbox). Keep.

## Change being made (1)

### Rename the `/admin` nav item from "Operations" to "Dashboard"

- File: `src/components/admin/shell.tsx` (nav item `label` only).
- CLAUDE.md bullet: **"Match labels to the user's mental model, not the database schema or internal role names"** and **reduce ambiguity for a first-time user**.
- Problem: the nav item labelled "Operations" lives inside the section heading also labelled "Operations", and the page it opens is titled "Dashboard".
  A first-time user reads "Operations > Operations", which looks like a broken menu, and the label does not match the page's own title.
- Fix: label the item "Dashboard" so it matches the page title (`title="Dashboard"` in `src/app/admin/page.tsx`) and no longer collides with its section heading.
  This mirrors the tutor shell, whose home item is labelled "Today", never the same as its "Teaching" section heading.
- Scope: display label only. `href`, icon, ordering, the section, and the `isActive` logic (which keys off `href`, not label) are untouched, so no routing or gating behaviour changes.

## Flagged for owner (NOT implemented)

These are real intuitive-nav observations, but each is opinionated, cross-cutting, or out of the conservative scope for this pass.
Left for an explicit owner decision rather than changed silently.

1. **Non-functional global search box.**
   The shell top bar renders a prominent search input ("Search users, classes, payments..." with a `⌘K` hint) that is a bare `<input>` in a server component with no handler - it does nothing.
   This dangles (a first-timer will try search first and hit a dead end), which violates "gate, don't dangle" and the no-stubs deploy-ready standard.
   Options: wire up real cross-entity search (a feature, out of this pass's scope), or hide the box until it works.
   Not touched here because both removing and building it are visible product decisions.

2. **Quiz authoring could move into curriculum**, matching the tutor redesign (quiz editing scoped to the curriculum week).
   Admin's Quizzes tab is a genuine authoring/request hub, so collapsing it is more opinionated than in the tutor case. Owner call.

3. **Settings sits under the "Insight" heading** alongside Reports and Revenue.
   Settings (Admin PIN config) is not analytics. It reads as loosely "owner/sensitive" next to the PIN-gated Revenue, but a dedicated owner/system grouping would be clearer.
   Not changed because a new section for one owner-only item risks over-structuring the nav.

4. **"Comms" vs the tutor portal's "Inbox" heading** - cross-portal wording is inconsistent.
   Aligning section labels across portals is worthwhile but is a multi-portal consistency decision, and this pass is scoped to the admin portal only.

5. **The "Operations" section is a 7-item catch-all** (Users, Classes, Quizzes, Attendance, Reschedules, Tutor availability, plus the dashboard).
   It could split into "People & classes" and "Scheduling", but any regrouping is judgment-heavy and reshuffles muscle memory, so it is flagged rather than done.

## Constraints honoured

- Stayed inside `src/app/admin/**` and `src/components/admin/**`; no shared components, shared `lib`, or DB schema touched.
- Tier gating untouched: `OWNER_ONLY_HREFS`, `isUnrestrictedAdmin` filtering, and the reception PIN-for-revenue flow are exactly as before.
- No width caps re-added; the recent max-width removal on admin pages is left intact.
- Relocate-don't-delete respected: no routes removed (nothing needed relocating for the one label change).

## Success criteria

- Admin nav's home item reads "Dashboard", matching its page title, with no item/section label collision.
- `npm run typecheck` clean and `npm run build` compiles.
- No change to which routes exist, to tier gating, or to page widths.
