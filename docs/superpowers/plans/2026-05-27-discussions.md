# Discussions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a per-subject Q&A discussion board accessible to students, tutors, and admins, plus a shared "Admin / Tech" board for non-academic questions.

**Architecture:** Two new tables (`discussion_threads`, `discussion_replies`) keyed against the existing `subjects` table (subject_id NULL = Admin/Tech board). Shared server actions in `src/app/_actions/discussions.ts`. Shared read queries in `src/lib/discussions-queries.ts`. Shared UI primitives in `src/components/discussions/`. Each of the three roles gets three thin route wrappers under `/{role}/discussions/...` that call `requireRole`, fetch role-scoped data, and render the shared UI.

**Tech Stack:** Next.js 16 App Router (server components by default, client only where state is needed), React 19, Drizzle ORM over Postgres, Supabase auth, Tailwind v4, Zod for action validation, lucide-react for icons.

**Reference spec:** `docs/superpowers/specs/2026-05-27-discussions-design.md`

---

## Pre-flight

The working tree is currently dirty across all four portals (uncommitted UI work). **Before starting Task 1**, either:

- Commit the in-flight work to main, OR
- Stash it: `git stash push -u -m "wip before discussions feature"`

Failing to do this means later `git commit` steps will sweep up unrelated files and the diff per task will be unreadable.

The project uses `db:push` (no `drizzle/` migration directory exists). The user runs `db:push` themselves after each schema change — the executor never runs it. Disclosure of effect is required (e.g. "creates X tables, no data loss possible") before asking the user to push.

The user starts the dev server themselves (per `feedback_dev_server.md`). Plan steps that need a browser say "ask user to verify in browser" rather than `npm run dev`.

---

## File map

**New files (in dependency order):**
- `src/db/schema.ts` — *modify* — append `discussionThreads` + `discussionReplies` tables
- `drizzle/NNNN_*.sql` — *generated* — by `npm run db:generate`
- `src/lib/discussions.ts` — *create* — types, constants (`ADMIN_BOARD_ID`), `resolveBoardId`, label helpers
- `src/lib/discussions-queries.ts` — *create* — read queries: `listAccessibleBoards`, `listThreadsForBoard`, `getThreadWithReplies`
- `src/app/_actions/discussions.ts` — *create* — `createThread`, `postReply`, `softDeleteThread`, `softDeleteReply`
- `src/components/discussions/board-card.tsx` — *create* — boards-landing card
- `src/components/discussions/thread-row.tsx` — *create* — board-page thread row
- `src/components/discussions/new-thread-form.tsx` — *create*, **client** — composer used on board page
- `src/components/discussions/reply-composer.tsx` — *create*, **client** — composer used on thread page
- `src/components/discussions/thread-view.tsx` — *create* — original post + replies render
- `src/app/student/discussions/page.tsx` — *create* — student boards landing
- `src/app/student/discussions/[boardId]/page.tsx` — *create* — student board view
- `src/app/student/discussions/[boardId]/[threadId]/page.tsx` — *create* — student thread view
- `src/app/tutor/discussions/page.tsx` — *create* — tutor boards landing
- `src/app/tutor/discussions/[boardId]/page.tsx` — *create* — tutor board view
- `src/app/tutor/discussions/[boardId]/[threadId]/page.tsx` — *create* — tutor thread view
- `src/app/admin/discussions/page.tsx` — *create* — admin boards landing (all subjects)
- `src/app/admin/discussions/[boardId]/page.tsx` — *create* — admin board view (with delete affordance)
- `src/app/admin/discussions/[boardId]/[threadId]/page.tsx` — *create* — admin thread view (with delete affordance)
- `src/components/portal/shell.tsx` — *modify* — add 3 nav entries (student / tutor / admin)

---

## Task 1: Add schema for discussion threads and replies

**Files:**
- Modify: `src/db/schema.ts`
- Generate: `drizzle/<auto-numbered>_*.sql`

- [ ] **Step 1: Append the two new tables to `src/db/schema.ts`**

Add at the end of the file, before any `relations(...)` block that might exist at the bottom:

```ts
export const discussionThreads = pgTable(
  "discussion_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id").references(() => subjects.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type DiscussionThread = typeof discussionThreads.$inferSelect;
export type DiscussionReply = typeof discussionReplies.$inferSelect;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Ask the user to push the schema**

This project uses `db:push` rather than generated migration files (the `drizzle/` directory does not exist). State to the user:

> "Schema updated to add `discussion_threads` and `discussion_replies`. Please run `npm run db:push` against your Supabase DB. Disclosure: this CREATES two new tables; no existing tables are altered, no data can be lost. Tell me when done."

Wait for user confirmation before proceeding. Do not run `db:push` yourself — it's a destructive action against the live DB per CLAUDE.md.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(discussions): add discussion_threads and discussion_replies tables"
```

---

## Task 2: Shared discussion types and helpers

**Files:**
- Create: `src/lib/discussions.ts`

- [ ] **Step 1: Create the helpers file**

