# Project Rules

## General Guidelines (read first)

These apply to every agent working in this repo, ahead of everything below.

- Never use the em dash "—" in any output or file. Use a plain dash "-" instead.
- When writing commit messages, NEVER auto-add your agent name as co-author.
- Never manually modify CHANGELOG.md files or any files that are marked as auto-generated.
- When writing or substantially editing long Markdown files, put each full sentence on its own line.
  Preserve normal Markdown structure, but avoid wrapping multiple sentences onto one physical line.
- When making technical decisions, do not give much weight to development cost.
  Instead, prefer quality, simplicity, robustness, scalability, and long-term maintainability.
- When doing bug fixes, always start with reproducing the bug in an E2E setting as closely aligned with how an end user hits it as possible.
  This makes sure you find the real problem so your fix will actually solve it.
- When end-to-end testing a product, be picky about the UI you see and be obsessed with pixel perfection.
  If something clearly looks off, even if it is not directly related to what you are doing, try to get it fixed along the way.
- Apply that same high standard to engineering excellence: lint, test failures, and test flakiness.
  If you see one, even if it is not caused by what you are working on right now, still get it fixed.
- For any frontend or UI work, always load and follow the `ui-ux-pro-max:ui-ux-pro-max` skill before writing or changing UI.
  Run the requested change through its ruleset first, and push back when the change violates a rule.
  See the "UI/UX review mode (ui-ux-pro-max)" section below for how to apply it.

## Context

**Project:** `tayio_portal` - a web portal for a tutoring company, scoped across four PRDs in `docs/`: **Student** (homework, timetable, lesson recaps, resources, quizzes, progress), **Parent** (child progress, attendance, tutor feedback, invoices, make-up requests), **Tutor** (class list, student profiles, attendance marking, lesson notes with parent-visible vs. internal split, homework marking), and **Admin** (user management, class/enrolment management, payments, announcements, reporting, resource approval). Built on Next.js 16 (App Router) + React 19, Supabase auth (`@supabase/ssr`), Drizzle ORM over Postgres, Tailwind v4, Zod. Source under `src/` (`app/`, `components/`, `db/`, `lib/`, `middleware.ts`).

**Build order (from Admin PRD §15):** Phase 1 foundation (login, roles, four dashboards, schedule, user management) → Phase 2 learning workflow (homework, lesson notes, feedback, attendance, parent visibility) → Phase 3 admin ops (enrolments, classes, announcements, invoices, make-ups) → Phase 4 value-add (resources, quizzes, progress, reports) → Phase 5 advanced (AI summaries, mobile, payroll, calendar sync). P0 features should ship before any P1/P2 work.

