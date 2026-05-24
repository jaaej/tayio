You own the **Notifications** track. The `notifications` table already exists in `src/db/schema.ts` but nothing writes to it. Your job is to build the backend that fires notifications on meaningful events, and a small read API the role frontends will consume later.

**Required reading first:**
- `src/db/schema.ts` — `notifications` table + `notificationChannelEnum`
- `docs/PRD_Student_Portal.md`, `PRD_Parent_Portal.md`, `PRD_Tutor_Portal.md`, `PRD_Admin_Portal.md` — each PRD has a notification matrix in section 12-ish

**Your sandbox:**
- New folder: `src/lib/notifications/` — service layer with typed helpers
- New folder: `src/app/api/notifications/` — read endpoints (list, mark-read, mark-all-read)
- Optional: `src/lib/email/` if you wire Resend or similar for email delivery (use env var `RESEND_API_KEY`, falls back to no-op in dev)

Do not touch:
- `src/app/{student,parent,tutor,admin}/**` (role agents will call your helpers, you don't reach into their folders)
- `src/db/schema.ts` (notifications table already exists, you don't need to alter it)
- `src/lib/auth.ts`, `src/middleware.ts`, `src/components/ui/*`, `src/components/portal/shell.tsx`

**Scope:**
1. **Typed helper functions** in `src/lib/notifications/index.ts`. One per event type — small, focused, easy to call from a server action. Examples:
   - `notifyHomeworkAssigned({ homeworkId, studentIds })`
   - `notifyHomeworkMarked({ assignmentId })`
   - `notifyHomeworkDueSoon({ assignmentId })`
   - `notifyLessonCancelled({ lessonId })`
   - `notifyTutorFeedbackPosted({ lessonNoteId })`
   - `notifyPaymentDue({ invoiceId })`
   - `notifyPaymentOverdue({ invoiceId })`
   - `notifyMakeupApproved({ lessonId })`
   - `notifyAnnouncementPublished({ announcementId })`
   Each helper resolves the right recipients from the schema (students for `homework_assigned`, parents + students for `tutor_feedback`, etc.), writes one row per recipient, and returns the inserted IDs.
2. **Read API** under `src/app/api/notifications/`:
   - `GET /api/notifications` — current user's notifications, unread first, paginated (50/page)
   - `POST /api/notifications/[id]/read` — mark single read
   - `POST /api/notifications/read-all` — mark all current user's notifications read
3. **Email delivery (optional but recommended):** if `RESEND_API_KEY` is set, also send an email when channel is `email`. Use plain text templates initially — HTML can come later. If the key isn't set, log instead. Never throw on email failure (notifications must still write to DB even if email fails).
4. **Background helper for due-date notifications:** a cron-able function `enqueueDueSoonNotifications()` that finds homework due in the next 24h that hasn't been notified yet, and fires `notifyHomeworkDueSoon` for each. You don't need to wire a real cron — leave it as a callable script in `scripts/notifications-due-soon.mjs` for now.

**Verify before claiming done:**
- `npm run typecheck` passes
- Call each helper manually from a Node script, confirm a row lands in `notifications` for each expected recipient
- Hit `GET /api/notifications` while signed in as a test user, confirm you only see your own
- Confirm `POST /api/notifications/[id]/read` rejects when the notification belongs to another user (RLS will help here if the RLS branch has landed; otherwise do an explicit check in the route handler)
- Document the full event matrix (event → who gets notified → what channel) in `docs/NOTIFICATIONS.md`

**Workflow:**
```bash
git checkout -b feat/notifications main
git push -u origin feat/notifications
gh pr create
```

Rebase on `main` (don't merge) if main moves while you're working. Coordinate with role agents — they'll call your helpers from their server actions once you ship.
