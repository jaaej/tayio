# Discussions - Design Spec

**Date:** 2026-05-27
**Author:** jae (with Claude)
**Status:** Draft → awaiting user review before implementation plan

## Purpose

A per-subject (and per-year) Q&A board where students can ask questions, tutors answer + give feedback, and admins oversee and answer where needed. Replaces the current "no messaging anywhere" gap flagged in `docs/checklist.md` for student / tutor portals. Parent portal is intentionally **out of scope** for v1 - the parent PRD describes a different "routed messaging" pattern (learning→tutor, payment→admin) that needs its own design.

## Roles in v1

- **Student** - can read, post threads, post replies on boards they're enrolled in (plus Admin/Tech).
- **Tutor** - same as student, scoped to subjects they teach (plus Admin/Tech).
- **Admin** - sees every board. Can post + reply anywhere. Can soft-delete any thread or reply.
- **Parent** - no access. Not in this feature.

## Conversation unit

**Threads.** One thread = one question with a title and body. Replies live underneath. This is option **A** from the brainstorm. Rationale: matches PRD framing ("ask question → get reply → see history"), gives each question a stable URL and a resolvable identity, and gives admin a clean oversight surface (list of open threads).

## Boards

A "board" is a `(subject, year level)` pair. Since the existing `subjects` table already encodes `yearLevel` per subject row, **a board = one row in the `subjects` table**. No separate `boards` table needed.

In addition there is **one "Admin / Tech" board** for non-academic stuff (login issues, generic admin questions, anything off-syllabus). It is shared - every student / tutor / admin sees the same Admin/Tech board.

Sentinel-null pattern: a thread row's `subject_id` column is the `subjects.id` UUID for subject boards, and `NULL` for the Admin/Tech board. The "list all boards I can see" query is a UNION of (subjects-I-have-access-to) + (one synthetic "Admin/Tech" entry).

## Membership / read access

| Role | Subject boards visible | Admin/Tech |
|---|---|---|
| Student | subjects of any class they're enrolled in (`enrollments → classes → subjects`) | always |
| Tutor | subjects of any class they teach (`classes.tutorId = me`) | always |
| Admin | all subjects | always |