```ts
// src/lib/discussions.ts
import type { UserRole } from "@/db/schema";

/**
 * Sentinel URL segment for the cross-subject Admin / Tech board.
 * Subject boards use the subject UUID; "admin" maps to subject_id IS NULL.
 */
export const ADMIN_BOARD_SEGMENT = "admin";

export type BoardId =
  | { kind: "subject"; subjectId: string }
  | { kind: "admin" };

export function resolveBoardId(segment: string): BoardId | null {
  if (segment === ADMIN_BOARD_SEGMENT) return { kind: "admin" };
  // Accept any non-empty string as a candidate UUID; the query layer is the
  // source of truth for "does this subject exist and can I see it?".
  if (segment.length > 0) return { kind: "subject", subjectId: segment };
  return null;
}

export function boardSegment(board: BoardId): string {
  return board.kind === "admin" ? ADMIN_BOARD_SEGMENT : board.subjectId;
}

export function adminBoardLabel(): string {
  return "Admin / Tech";
}

export function subjectBoardLabel(subject: {
  name: string;
  yearLevel: string | null;
}): string {
  return subject.yearLevel
    ? `Year ${subject.yearLevel} ${subject.name}`
    : subject.name;
}

export const DISCUSSION_ROLES: ReadonlyArray<UserRole> = [
  "student",
  "tutor",
  "admin",
] as const;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/discussions.ts
git commit -m "feat(discussions): add shared types and helpers"
```

---

## Task 3: Shared read queries

**Files:**
- Create: `src/lib/discussions-queries.ts`

This file is server-only — it imports `db` directly. Reads only; writes live in the actions file.

- [ ] **Step 1: Create the queries file**

```ts
// src/lib/discussions-queries.ts
import "server-only";
import { desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  discussionReplies,
  discussionThreads,
  enrollments,
  profiles,
  subjects,
  type UserRole,
} from "@/db/schema";
import {
  adminBoardLabel,
  subjectBoardLabel,
  type BoardId,
} from "@/lib/discussions";

export type BoardSummary = {
  id: BoardId;
  label: string;
  threadCount: number;
  lastActivityAt: Date | null;
};

export type ThreadSummary = {
  id: string;
  title: string;
  authorName: string;
  authorRole: UserRole;
  replyCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  deletedAt: Date | null;
};

export type ThreadDetail = {
  id: string;
  subjectId: string | null;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Date;
  deletedAt: Date | null;
  replies: Array<{
    id: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    body: string;
    createdAt: Date;
    deletedAt: Date | null;
  }>;
};

/**
 * Subject IDs the user has read access to (excluding the admin board, which
 * is always accessible).
 */
async function accessibleSubjectIds(
  userId: string,
  role: UserRole,
): Promise<string[]> {
  if (role === "admin") {
    const all = await db.select({ id: subjects.id }).from(subjects);
    return all.map((s) => s.id);
  }
  if (role === "tutor") {
    const rows = await db
      .selectDistinct({ id: classes.subjectId })
      .from(classes)
      .where(eq(classes.tutorId, userId));
    return rows.map((r) => r.id);
  }
  // student
  const rows = await db
    .selectDistinct({ id: classes.subjectId })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(eq(enrollments.studentId, userId));
  return rows.map((r) => r.id);
}

export async function canSeeBoard(
  userId: string,
  role: UserRole,
  board: BoardId,
): Promise<boolean> {
  if (board.kind === "admin") return true;
  const ids = await accessibleSubjectIds(userId, role);
  return ids.includes(board.subjectId);
}

export async function listAccessibleBoards(
  userId: string,
  role: UserRole,
): Promise<BoardSummary[]> {
  const subjectIds = await accessibleSubjectIds(userId, role);

  const subjectRows = subjectIds.length
    ? await db
        .select({
          id: subjects.id,
          name: subjects.name,
          yearLevel: subjects.yearLevel,
        })
        .from(subjects)
        .where(inArray(subjects.id, subjectIds))
    : [];

  // Aggregate counts + last activity per subject (and one for the admin board).
  const counts = await db
    .select({
      subjectId: discussionThreads.subjectId,
      threadCount: sql<number>`count(*)::int`.as("thread_count"),
      lastActivityAt: sql<Date | null>`max(${discussionThreads.lastActivityAt})`.as(
        "last_activity_at",
      ),
    })
    .from(discussionThreads)
    .where(isNull(discussionThreads.deletedAt))
    .groupBy(discussionThreads.subjectId);

  const countBySubjectId = new Map<string | null, { c: number; t: Date | null }>();
  for (const row of counts) {
    countBySubjectId.set(row.subjectId, {
      c: row.threadCount,
      t: row.lastActivityAt,
    });
  }

  const adminAgg = countBySubjectId.get(null) ?? { c: 0, t: null };

  const subjectBoards: BoardSummary[] = subjectRows.map((s) => {
    const agg = countBySubjectId.get(s.id) ?? { c: 0, t: null };
    return {
      id: { kind: "subject", subjectId: s.id },
      label: subjectBoardLabel({ name: s.name, yearLevel: s.yearLevel }),
      threadCount: agg.c,
      lastActivityAt: agg.t,
    };
  });

  subjectBoards.sort((a, b) => a.label.localeCompare(b.label));

  return [
    {
      id: { kind: "admin" },
      label: adminBoardLabel(),
      threadCount: adminAgg.c,
      lastActivityAt: adminAgg.t,
    },
    ...subjectBoards,
  ];
}

export async function listThreadsForBoard(
  board: BoardId,
): Promise<ThreadSummary[]> {
  const subjectFilter =
    board.kind === "admin"
      ? isNull(discussionThreads.subjectId)
      : eq(discussionThreads.subjectId, board.subjectId);

  const rows = await db
    .select({
      id: discussionThreads.id,
      title: discussionThreads.title,
      createdAt: discussionThreads.createdAt,
      lastActivityAt: discussionThreads.lastActivityAt,
      deletedAt: discussionThreads.deletedAt,
      authorName: sql<string>`coalesce(${profiles.firstName} || ' ' || ${profiles.lastName}, ${profiles.firstName}, 'Unknown')`,
      authorRole: profiles.role,
      replyCount: sql<number>`(select count(*)::int from ${discussionReplies} dr where dr.thread_id = ${discussionThreads.id} and dr.deleted_at is null)`,
    })
    .from(discussionThreads)
    .innerJoin(profiles, eq(profiles.id, discussionThreads.authorId))
    .where(subjectFilter)
    .orderBy(desc(discussionThreads.lastActivityAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    authorName: r.authorName,
    authorRole: r.authorRole,
    replyCount: r.replyCount,
    lastActivityAt: r.lastActivityAt,
    createdAt: r.createdAt,
    deletedAt: r.deletedAt,
  }));
}

export async function getThreadWithReplies(
  threadId: string,
): Promise<ThreadDetail | null> {
  const threadRow = await db
    .select({
      id: discussionThreads.id,
      subjectId: discussionThreads.subjectId,
      title: discussionThreads.title,
      body: discussionThreads.body,
      authorId: discussionThreads.authorId,
      createdAt: discussionThreads.createdAt,
      deletedAt: discussionThreads.deletedAt,
      authorName: sql<string>`coalesce(${profiles.firstName} || ' ' || ${profiles.lastName}, ${profiles.firstName}, 'Unknown')`,
      authorRole: profiles.role,
    })
    .from(discussionThreads)
    .innerJoin(profiles, eq(profiles.id, discussionThreads.authorId))
    .where(eq(discussionThreads.id, threadId))
    .limit(1);

  if (threadRow.length === 0) return null;
  const t = threadRow[0];

  const replyRows = await db
    .select({
      id: discussionReplies.id,
      authorId: discussionReplies.authorId,
      body: discussionReplies.body,
      createdAt: discussionReplies.createdAt,
      deletedAt: discussionReplies.deletedAt,
      authorName: sql<string>`coalesce(${profiles.firstName} || ' ' || ${profiles.lastName}, ${profiles.firstName}, 'Unknown')`,
      authorRole: profiles.role,
    })
    .from(discussionReplies)
    .innerJoin(profiles, eq(profiles.id, discussionReplies.authorId))
    .where(eq(discussionReplies.threadId, threadId))
    .orderBy(discussionReplies.createdAt);

  return {
    id: t.id,
    subjectId: t.subjectId,
    title: t.title,
    body: t.body,
    authorId: t.authorId,
    authorName: t.authorName,
    authorRole: t.authorRole,
    createdAt: t.createdAt,
    deletedAt: t.deletedAt,
    replies: replyRows,
  };
}
```

