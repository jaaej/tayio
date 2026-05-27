# Direct Messaging (DM) — Design Spec

**Date:** 2026-05-27
**Author:** jae (with Claude)
**Status:** Draft → awaiting user review before implementation plan

## Purpose

In-portal 1:1 direct messaging between users. Closes the "Direct message tutor / admin" gap in `docs/checklist.md` (currently ⬜ for parent and partially gestured at for student/tutor). The motivation, from the PRD, is a Centralised Communication System that replaces scattered SMS, email, and WhatsApp chats that parents currently use to contact tutors and admin.

Separate from the discussions feature (which is forum-style, per-subject, multi-participant). DMs are 1:1, persistent, ongoing.

## Permitted role pairs (the matrix)

| From → To | Allowed |
|---|---|
| Parent → Tutor | ✓ (relationship: tutor teaches a class their child is enrolled in) |
| Parent → Admin | ✓ |
| Student → Tutor | ✓ (relationship: tutor teaches a class the student is enrolled in) |
| Student → Admin | ✓ |
| Tutor → Parent | ✓ (relationship: parent is linked to a student in a class the tutor teaches) |
| Tutor → Student | ✓ (relationship: student is in a class the tutor teaches) |
| Tutor → Admin | ✓ |
| Admin → anyone | ✓ |
| Anything → same role | ✗ (no parent↔parent, no student↔student, no tutor↔tutor) |

DMs are bidirectional once allowed — if A can DM B, B can also DM A.

## Conversation model

One persistent thread per pair (option A from brainstorm). Multiple separate threads for the same pair are not supported. All DMs between any two users live in their single ongoing thread.

Canonical pair ordering: the row stores `userAId` = smaller UUID, `userBId` = larger UUID. Lookup by pair becomes a single equality check, not an OR.

## Relationship lapse policy

If the relationship that allowed a DM is later removed (student withdraws from class, family link unlinked), the existing thread remains readable to both parties indefinitely. New sends require the relationship to currently hold. (Option A from brainstorm — humane, no surprise data loss.)

## Data model

Three new tables in `src/db/schema.ts`. No new enums.

```ts
export const dmThreads = pgTable(
  "dm_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userAId: uuid("user_a_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("dm_threads_pair_idx").on(t.userAId, t.userBId),
    index("dm_threads_a_idx").on(t.userAId),
    index("dm_threads_b_idx").on(t.userBId),
  ],
);

export const dmMessages = pgTable(
  "dm_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").notNull().references(() => dmThreads.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dm_messages_thread_idx").on(t.threadId, t.createdAt)],
);

export const dmReads = pgTable(
  "dm_reads",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").notNull().references(() => dmThreads.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.threadId] })],
);
```

**Why no participants table:** strict 1:1 only. Two columns is enough. If/when group DMs are added, migrate.

**Unread computation:** for a thread, you have unread messages if `dmReads.lastReadAt < dmThreads.lastActivityAt` AND the most recent message wasn't from you. Per-message tracking is not required.

**Migration:** run `npm run db:push` (project uses push, not generated migration files). Disclosure: creates three new tables + their indexes. No existing tables altered, no data loss possible.

## Permissions

Enforced server-side at three boundaries:

1. **`/{role}/messages/with/[userId]` route handler** — calls `canDM(me, target)`; if false, 404.
2. **`sendMessage` server action** — re-checks before insert.
3. **`listMyThreads` query** — only returns threads where current user is `userAId` OR `userBId`.

`canDM(meId, meRole, targetId, targetRole)` returns true iff the (meRole, targetRole) pair is in the matrix above AND the relationship clause holds. Implementation lives in `src/lib/dm-permissions.ts`.

The relationship clauses use existing joins:
- **Parent ↔ Tutor:** `family_links → enrollments → classes.tutorId`.
- **Student ↔ Tutor:** `enrollments → classes.tutorId`.
- **Tutor ↔ Parent:** `classes.tutorId → enrollments → family_links`.
- **Tutor ↔ Student:** `classes.tutorId → enrollments`.
- **Anyone ↔ Admin** and **Admin ↔ Anyone:** always true.
- **Same-role pairs:** always false.

## Routes

| Route | Page |
|---|---|
| `/{role}/messages` | Inbox — list of threads. Each row: other-participant name + role, last message preview, last activity timestamp, unread badge. Sorted by `lastActivityAt` desc. |
| `/{role}/messages/[threadId]` | Single thread — message list (oldest at top, newest at bottom, autoscrolls to bottom on load), composer pinned to bottom. Messenger-style: sender's messages right-aligned, recipient's left-aligned. |
| `/{role}/messages/with/[userId]` | Resolver — validates relationship, opens or creates thread, `redirect()` to `/{role}/messages/[threadId]`. Where contact-row "Message" buttons point. |

`{role}` ∈ `parent | student | tutor | admin`. Three pages per role, four roles = 12 thin route wrappers. Each calls `requireRole` then renders shared UI.