Enforced in the query layer (no RLS in v1 - that's tracked as a separate cross-cutting brief at `docs/briefs/security-rls-brief.md`).

## Post / reply / delete / edit

- Any role can **post** a thread on any board they have read access to.
- Any role can **reply** to any thread on any board they have read access to. Cross-student replies are allowed (students can answer each other) - matches a shared-classroom feel.
- **Delete:** author cannot delete their own post. Admin can soft-delete any thread or reply (sets `deletedAt`). Soft-deleted content renders as `[removed by admin]` with the original author name kept visible.
- **Edit:** nobody, in v1.

## Data model

Two new tables in `src/db/schema.ts`. No new enums.

```ts
export const discussionThreads = pgTable(
  "discussion_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id").references(() => subjects.id), // NULL = Admin/Tech board
    authorId: uuid("author_id").notNull().references(() => profiles.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("discussion_threads_subject_idx").on(t.subjectId),
    index("discussion_threads_activity_idx").on(t.lastActivityAt),
  ],
);

export const discussionReplies = pgTable("discussion_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => discussionThreads.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => profiles.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

**Why `lastActivityAt` on the thread:** sorting boards by "most recent activity" is a board-page-load query. Without this column we'd subquery every thread's newest reply on every read. With the column, we update it once on each reply insert and sort by an indexed column. Standard forum pattern.

**Migration:** run via `drizzle-kit generate` + `drizzle-kit migrate` in the existing workflow. No data backfill required.

## Routes

Same shape duplicated under each role:

| Route | Page |
|---|---|
| `/{role}/discussions` | Landing - list of boards the user has access to (subject boards + Admin/Tech). Each board card: name, total thread count, last activity timestamp. |
| `/{role}/discussions/[boardId]` | Single board - list of threads sorted by `lastActivityAt` desc. Per-thread row: title, author, reply count, last reply time. Button: "Ask a question" (opens composer modal or inline form). |
| `/{role}/discussions/[boardId]/[threadId]` | Thread view - original post at top, replies chronological below, reply composer pinned at bottom. |

`{role}` ∈ `student | tutor | admin`. Same UI, different scope.

`boardId` URL value:
- Subject boards: the `subject_id` UUID.
- Admin/Tech board: the literal string `"admin"`. Resolved at the route handler to "subject_id IS NULL".

## Server actions

Shared in `src/app/_actions/discussions.ts` (the action logic is identical across roles; only the auth check varies). Each action validates role + board membership at the top:

- `createThread({ boardId, title, body })` - validates membership, inserts thread, redirects to thread view.
- `postReply({ threadId, body })` - validates membership, inserts reply, bumps `lastActivityAt` on the parent thread, writes a notification to the thread author (if author is someone other than the replier and they don't already have an unread `discussion_reply` notification for that thread).
- `softDeleteThread({ threadId })` - admin only. Sets `deletedAt`.
- `softDeleteReply({ replyId })` - admin only. Sets `deletedAt`.

All actions are server actions (Next.js `"use server"`), validated with Zod, and call `requireRole(...)` at the top.

## UI conventions

Match the existing portal language:

- Boards landing: grid of `Card` blocks, one per board. Subject board uses the `subject-colors` accent family (since boards correspond 1:1 to subjects); Admin/Tech uses a neutral periwinkle.
- Board page: single outer `Card` containing a list of thread rows (similar to the "Marked" list pattern just shipped in `/student/homework`). Each row click-navigates to the thread.
- Thread page: original post in its own `Card`, replies stacked in a second `Card`, composer in a third `Card` at the bottom. Standard portal `section-header` for the thread title.

No new UI primitives invented for this feature.

## Notifications

Reuse the existing `notifications` table.

- New notification kind: `discussion_reply`.
- Payload: `{ kind: "discussion_reply", threadId, boardId, replierId }`.
- Channel: `in_app` only (no email transport in the portal yet).
- Written when: someone replies to a thread you authored, AND you don't already have an unread `discussion_reply` notification for that thread. (One unread ping per thread until you read it, not one per reply.)
- Not written when: a new thread is created on a board you're a member of (would be noisy across whole subject boards).

The portal does not yet have an in-app inbox UI. Notifications written by this feature will sit in the table waiting for that UI to land - they aren't lost.

## Navigation

Add a "Discussions" entry to the three role shells in `src/components/portal/shell.tsx`:

| Role | Insert after | Label | Icon (lucide-react) |
|---|---|---|---|
| Student | "Homework" | Discussions | `MessagesSquare` |
| Tutor | "Notes" | Discussions | `MessagesSquare` |
| Admin | "Announcements" | Discussions | `MessagesSquare` |
| Parent | - | - | - |

`MessagesSquare` (plural, two stacked bubbles) is used instead of `MessageSquareText` to keep it visually distinct from Parent → "Feedback" which already uses `MessageSquareText`.

**Unread badge** on the nav link: deferred. The in-app notifications inbox doesn't exist yet, so adding a count here would be the first surface of a feature we haven't designed. Add when the inbox lands.

## Out-of-scope for v1 (explicit cuts)

- Attachments (image/PDF). Per Student PRD §11 P2.
- Edit own posts.
- Thread status (open / answered / resolved).
- Realtime updates (websockets / SSE). v1 is request-revalidate.
- @mentions, quoting, markdown formatting beyond plaintext + paragraph breaks.
- Notification on every new thread in a board you're a member of.
- Parent role access.
- Email notifications.
- An in-app notifications inbox UI (already gap-flagged separately in `docs/checklist.md`).

## Acceptance criteria

A student enrolled in "Year 11 Chemistry":
- Sees the "Year 11 Chemistry" board at `/student/discussions`.
- Sees the "Admin / Tech" board at `/student/discussions`.
- Does NOT see "Year 12 English" board (not enrolled).
- Can open the Y11 Chem board, click "Ask a question", post a thread, and see it appear at the top of the board.
- Can open another student's thread on the Y11 Chem board and post a reply.
- Cannot delete their own post; the UI does not offer the action.

A tutor teaching Year 11 Chemistry:
- Sees the "Year 11 Chemistry" board.
- Sees "Admin / Tech".
- Does NOT see "Year 12 English" board (doesn't teach it).
- Can post + reply on Y11 Chem.
- When they reply to a student's thread, the student receives a `discussion_reply` notification row in the `notifications` table.

An admin:
- Sees every subject board and the Admin/Tech board at `/admin/discussions`.
- Can soft-delete any thread or reply on any board.
- Soft-deleted content renders as `[removed by admin]` with original author still visible.

A parent visiting `/parent/discussions`:
- 404 (route does not exist).

## Open questions / decisions deferred

None blocking v1.

Later, when in-app inbox lands: nav badge for unread reply notifications.

When attachments are reintroduced: needs storage bucket policy, file size cap, and a virus-scan position (deferred decision).