- [ ] **Step 2: Verify `profiles` has `firstName`/`lastName` columns**

Run: `grep -n "firstName\|lastName" src/db/schema.ts | head -5`
Expected: rows showing both columns on the `profiles` table.

If `profiles` uses a single `fullName` column instead, replace the SQL coalesce with `profiles.fullName` everywhere it appears above.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/discussions-queries.ts
git commit -m "feat(discussions): add board/thread/reply read queries"
```

---

## Task 4: Server actions

**Files:**
- Create: `src/app/_actions/discussions.ts`

- [ ] **Step 1: Create the actions file**

```ts
// src/app/_actions/discussions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  discussionReplies,
  discussionThreads,
  notifications,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { canSeeBoard } from "@/lib/discussions-queries";
import {
  resolveBoardId,
  boardSegment,
  type BoardId,
} from "@/lib/discussions";

const TITLE_MAX = 140;
const BODY_MAX = 4000;

const createThreadSchema = z.object({
  boardSegment: z.string().min(1),
  title: z.string().trim().min(1).max(TITLE_MAX),
  body: z.string().trim().min(1).max(BODY_MAX),
  rolePrefix: z.enum(["student", "tutor", "admin"]),
});

const postReplySchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(BODY_MAX),
  rolePrefix: z.enum(["student", "tutor", "admin"]),
});

const softDeleteSchema = z.object({
  kind: z.enum(["thread", "reply"]),
  id: z.string().uuid(),
});