## Server actions

In `src/app/_actions/dm.ts`:

- `sendMessage({ threadId, body })` — checks `canDM` between current user and the other participant on the thread; inserts message; bumps `lastActivityAt`; writes a `dm_message` notification to the other participant (deduped by unread state).
- `markThreadRead({ threadId })` — upserts the current user's row in `dmReads` with `lastReadAt = now()`. Also clears the unread `dm_message` notification for that thread by setting its `readAt`.

All actions are Next.js server actions (`"use server"`), validated with Zod, call `requireRole(...)` at the top.

## UI conventions

Match the existing portal language:

- Inbox: one outer `Card` with a list of thread rows divided by hairlines. Each row uses the existing portal `bg-card` (white) + hover.
- Thread page: header card with other-person name + role badge + close link, then a scrollable message list, then a composer card pinned at the bottom.
- Composer: textarea + send button. Enter sends, Shift+Enter newline.
- Messages: simple bubbles with subtle background tint. Sender's bubbles right-aligned with `bg-brand-100`. Recipient's left-aligned with `bg-card`. No avatars in v1.

## Entry points

| Role | Where | Targets |
|---|---|---|
| Parent | `/parent` dashboard contact block (`src/app/parent/page.tsx:355`) | "Message" button on each tutor row + the admin row |
| Student | `/student` dashboard — add a new contact card (does not currently exist) | Student's tutors + admin |
| Tutor | `/tutor/students/[id]` detail page | Per family link: "Message parent" button. At top: "Message student" button. |
| Admin | `/admin/users/[id]` detail page | "Message" button at top of detail card |

Each entry is `<Link href="/{role}/messages/with/{userId}">Message</Link>`. The `/with/{userId}` route does the validation + open-or-create + redirect server-side. No client logic.

## Notifications

Reuse the existing `notifications` table.

- New kind: `dm_message`.
- Trigger: any new message; notification written for the OTHER participant.
- Payload: `href = /{recipientRole}/messages/{threadId}`, title = `New message from {senderName}`.
- Dedup: if recipient already has an unread notification with the same `href`, no new row written.
- Cleared when: recipient opens the thread (`markThreadRead` action sets the notification's `readAt` and bumps `dmReads`).

## Nav + unread badge

Add a "Messages" entry to all four role shells in `src/components/portal/shell.tsx`:

| Role | Insert after | Label | Icon (lucide-react) |
|---|---|---|---|
| Parent | "Feedback" | Messages | `MessageCircle` |
| Student | "Discussions" | Messages | `MessageCircle` |
| Tutor | "Discussions" | Messages | `MessageCircle` |
| Admin | "Discussions" | Messages | `MessageCircle` |

Unread badge: small numeric badge on the nav item showing total unread threads across all conversations. Query in the shell's data fetch. Removed when count is 0.

## Polling / refresh

No realtime. Messages are loaded server-side on page render. Sending a message uses `revalidatePath` to refresh the thread page and inbox for the sender. The recipient sees new messages on next navigation or refresh. Acceptable for MVP. A "Refresh" button on the thread header is optional polish — out of scope unless added explicitly.

## Out-of-scope for v1 (explicit cuts)

- Group DMs (3+ participants)
- Realtime updates (WebSockets/SSE)
- Attachments (image/PDF)
- Typing indicators
- Search across messages
- Edit / unsend
- Read receipts ("seen at HH:MM")
- Cross-role broadcasts (that's announcements, separate feature)
- Email notifications (in-app only for now)

## Acceptance criteria

A parent of a Year 9 English student:
- Sees a "Message" button on the Year 9 English tutor row in their dashboard contact block.
- Clicks it → lands on `/parent/messages/<threadId>` with no existing messages.
- Sends "Hi, quick question" → tutor receives a `dm_message` notification, their unread count on the Messages nav item increments.
- Tutor opens thread → sees the message, the notification's `readAt` is set, unread count returns to 0.
- Both parties can send back-and-forth in the same thread.
- Parent visits `/parent/messages` → sees the thread at the top of their inbox with last-activity timestamp.
- Parent cannot DM a tutor who doesn't teach their child (`/parent/messages/with/<unrelated-tutor-id>` → 404).
- Parent cannot DM another parent (`/parent/messages/with/<another-parent-id>` → 404, same-role denied).

An admin:
- Sees every thread in their inbox where they're a participant.
- Has "Message" buttons on every user's detail page.

A tutor whose student withdraws from a class:
- The existing DM thread with that student's parent remains readable.
- New sends require the relationship to currently hold — denied if the only shared enrollment was the withdrawn one. (Re-enrollment restores send ability.)

## Open questions / decisions deferred

- Phone-number / email fallbacks: deferred to email-delivery infra (separate cross-cutting brief).
- Group DMs: deferred until use case appears.
- Search: deferred. Add Postgres FTS index when needed.
