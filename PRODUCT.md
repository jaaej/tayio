# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Taiyo Tuition is a tutoring company in Melbourne.
The portal has four roles, each with its own portal: student, parent, tutor and admin.

- **Students** (primary school to VCE, group and one-on-one, in person and online) mostly open the portal on a laptop, at a desk doing homework.
  They come to reach a subject quickly, see this week's classes, and see what is due.
- **Parents** follow their children's progress, attendance, tutor feedback and invoices.
- **Tutors** teach classes, mark homework, write lesson notes, take attendance, and build quizzes when admin asks.
- **Admins** run users, classes, enrolments, curriculum, payments, announcements and reports.

## Product Purpose

The portal replaces scattered messages, spreadsheets and paper with one place where each role can see and do its part of the tutoring week.
For students, success is never having to hunt: they open the portal and know what is due, what class is next, and where each subject's material lives.

## Operating Context

- Learning is planned by subject week inside a term (Term N, Week N); classes in a subject share the admin's week plan.
- Homework is marked by the tutor with a percentage score; quizzes are auto-scored (correct answers / questions).
- Lesson notes are split into parent-visible and internal.
- Notifications route per role; direct messages and action-needed items come before announcements and general updates.
- Taiyo Blitz is a maths game with a per-year leaderboard, linked from the student portal.
- Time zone is Melbourne; dates read as "Tuesday 13 October".

## Capabilities and Constraints

- Next.js 15 App Router, React 19, Tailwind v4, Supabase auth, Drizzle over Postgres.
- Role permissions are strict: students see only their own data, parents only their children's, tutors only assigned students, admins everything.
- A feature that appears in more than one role must be one shared implementation and look and behave the same in each.
- The admin and tutor portals use the shared glass shell (`src/components/portal/glass-shell.tsx`); student and parent are still on the older shell and are being moved over.
- Production-quality only: no stubs, placeholders or invented data.

## Brand Commitments

- Name: Taiyo Tuition (wordmark "Taiyo" over "TUITION").
- No em dashes in any copy.
- No redundant subtitles or narration of the UI's own state; headings and content speak for themselves.
- Labels follow the user's mental model, not database names.

## Evidence on Hand

- Product requirements: `docs/PRD_Student_Portal.md`, `docs/PRD_Parent_Portal.md`, `docs/PRD_Tutor_Portal.md`, `docs/PRD_Admin_Portal.md`.
- Owner design comps: `taiyo-admin-design.zip`, `taiyo-tutor-design.zip`, and the student "Dashboard · colourful option" comp (owner's Downloads).
- No testimonials, metrics or marketing claims exist; do not invent them.

## Product Principles

1. Zero-training discoverability: a first-time, non-technical user finds and finishes any task without being told where to look.
2. One obvious home per task; summary surfaces route, working surfaces do the work.
3. Put the action needed now one tap away, in context.
4. Gate, don't dangle: hide or lock what isn't actionable yet.
5. Cross-role consistency: the same feature looks and behaves the same in every role.

## Accessibility & Inclusion

- Users include primary school children; copy stays plain and short.
- WCAG AA contrast, visible focus, keyboard reachable, 44px touch targets on phones.