export async function createThread(formData: FormData) {
  const parsed = createThreadSchema.parse({
    boardSegment: formData.get("boardSegment"),
    title: formData.get("title"),
    body: formData.get("body"),
    rolePrefix: formData.get("rolePrefix"),
  });

  const user = await requireRole(parsed.rolePrefix);
  const board = resolveBoardId(parsed.boardSegment);
  if (!board) throw new Error("Invalid board");

  const allowed = await canSeeBoard(user.id, user.role, board);
  if (!allowed) throw new Error("Forbidden");

  const inserted = await db
    .insert(discussionThreads)
    .values({
      subjectId: board.kind === "admin" ? null : board.subjectId,
      authorId: user.id,
      title: parsed.title,
      body: parsed.body,
    })
    .returning({ id: discussionThreads.id });

  const newId = inserted[0].id;
  const seg = boardSegment(board);

  revalidatePath(`/${parsed.rolePrefix}/discussions`);
  revalidatePath(`/${parsed.rolePrefix}/discussions/${seg}`);
  redirect(`/${parsed.rolePrefix}/discussions/${seg}/${newId}`);
}

export async function postReply(formData: FormData) {
  const parsed = postReplySchema.parse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
    rolePrefix: formData.get("rolePrefix"),
  });

  const user = await requireRole(parsed.rolePrefix);

  // Re-fetch the thread to: (a) confirm it exists, (b) get its board for the
  // permission check, (c) get the author for notification routing.
  const threadRow = await db
    .select({
      id: discussionThreads.id,
      subjectId: discussionThreads.subjectId,
      authorId: discussionThreads.authorId,
      title: discussionThreads.title,
    })
    .from(discussionThreads)
    .where(eq(discussionThreads.id, parsed.threadId))
    .limit(1);

  if (threadRow.length === 0) throw new Error("Thread not found");
  const thread = threadRow[0];

  const board: BoardId =
    thread.subjectId === null
      ? { kind: "admin" }
      : { kind: "subject", subjectId: thread.subjectId };
  const allowed = await canSeeBoard(user.id, user.role, board);
  if (!allowed) throw new Error("Forbidden");

  await db.transaction(async (tx) => {
    await tx.insert(discussionReplies).values({
      threadId: thread.id,
      authorId: user.id,
      body: parsed.body,
    });
    await tx
      .update(discussionThreads)
      .set({ lastActivityAt: new Date() })
      .where(eq(discussionThreads.id, thread.id));
  });

  // Notification: notify thread author when someone else replies, but only if
  // they don't already have an unread discussion_reply ping for this thread.
  if (thread.authorId !== user.id) {
    const href = `/${parsed.rolePrefix}/discussions/${boardSegment(board)}/${thread.id}`;
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, thread.authorId),
          eq(notifications.href, href),
          isNull(notifications.readAt),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(notifications).values({
        userId: thread.authorId,
        channel: "in_app" as const,
        title: `New reply on "${thread.title}"`,
        body: null,
        href,
      });
    }
  }

  revalidatePath(
    `/${parsed.rolePrefix}/discussions/${boardSegment(board)}/${thread.id}`,
  );
  revalidatePath(`/${parsed.rolePrefix}/discussions/${boardSegment(board)}`);
}

export async function softDelete(formData: FormData) {
  const parsed = softDeleteSchema.parse({
    kind: formData.get("kind"),
    id: formData.get("id"),
  });

  await requireRole("admin");

  if (parsed.kind === "thread") {
    await db
      .update(discussionThreads)
      .set({ deletedAt: new Date() })
      .where(eq(discussionThreads.id, parsed.id));
  } else {
    await db
      .update(discussionReplies)
      .set({ deletedAt: new Date() })
      .where(eq(discussionReplies.id, parsed.id));
  }

  revalidatePath("/admin/discussions");
}
```

- [ ] **Step 2: Verify `requireRole` signature**

Run: `grep -n "export.*requireRole" src/lib/auth.ts`
Expected: a function `requireRole(role: UserRole)` returning a user-like object with `.id` and `.role` properties.

If the function signature differs, adjust the call site in the actions file accordingly. The action uses `parsed.rolePrefix` (validated by Zod to be one of `"student" | "tutor" | "admin"`) as the role argument — this ensures the form's claimed role matches the user's actual role.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/_actions/discussions.ts src/lib/auth.ts
git commit -m "feat(discussions): server actions for thread/reply create + admin soft-delete"
```

---

## Task 5: Shared UI components

**Files:**
- Create: `src/components/discussions/board-card.tsx`
- Create: `src/components/discussions/thread-row.tsx`
- Create: `src/components/discussions/thread-view.tsx`
- Create: `src/components/discussions/new-thread-form.tsx` (client)
- Create: `src/components/discussions/reply-composer.tsx` (client)

- [ ] **Step 1: Create `board-card.tsx`**

```tsx
// src/components/discussions/board-card.tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { BoardSummary } from "@/lib/discussions-queries";
import { boardSegment } from "@/lib/discussions";

export function BoardCard({
  board,
  hrefPrefix,
}: {
  board: BoardSummary;
  hrefPrefix: string; // e.g. "/student/discussions"
}) {
  const href = `${hrefPrefix}/${boardSegment(board.id)}`;
  const lastActive = board.lastActivityAt
    ? board.lastActivityAt.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      })
    : "No activity yet";

  return (
    <Link
      href={href}
      className="group block transition-transform hover:-translate-y-0.5"
    >
      <Card className="p-5 h-full">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium mb-2">
          {board.id.kind === "admin" ? "General" : "Subject"}
        </div>
        <div className="text-lg font-semibold text-ink leading-tight">
          {board.label}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-ink-soft">
          <span className="tabular-nums">
            {board.threadCount} {board.threadCount === 1 ? "thread" : "threads"}
          </span>
          <span>{lastActive}</span>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Create `thread-row.tsx`**

```tsx
// src/components/discussions/thread-row.tsx
import Link from "next/link";
import type { ThreadSummary } from "@/lib/discussions-queries";