**Cross-cutting non-negotiables from the PRDs:** role-based permissions are strict (students see only their own data, parents only their children's, tutors only assigned students, admins everything with audit logs); parent-child account linking is a first-class concept; payment statuses are a fixed enum (unpaid/paid/overdue/partially paid/refunded/cancelled); lesson notes split parent-visible vs. internal; notifications must route to the correct role per the matrices in each PRD.

## Notification experience consistency (non-negotiable)

- All four roles must use the shared notification inbox at `src/components/notifications/inbox-page.tsx`.
- Do not create or restore role-specific notification inbox layouts.
- Direct messages and action-needed notifications must have their own labelled dividers and must appear before announcements and general updates.
- New notification types must be classified in `src/lib/notification-groups.ts` and covered by its unit tests.
- A notification UI change is incomplete until its behaviour and styling are checked across admin, tutor, student, and parent routes.

## Cross-role UI & feature consistency (non-negotiable)

The notification rule above is one instance of a general law: **any feature or surface that appears in more than one role's portal (student / parent / tutor / admin) must look and behave the same in every role it appears in.**
This covers discussions, calendars and timetables, resource libraries, cards, tables, stat tiles, page headers, buttons, empty states, and any other shared concept.

- **One feature, one implementation.**
  A shared feature must be built as a single shared component and reused across roles, never reimplemented per role.
  If the same feature renders differently in different roles (e.g. a rich designed page for one role and a bare list for another), that is a bug to fix, not a per-role style choice.
- **Audit by feature, not just by token.**
  When reviewing or changing UI, open the SAME feature in all four roles and compare them directly.
  "The design tokens match" (fonts, colours, radii) is NOT the same as "the feature matches" - a token-only audit will miss a page that is elaborate in one role and skeletal in another. Always do the feature-parity pass.
- **Match each role's mental model (ties to the IA rule below).**
  A layout that is unintuitive for how a role actually works - e.g. a flat student list for a tutor who thinks in classes - is a defect even if it "works". Group and label by the real workflow.
- **Never silently defer a known inconsistency.**
  If you find a cross-role inconsistency you are not fixing in this pass, say so explicitly and record it. Do not quietly ship the inconsistent state, and do not report "consistent / done" when you only unified tokens and left the structure divergent.
- A cross-role UI change is incomplete until the same feature is verified to look and behave the same across admin, tutor, student, and parent.

**About the user:** solo builder shipping the portal as a personal/startup product. **Building toward the FINAL, deploy-ready product - not a throwaway MVP. Every change must be production-quality and shippable** (proper error handling, security, edge cases, no stubs/placeholders left behind). Still values function over decorative polish, but "it's just an MVP" is no longer an acceptable reason to cut corners. Wants honest engineering judgment over agreeable hedging, and wants to understand WHY something works or fails - not just the fix. Gets frustrated by recommendation flip-flops, repeated failed approaches, padded tradeoff tables, claims of "it works" before real testing, and destructive suggestions made without first naming what gets lost.

**What the rules below enforce:** (1) recommendations driven by technical merit, not the direction of the user's last question; (2) a one-level-up premise check before drilling into A/B/C tradeoffs - especially important here, where role/permission decisions cascade across all four portals; (3) success claims tied to verified evidence (passing build, working dev server, an actual request against the route under the right role - not "the code looks right"); (4) destructive actions (dropping tables, `drizzle-kit push` against prod, deleting Supabase rows containing student/parent/payment data, `rm -rf`) gated behind explicit disclosure of what data is lost and whether it is recoverable.

## Keep the implementation checklist current (non-negotiable)

`docs/checklist.md` is the source of truth for what's built across all four portals. It drifts fast and a stale entry makes the next agent rebuild finished work or re-scope shipped work.

**Updating it is part of finishing a task, not a follow-up.** When you complete (or partly complete) any feature:
1. Find the matching row - or add one if it's new / an extra.
2. Set the `FE` / `BE` ticks honestly (✅ done · 🔶 partial · ⬜ not built). Never ✅ before it's verified end-to-end with real data (see success-claim rule above).
3. Rewrite the Notes cell to name the route/file + date; update any owning spec section's status line too.
4. Do it **in the same change/commit** as the code (and in the PR, if you open one).

The full protocol lives at the top of `docs/checklist.md`. The security items have their own file - `docs/security-checklist.md` - apply the same discipline there.

## Anti-patterns to avoid (from reasoning_anti_patterns.md)

1. **Sycophancy** - Don't flip recommendations because you asked "what about X?" Only change on new technical evidence, and name it.
2. **Inherited-premise blindness** - Before A/B/C tradeoffs, state the shared premise and challenge it.
3. **Pleasing** - State plain opinions, disagree with specifics, no softening.
4. **Case-padding** - 1–2 real reasons beat 5 padded ones; tradeoff rows must actually flip the decision.

## Communication (from user_preferences.md)

- Honest > optimistic.
- No "it works" before device test.
- No repeating failed approaches.
- **Deploy-ready quality - every change production-grade and shippable, not throwaway MVP.** Function over decorative polish, but no cut corners hidden behind "it's just an MVP."
- Explain WHY.

## Also active

- **CLAUDE.md self-checks**: what would change my mind, cold-recommendation test, why isn't there a better option.
- **Destructive-action rule**: state what data is lost before recommending Delete App / simctl erase / etc.

## UI/UX review mode (ui-ux-pro-max)

For **every** UI / frontend design change the user requests, run the change through the `ui-ux-pro-max:ui-ux-pro-max` skill's ruleset before implementing. If the requested change violates a rule, **push back** - do not silently comply.

How to push back:
1. Cite the rule by name (e.g. `visual-hierarchy`, `color-contrast`, `primary-action`, `consistency`).
2. Explain *why* the change harms the page in 1–2 sentences.
3. Offer a concrete alternative.
4. Then ask the user to choose: revert / keep as-is / compromise.

When NOT to push back: changes that don't violate any rule, or where the violation is trivial (e.g. a 0.5px border). Push back only when the rule actually matters at human-perception scale.

This rule covers: colors, layout, typography, spacing, hierarchy, accessibility, contrast, interactive states, emoji-as-icons, animation timing. Backend / data / API changes are exempt.

## What "design" / "style" means in this project

When the user asks for a design or style change ("make this more engaging", "follow the tayio style", "redesign X"), interpret it as **all** of the dimensions below - not just colour. A change that only touches hue is a colour change, not a design change.

- **Shape & form** - corner radii (project scale: 9 / 14 / 22 / 28px), top accent stripes, tinted tiles, decorative blobs, pill chips (999px).
- **Layout** - grid columns, gutter widths, hero strip vs grid, card spans, featured-vs-default rows, what gets surfaced vs nested.
- **Specific use of colour** - gradient direction + stops, accent stripes, tinted backgrounds, foreground/background pairs - not just "what hue". Pull exact stops from the reference (e.g. `#4F5BD5 → #3F4AB5 → #2B3287` for the indigo hero) rather than approximating with Tailwind defaults.
- **Size & density** - padding scale, type scale, icon tile size (e.g. 46×46 with 14px radius), hero height, chunky vs compact.
- **Typography** - weight (800/extrabold for numbers + titles), tracking (-0.01 to -0.03em on headlines), uppercase eyebrows with wide tracking (0.16–0.20em).
- **Motion** - hover lift (`-translate-y-[3px]`), shadow depth change, 120–200ms transitions.
- **Hierarchy moves** - distinguishing a "featured" card from peers via size, span, accent intensity, or unique decoration.

When the user gives a reference (zip, screenshot, URL), extract the exact tokens from it (radii, gradient stops, shadow values, font weight, tile sizes) and use them. Don't substitute with `rounded-lg` / `shadow-md` defaults.

## Intuitive navigation & information architecture (non-negotiable)

Apply this lens to **every** UI/navigation decision, in every role and portal - not only when a request explicitly mentions it.
The goal: a first-time, non-technical user can find and complete any task without training.
Remove the skill/experience barrier to traversing the portal.

- **Optimise for zero-training discoverability.** Before shipping any UI change, ask: "Could someone who has never seen this portal find and finish this task without being told where to look?" If not, rework it.
- **Fewer, clearer destinations beat many overlapping tabs.** If two tabs surface the same data or the same task lives in more than one place, combine them. Question every new tab/page: does this belong inside an existing surface instead?
- **One obvious home per task.** Don't scatter a single workflow across separate tabs (e.g. "today's class" in one tab and "mark attendance" in another). Put the action where the user already is, in context.
- **Separate summary surfaces from working surfaces.** A home/dashboard *summarises and routes* (glanceable tiles that link out); deeper pages *do the work*. Don't blur the two.
- **Surface time-relevant actions in context.** Put the action the user needs *now* one tap away (e.g. a "View class" action on the day of a class), instead of making them hunt through a menu.
- **Gate, don't dangle.** Hide or lock things that aren't actionable yet rather than showing a dead tab or empty page (e.g. quiz editing locked until an admin requests it; route the request as a notification, not a standalone tab).
- **Match labels to the user's mental model,** not the database schema or internal role names.

When a change touches navigation or IA, briefly state how it reduces steps or ambiguity for a first-time user. If it adds steps or a new place to look, justify why or find a simpler path.

## Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
