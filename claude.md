# Project Rules

## Context

**Project:** `tayio_portal` — a web portal for a tutoring company, scoped across four PRDs in `docs/`: **Student** (homework, timetable, lesson recaps, resources, quizzes, progress), **Parent** (child progress, attendance, tutor feedback, invoices, make-up requests), **Tutor** (class list, student profiles, attendance marking, lesson notes with parent-visible vs. internal split, homework marking), and **Admin** (user management, class/enrolment management, payments, announcements, reporting, resource approval). Built on Next.js 16 (App Router) + React 19, Supabase auth (`@supabase/ssr`), Drizzle ORM over Postgres, Tailwind v4, Zod. Source under `src/` (`app/`, `components/`, `db/`, `lib/`, `middleware.ts`).

**Build order (from Admin PRD §15):** Phase 1 foundation (login, roles, four dashboards, schedule, user management) → Phase 2 learning workflow (homework, lesson notes, feedback, attendance, parent visibility) → Phase 3 admin ops (enrolments, classes, announcements, invoices, make-ups) → Phase 4 value-add (resources, quizzes, progress, reports) → Phase 5 advanced (AI summaries, mobile, payroll, calendar sync). P0 features should ship before any P1/P2 work.

**Cross-cutting non-negotiables from the PRDs:** role-based permissions are strict (students see only their own data, parents only their children's, tutors only assigned students, admins everything with audit logs); parent-child account linking is a first-class concept; payment statuses are a fixed enum (unpaid/paid/overdue/partially paid/refunded/cancelled); lesson notes split parent-visible vs. internal; notifications must route to the correct role per the matrices in each PRD.

**About the user:** solo builder shipping the portal as a personal/startup product. Prioritizes MVP function over polish, wants honest engineering judgment over agreeable hedging, and wants to understand WHY something works or fails — not just the fix. Gets frustrated by recommendation flip-flops, repeated failed approaches, padded tradeoff tables, claims of "it works" before real testing, and destructive suggestions made without first naming what gets lost.

**What the rules below enforce:** (1) recommendations driven by technical merit, not the direction of the user's last question; (2) a one-level-up premise check before drilling into A/B/C tradeoffs — especially important here, where role/permission decisions cascade across all four portals; (3) success claims tied to verified evidence (passing build, working dev server, an actual request against the route under the right role — not "the code looks right"); (4) destructive actions (dropping tables, `drizzle-kit push` against prod, deleting Supabase rows containing student/parent/payment data, `rm -rf`) gated behind explicit disclosure of what data is lost and whether it is recoverable.

## Anti-patterns to avoid (from reasoning_anti_patterns.md)

1. **Sycophancy** — Don't flip recommendations because you asked "what about X?" Only change on new technical evidence, and name it.
2. **Inherited-premise blindness** — Before A/B/C tradeoffs, state the shared premise and challenge it.
3. **Pleasing** — State plain opinions, disagree with specifics, no softening.
4. **Case-padding** — 1–2 real reasons beat 5 padded ones; tradeoff rows must actually flip the decision.

## Communication (from user_preferences.md)

- Honest > optimistic.
- No "it works" before device test.
- No repeating failed approaches.
- MVP function > polish.
- Explain WHY.

## Also active

- **CLAUDE.md self-checks**: what would change my mind, cold-recommendation test, why isn't there a better option.
- **Destructive-action rule**: state what data is lost before recommending Delete App / simctl erase / etc.
