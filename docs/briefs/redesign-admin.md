You own the **Admin** portal redesign on your current branch.

Apply the design language of the student dashboard (`src/app/student/page.tsx`) to the admin portal, **but the dashboard layout and content must be admin-specific** — different from student. Roles share visual primitives, not interfaces.

**Required reading**

- `src/db/schema.ts` — data contract (read only)
- `src/app/student/page.tsx` — visual reference for design language
- `docs/PRD_Admin_Portal.md` — feature spec
- `docs/AGENT_HANDOFF.md` — boundaries

**Your sandbox**

Modify only:
- `src/app/admin/**`
- `src/app/api/admin/**`

**Off-limits** (do not modify, only import from):
- `src/db/schema.ts`
- `src/lib/auth.ts`, `src/middleware.ts`
- `src/components/portal/shell.tsx`
- `src/components/ui/*`, `src/components/data/*`
- Any other role's folder

Some shared UI primitives (`badge`, `select`, `table`, `textarea`) were originally added by an earlier admin pass — they live in `src/components/ui/*`. Keep using them; don't fork.

**Shared primitives — USE these, don't reinvent**

UI components: `<MiniWeekCalendar>`, `<ProgressBar>`, `<StatTile>`, `<ScoreBadge>`, `<StatusBadge>`, `<Card>`, `<CardLabel>`, `<Button>`, plus the admin-added `<Badge>`, `<Select>`, `<Table>`, `<Textarea>`.

Helpers: `@/lib/format` (all formatters), `@/lib/status` (all status maps).

If you need a new shared primitive, **stop and ask the user**.

**Admin dashboard — what's different from student**

Admin is operational. The dashboard answers:

1. **Is the business healthy?** Active student count, weekly lesson count, revenue this month, overdue invoice total.
2. **What needs attention?** Tutors with overdue lesson notes, overdue invoices, pending make-up requests, new trial bookings.
3. **What just happened?** Recent announcements, recent enrolments, recent payments.
4. **At-risk students** — students with low attendance, missing homework, or declining mastery (whatever signal is queryable).

Suggested layout:
- Title + week context
- Operational stat strip: active students, lessons this week, overdue invoices, notes pending, revenue this month
- Main + aside:
  - Main: "Needs your attention" list (operational alerts), recent activity feed
  - Aside: revenue tile with a small chart, announcements composer link, jump-to-section grid (users / classes / enrolments / payments / announcements)

**Pages to ship (most already exist — apply consistent design):**
- `/admin` (operations overview)
- `/admin/users` + `/admin/users/[id]` (user mgmt + family_links manager)
- `/admin/classes` (class CRUD)
- `/admin/enrolments` (move students between classes)
- `/admin/payments` (invoice list + create)
- `/admin/announcements` (write announcements with audience scoping)
- `/admin/reports` (stub OK if not in MVP)

**Critical safety**

- Mutations must run server-side via the service role key. The browser must never see `SUPABASE_SERVICE_ROLE_KEY`.
- Destructive actions (delete user, cancel class, refund invoice) must require confirmation.
- Audit log: when you delete or modify another user's data, write to a future `audit_log` table (skip for now if not in schema — flag it in the PR description).

**Verify before claiming done**

```bash
npm run typecheck
npm run dev -- --port 3004
```

Sign in as `admin@taiyo.com / admin`. Walk every page. Try creating a user, a class, an invoice. Confirm middleware blocks you from `/student`, `/parent`, `/tutor`.

**Workflow**

```bash
git push -u origin <your-branch>
```

When done: tell the user *"done — branch pushed"*.