export function ThreadRow({
  thread,
  hrefPrefix,
}: {
  thread: ThreadSummary;
  hrefPrefix: string; // e.g. "/student/discussions/<boardSegment>"
}) {
  const deleted = thread.deletedAt !== null;
  const title = deleted ? "[removed by admin]" : thread.title;
  const activity = thread.lastActivityAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });

  return (
    <Link
      href={`${hrefPrefix}/${thread.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-50/50"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink truncate">{title}</div>
        <div className="text-[11px] text-muted truncate">
          {thread.authorName} · {thread.authorRole}
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-[0.12em] tabular-nums text-ink-soft hidden sm:inline">
        {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
      </div>
      <div className="text-[11px] uppercase tracking-[0.12em] tabular-nums text-ink-soft">
        {activity}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create `thread-view.tsx`**

```tsx
// src/components/discussions/thread-view.tsx
import { Card } from "@/components/ui/card";
import type { ThreadDetail } from "@/lib/discussions-queries";

export function ThreadView({ thread }: { thread: ThreadDetail }) {
  return (
    <div className="space-y-4">
      <PostBlock
        title={thread.deletedAt ? "[removed by admin]" : thread.title}
        body={thread.deletedAt ? "" : thread.body}
        authorName={thread.authorName}
        authorRole={thread.authorRole}
        createdAt={thread.createdAt}
      />
      {thread.replies.length > 0 && (
        <Card className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-ink-soft font-medium">
            Replies
          </div>
          {thread.replies.map((r) => (
            <ReplyBlock
              key={r.id}
              body={r.deletedAt ? "[removed by admin]" : r.body}
              authorName={r.authorName}
              authorRole={r.authorRole}
              createdAt={r.createdAt}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function PostBlock({
  title,
  body,
  authorName,
  authorRole,
  createdAt,
}: {
  title: string;
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: Date;
}) {
  const stamp = createdAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <Card>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
        {authorName} · {authorRole} · {stamp}
      </div>
      <h2 className="mt-2 text-xl font-semibold text-ink">{title}</h2>
      {body && (
        <p className="mt-3 text-sm text-ink whitespace-pre-wrap leading-relaxed">
          {body}
        </p>
      )}
    </Card>
  );
}

function ReplyBlock({
  body,
  authorName,
  authorRole,
  createdAt,
}: {
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: Date;
}) {
  const stamp = createdAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
  return (
    <div className="border-t border-hairline/60 pt-4 first:border-0 first:pt-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
        {authorName} · {authorRole} · {stamp}
      </div>
      <p className="mt-2 text-sm text-ink whitespace-pre-wrap leading-relaxed">
        {body}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create `new-thread-form.tsx`**

```tsx
// src/components/discussions/new-thread-form.tsx
"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { createThread } from "@/app/_actions/discussions";

export function NewThreadForm({
  boardSegment,
  rolePrefix,
}: {
  boardSegment: string;
  rolePrefix: "student" | "tutor" | "admin";
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Card>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          + Ask a question
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <form
        action={(fd) => {
          fd.append("boardSegment", boardSegment);
          fd.append("rolePrefix", rolePrefix);
          startTransition(() => {
            void createThread(fd);
          });
        }}
        className="space-y-3"
      >
        <input
          name="title"
          required
          maxLength={140}
          placeholder="Title (e.g. Question about Q5 in chapter 3)"
          className="w-full rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm focus:outline-none focus:border-brand-600"
        />
        <textarea
          name="body"
          required
          maxLength={4000}
          rows={4}
          placeholder="Add details — what you've tried, where you're stuck."
          className="w-full rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm focus:outline-none focus:border-brand-600"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Posting…" : "Post"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="text-sm text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
```

- [ ] **Step 5: Create `reply-composer.tsx`**

```tsx
// src/components/discussions/reply-composer.tsx
"use client";

import { useRef, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { postReply } from "@/app/_actions/discussions";

export function ReplyComposer({
  threadId,
  rolePrefix,
}: {
  threadId: string;
  rolePrefix: "student" | "tutor" | "admin";
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <form
        ref={formRef}
        action={(fd) => {
          fd.append("threadId", threadId);
          fd.append("rolePrefix", rolePrefix);
          startTransition(async () => {
            await postReply(fd);
            formRef.current?.reset();
          });
        }}
        className="space-y-3"
      >
        <textarea
          name="body"
          required
          maxLength={4000}
          rows={3}
          placeholder="Write a reply…"
          className="w-full rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm focus:outline-none focus:border-brand-600"
        />
        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Posting…" : "Reply"}
          </button>
        </div>
      </form>
    </Card>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/discussions/
git commit -m "feat(discussions): shared UI components"
```

---

## Task 6: Student routes

**Files:**
- Create: `src/app/student/discussions/page.tsx`
- Create: `src/app/student/discussions/[boardId]/page.tsx`
- Create: `src/app/student/discussions/[boardId]/[threadId]/page.tsx`

- [ ] **Step 1: Create the boards-landing page**

```tsx
// src/app/student/discussions/page.tsx
import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { BoardCard } from "@/components/discussions/board-card";

export default async function StudentDiscussionsPage() {
  const user = await requireRole("student");
  const boards = await listAccessibleBoards(user.id, "student");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Discussions
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Ask questions on your subject boards or the general help board.
        </p>
      </header>
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((b) => (
          <BoardCard
            key={b.id.kind === "admin" ? "admin" : b.id.subjectId}
            board={b}
            hrefPrefix="/student/discussions"
          />
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create the board view page**

```tsx
// src/app/student/discussions/[boardId]/page.tsx
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  listThreadsForBoard,
} from "@/lib/discussions-queries";
import {
  adminBoardLabel,
  resolveBoardId,
  subjectBoardLabel,
} from "@/lib/discussions";
import { ThreadRow } from "@/components/discussions/thread-row";
import { NewThreadForm } from "@/components/discussions/new-thread-form";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function StudentBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const user = await requireRole("student");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "student", board))) notFound();

  const threads = await listThreadsForBoard(board);

  let label = adminBoardLabel();
  if (board.kind === "subject") {
    const subj = await db
      .select({ name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .where(eq(subjects.id, board.subjectId))
      .limit(1);
    if (subj.length === 0) notFound();
    label = subjectBoardLabel(subj[0]);
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Discussions
        </div>
        <h1 className="mt-1 text-3xl lg:text-4xl font-medium tracking-tight text-ink">
          {label}
        </h1>
      </header>
      <NewThreadForm boardSegment={boardId} rolePrefix="student" />
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No questions yet. Be the first to ask.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {threads.map((t) => (
              <li key={t.id}>
                <ThreadRow
                  thread={t}
                  hrefPrefix={`/student/discussions/${boardId}`}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the thread view page**

```tsx
// src/app/student/discussions/[boardId]/[threadId]/page.tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  getThreadWithReplies,
} from "@/lib/discussions-queries";
import { resolveBoardId } from "@/lib/discussions";
import { ThreadView } from "@/components/discussions/thread-view";
import { ReplyComposer } from "@/components/discussions/reply-composer";

export default async function StudentThreadPage({
  params,
}: {
  params: Promise<{ boardId: string; threadId: string }>;
}) {
  const { boardId, threadId } = await params;
  const user = await requireRole("student");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "student", board))) notFound();

  const thread = await getThreadWithReplies(threadId);
  if (!thread) notFound();

  // Confirm thread actually belongs to this board.
  const threadBoardSegment =
    thread.subjectId === null ? "admin" : thread.subjectId;
  if (threadBoardSegment !== boardId) notFound();

  return (
    <div className="space-y-6">
      <ThreadView thread={thread} />
      <ReplyComposer threadId={thread.id} rolePrefix="student" />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/student/discussions/
git commit -m "feat(discussions): student routes"
```

---

## Task 7: Tutor routes

**Files:**
- Create: `src/app/tutor/discussions/page.tsx`
- Create: `src/app/tutor/discussions/[boardId]/page.tsx`
- Create: `src/app/tutor/discussions/[boardId]/[threadId]/page.tsx`

The three files are identical to Task 6 except:
- `requireRole("student")` → `requireRole("tutor")`
- `"student"` (role param to queries) → `"tutor"`
- All URL prefixes `/student/discussions` → `/tutor/discussions`
- `rolePrefix="student"` props → `rolePrefix="tutor"`

- [ ] **Step 1: Create `src/app/tutor/discussions/page.tsx`**

```tsx
import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { BoardCard } from "@/components/discussions/board-card";

export default async function TutorDiscussionsPage() {
  const user = await requireRole("tutor");
  const boards = await listAccessibleBoards(user.id, "tutor");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Discussions
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Answer student questions on the boards for your classes.
        </p>
      </header>
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((b) => (
          <BoardCard
            key={b.id.kind === "admin" ? "admin" : b.id.subjectId}
            board={b}
            hrefPrefix="/tutor/discussions"
          />
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/tutor/discussions/[boardId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  listThreadsForBoard,
} from "@/lib/discussions-queries";
import {
  adminBoardLabel,
  resolveBoardId,
  subjectBoardLabel,
} from "@/lib/discussions";
import { ThreadRow } from "@/components/discussions/thread-row";
import { NewThreadForm } from "@/components/discussions/new-thread-form";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function TutorBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const user = await requireRole("tutor");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "tutor", board))) notFound();

  const threads = await listThreadsForBoard(board);

  let label = adminBoardLabel();
  if (board.kind === "subject") {
    const subj = await db
      .select({ name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .where(eq(subjects.id, board.subjectId))
      .limit(1);
    if (subj.length === 0) notFound();
    label = subjectBoardLabel(subj[0]);
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Discussions
        </div>
        <h1 className="mt-1 text-3xl lg:text-4xl font-medium tracking-tight text-ink">
          {label}
        </h1>
      </header>
      <NewThreadForm boardSegment={boardId} rolePrefix="tutor" />
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No questions yet on this board.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {threads.map((t) => (
              <li key={t.id}>
                <ThreadRow
                  thread={t}
                  hrefPrefix={`/tutor/discussions/${boardId}`}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/tutor/discussions/[boardId]/[threadId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  getThreadWithReplies,
} from "@/lib/discussions-queries";
import { resolveBoardId } from "@/lib/discussions";
import { ThreadView } from "@/components/discussions/thread-view";
import { ReplyComposer } from "@/components/discussions/reply-composer";

export default async function TutorThreadPage({
  params,
}: {
  params: Promise<{ boardId: string; threadId: string }>;
}) {
  const { boardId, threadId } = await params;
  const user = await requireRole("tutor");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "tutor", board))) notFound();

  const thread = await getThreadWithReplies(threadId);
  if (!thread) notFound();

  const threadBoardSegment =
    thread.subjectId === null ? "admin" : thread.subjectId;
  if (threadBoardSegment !== boardId) notFound();

  return (
    <div className="space-y-6">
      <ThreadView thread={thread} />
      <ReplyComposer threadId={thread.id} rolePrefix="tutor" />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/tutor/discussions/
git commit -m "feat(discussions): tutor routes"
```

---

## Task 8: Admin routes

**Files:**
- Create: `src/app/admin/discussions/page.tsx`
- Create: `src/app/admin/discussions/[boardId]/page.tsx`
- Create: `src/app/admin/discussions/[boardId]/[threadId]/page.tsx`

Admin sees every board and gains a soft-delete affordance on threads and replies.

- [ ] **Step 1: Create `src/app/admin/discussions/page.tsx`**

```tsx
import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { BoardCard } from "@/components/discussions/board-card";

export default async function AdminDiscussionsPage() {
  const user = await requireRole("admin");
  const boards = await listAccessibleBoards(user.id, "admin");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Discussions
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Oversight across every subject board and the Admin / Tech board.
        </p>
      </header>
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((b) => (
          <BoardCard
            key={b.id.kind === "admin" ? "admin" : b.id.subjectId}
            board={b}
            hrefPrefix="/admin/discussions"
          />
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/discussions/[boardId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  listThreadsForBoard,
} from "@/lib/discussions-queries";
import {
  adminBoardLabel,
  resolveBoardId,
  subjectBoardLabel,
} from "@/lib/discussions";
import { ThreadRow } from "@/components/discussions/thread-row";
import { NewThreadForm } from "@/components/discussions/new-thread-form";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AdminBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const user = await requireRole("admin");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "admin", board))) notFound();

  const threads = await listThreadsForBoard(board);

  let label = adminBoardLabel();
  if (board.kind === "subject") {
    const subj = await db
      .select({ name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .where(eq(subjects.id, board.subjectId))
      .limit(1);
    if (subj.length === 0) notFound();
    label = subjectBoardLabel(subj[0]);
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Discussions
        </div>
        <h1 className="mt-1 text-3xl lg:text-4xl font-medium tracking-tight text-ink">
          {label}
        </h1>
      </header>
      <NewThreadForm boardSegment={boardId} rolePrefix="admin" />
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No questions yet on this board.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {threads.map((t) => (
              <li key={t.id}>
                <ThreadRow
                  thread={t}
                  hrefPrefix={`/admin/discussions/${boardId}`}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

(The delete affordance lives on the thread view page where the admin can see context.)

- [ ] **Step 3: Create `src/app/admin/discussions/[boardId]/[threadId]/page.tsx`**

```tsx
// src/app/admin/discussions/[boardId]/[threadId]/page.tsx
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  getThreadWithReplies,
} from "@/lib/discussions-queries";
import { resolveBoardId } from "@/lib/discussions";
import { ThreadView } from "@/components/discussions/thread-view";
import { ReplyComposer } from "@/components/discussions/reply-composer";
import { softDelete } from "@/app/_actions/discussions";

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ boardId: string; threadId: string }>;
}) {
  const { boardId, threadId } = await params;
  const user = await requireRole("admin");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "admin", board))) notFound();

  const thread = await getThreadWithReplies(threadId);
  if (!thread) notFound();

  const threadBoardSegment =
    thread.subjectId === null ? "admin" : thread.subjectId;
  if (threadBoardSegment !== boardId) notFound();

  return (
    <div className="space-y-6">
      <ThreadView thread={thread} />

      {/* Admin controls */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium mb-3">
          Admin controls
        </div>
        {!thread.deletedAt && (
          <form action={softDelete} className="inline-block mr-2">
            <input type="hidden" name="kind" value="thread" />
            <input type="hidden" name="id" value={thread.id} />
            <button
              type="submit"
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              Remove thread
            </button>
          </form>
        )}
        {thread.replies.filter((r) => !r.deletedAt).map((r) => (
          <form action={softDelete} key={r.id} className="inline-block mr-2 mt-2">
            <input type="hidden" name="kind" value="reply" />
            <input type="hidden" name="id" value={r.id} />
            <button
              type="submit"
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              Remove reply by {r.authorName}
            </button>
          </form>
        ))}
      </Card>

      <ReplyComposer threadId={thread.id} rolePrefix="admin" />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/discussions/
git commit -m "feat(discussions): admin routes with soft-delete controls"
```

---

## Task 9: Navigation

**Files:**
- Modify: `src/components/portal/shell.tsx`

- [ ] **Step 1: Add icon import**

Locate the lucide-react import block at the top of `src/components/portal/shell.tsx`. Add `MessagesSquare` to the import list (keep the existing alphabetical-ish order).

```ts
import {
  // ...existing icons...
  MessagesSquare,
  // ...existing icons...
} from "lucide-react";
```

- [ ] **Step 2: Add nav entry to student**

In the `NAV_BY_ROLE.student` array, after the "Homework" entry, insert:

```ts
{ label: "Discussions", href: "/student/discussions", icon: <MessagesSquare className={ICON_CLASS} /> },
```

- [ ] **Step 3: Add nav entry to tutor**

In the `NAV_BY_ROLE.tutor` array, after the "Notes" entry, insert:

```ts
{ label: "Discussions", href: "/tutor/discussions", icon: <MessagesSquare className={ICON_CLASS} /> },
```

- [ ] **Step 4: Add nav entry to admin**

In the `NAV_BY_ROLE.admin` array, after the "Announcements" entry, insert:

```ts
{ label: "Discussions", href: "/admin/discussions", icon: <MessagesSquare className={ICON_CLASS} /> },
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/portal/shell.tsx
git commit -m "feat(discussions): add nav entry for student/tutor/admin"
```

---

## Task 10: Manual verification

The codebase has no test framework. Verification is a guided browser walkthrough by the user.

- [ ] **Step 1: Ask the user to start the dev server**

Tell the user: "Please start the dev server (`npm run dev`) and walk through the checks below. I'll wait for your report on each."

- [ ] **Step 2: Student walkthrough**

Ask the user to log in as a student enrolled in at least one subject, then:

1. Visit `/student/discussions`. **Expect:** sees the Admin/Tech board + at least one subject board matching their enrolment. Does NOT see boards for subjects they aren't enrolled in.
2. Click into a subject board. **Expect:** empty state "No questions yet. Be the first to ask." + an "Ask a question" button.
3. Click "Ask a question", post a thread. **Expect:** redirect to the thread page showing the post they just made.
4. Reply to the thread. **Expect:** reply appears below; form clears.
5. Back to the board. **Expect:** thread shows with reply count = 1 and updated last activity.

- [ ] **Step 3: Tutor walkthrough**

Ask the user to log in as a tutor teaching the same subject the student just posted in.

1. Visit `/tutor/discussions`. **Expect:** that subject's board listed, plus Admin/Tech. Does NOT see subjects they don't teach.
2. Open the thread the student created. Post a reply.
3. **Expect:** in Supabase / DB tool, a new row in `notifications` for the student-user with `href` pointing at the thread. Body title is `New reply on "<thread title>"`.

- [ ] **Step 4: Admin walkthrough**

Ask the user to log in as an admin.

1. Visit `/admin/discussions`. **Expect:** every subject board listed, plus Admin/Tech.
2. Open the same thread. **Expect:** "Admin controls" card with "Remove thread" + "Remove reply by …" buttons.
3. Click "Remove reply by …" for the tutor's reply. **Expect:** page reload, reply renders as `[removed by admin]`, original author name still visible.
4. Click "Remove thread". **Expect:** page reload, title renders as `[removed by admin]`, body is hidden.

- [ ] **Step 5: Permission negative test**

Ask the user to visit `/parent/discussions` while logged in as a parent.

**Expect:** 404 (route does not exist).

Ask the user, logged in as a student, to manually paste a board URL for a subject they're NOT enrolled in (e.g. `/student/discussions/<some-other-subject-uuid>`).

**Expect:** 404 (board access denied).

- [ ] **Step 6: Report**

If any step above fails, capture the symptom and tell me which task/file to revisit. Otherwise, mark the feature shipped.

---

## Self-review notes (for the executor)

- Task 4 uses `requireRole(parsed.rolePrefix)` rather than a multi-role helper, so the form's claimed role must match the user's actual role. If your `requireRole` signature differs (e.g. takes options object), adjust the four call sites in the actions file.
- Task 3 Step 2 checks whether `profiles` has `firstName`/`lastName` columns. If the schema uses a single `fullName` column, replace the SQL coalesce expression with `profiles.fullName` everywhere it appears.
- The "ask user to apply migration" step in Task 1 is non-negotiable — `drizzle-kit push` against the live Supabase DB is the destructive action this codebase's CLAUDE.md explicitly fences off.
- If the working tree was not cleaned before Task 1, the generated migration file will include unrelated ALTER statements from in-flight schema changes. If that happens, revert the migration generation, clean the tree, and regenerate.
- `notifications` writes use the existing channel enum default `in_app`. The notification href is also used for deduplication — if you change the href format, also change the dedup query.
