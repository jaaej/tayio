# Direct Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship in-portal 1:1 direct messaging for parent / student / tutor / admin, with relationship-based permissions and a Messenger-style UI.

**Architecture:** Three new tables (`dm_threads`, `dm_messages`, `dm_reads`) with canonical pair ordering on the threads (`userAId < userBId`). Shared server actions in `src/app/_actions/dm.ts`. Shared read queries + a permission helper in `src/lib/dm-queries.ts` and `src/lib/dm-permissions.ts`. Each role gets three thin route wrappers under `/{role}/messages/...`. Notifications reuse the existing table. No realtime — request-revalidate model.

**Tech Stack:** Next.js 16 App Router (server components by default, client only where state is needed), React 19, Drizzle ORM over Postgres, Supabase auth, Tailwind v4, Zod for action validation, lucide-react for icons.

**Reference spec:** `docs/superpowers/specs/2026-05-27-direct-messaging-design.md`

---

## Pre-flight

This project uses `db:push` (no `drizzle/` migration directory). The executor does **not** run `db:push` themselves — the user runs it after each schema change, after disclosure of effect. CLAUDE.md gates this.

The codebase has no test framework. Verification is `npm run typecheck` (passes `tsc --noEmit`) at each task boundary + a manual browser walkthrough at the end (Task 12). The user starts the dev server themselves (per `feedback_dev_server.md`).

Key gotchas:
- `db` lives at `@/db/client` (not `@/db`). Don't repeat last session's import mistake.
- `requireRole(role: UserRole)` from `@/lib/auth` returns the Supabase user object (`.id`, `.email`, `.app_metadata.role`). It does NOT return a `.role` property directly on the user. Use the role you passed in.
- `profiles` table has `firstName`, `lastName`, `email`, `phone`, `role` (enum: `student|parent|tutor|admin`).

---

## File map

**New files:**
- `src/db/schema.ts` — *modify* — append `dmThreads`, `dmMessages`, `dmReads` + add `uniqueIndex` import
- `src/lib/dm.ts` — *create* — types, label helpers, canonical-pair sort
- `src/lib/dm-permissions.ts` — *create* — `canDM(meId, meRole, targetId, targetRole)` with relationship checks
- `src/lib/dm-queries.ts` — *create* — `listMyThreads`, `getThreadForMe`, `getThreadByPair`, `getOrCreateThread`, `getUnreadThreadCount`
- `src/app/_actions/dm.ts` — *create* — `sendMessage`, `markThreadRead`
- `src/components/dm/thread-row.tsx` — *create* — inbox list item
- `src/components/dm/message-list.tsx` — *create* — message bubbles, sender right / recipient left
- `src/components/dm/message-composer.tsx` — *create*, **client** — textarea + send, Enter to submit
- `src/app/parent/messages/page.tsx` — *create*
- `src/app/parent/messages/[threadId]/page.tsx` — *create*
- `src/app/parent/messages/with/[userId]/page.tsx` — *create*
- `src/app/student/messages/page.tsx` — *create*
- `src/app/student/messages/[threadId]/page.tsx` — *create*
- `src/app/student/messages/with/[userId]/page.tsx` — *create*
- `src/app/tutor/messages/page.tsx` — *create*
- `src/app/tutor/messages/[threadId]/page.tsx` — *create*
- `src/app/tutor/messages/with/[userId]/page.tsx` — *create*
- `src/app/admin/messages/page.tsx` — *create*
- `src/app/admin/messages/[threadId]/page.tsx` — *create*
- `src/app/admin/messages/with/[userId]/page.tsx` — *create*

**Modified files:**
- `src/components/portal/shell.tsx` — add Messages nav entry × 4 roles + `MessageCircle` icon import
- `src/app/parent/page.tsx` — add Message buttons on contact rows (`ContactRow` already exists at line 432; we add a `userId` prop + a button)
- `src/app/student/page.tsx` — add a contact card with Message buttons for tutors + admin
- `src/app/tutor/students/[id]/page.tsx` — add Message buttons for the student + each linked parent
- `src/app/admin/users/[id]/page.tsx` — add Message button at top of detail card

---

## Task 1: Schema for dm_threads + dm_messages + dm_reads

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `uniqueIndex` to the drizzle import**

Find the import block at the top of `src/db/schema.ts` that imports from `drizzle-orm/pg-core`. Add `uniqueIndex` to the list (keep alphabetical-ish order).

```ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  time,
  numeric,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Append the three new tables**

Insert at the end of the file, before any `relations(...)` block at the bottom:

```ts
export const dmThreads = pgTable(
  "dm_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    threadId: uuid("thread_id")
      .notNull()
      .references(() => dmThreads.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("dm_messages_thread_idx").on(t.threadId, t.createdAt)],
);

export const dmReads = pgTable(
  "dm_reads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => dmThreads.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.threadId] })],
);

export type DmThread = typeof dmThreads.$inferSelect;
export type DmMessage = typeof dmMessages.$inferSelect;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 4: Ask the user to push**

Say to the user:

> "Schema updated to add `dm_threads`, `dm_messages`, `dm_reads`. Disclosure: creates three new tables + their indexes; no existing tables altered, no data possibly lost. Please run `npm run db:push` and tell me when done."

Wait for user confirmation before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(dm): add dm_threads, dm_messages, dm_reads schema"
```

---

## Task 2: DM helpers + types

**Files:**
- Create: `src/lib/dm.ts`

- [ ] **Step 1: Create the helpers file**

```ts
// src/lib/dm.ts
import type { UserRole } from "@/db/schema";

/**
 * Canonical pair ordering — smaller UUID becomes userAId, larger becomes userBId.
 * Ensures there is only one row per pair in dm_threads regardless of who started.
 */
export function canonicalPair(
  x: string,
  y: string,
): { userAId: string; userBId: string } {
  return x < y ? { userAId: x, userBId: y } : { userAId: y, userBId: x };
}

/** DM-eligible roles (parent | student | tutor | admin). */
export const DM_ROLES: ReadonlyArray<UserRole> = [
  "parent",
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
git add src/lib/dm.ts
git commit -m "feat(dm): canonical pair helper + role list"
```

---

## Task 3: Permission helper

**Files:**
- Create: `src/lib/dm-permissions.ts`

- [ ] **Step 1: Create the permissions file**

```ts
// src/lib/dm-permissions.ts
import "server-only";
import { and, eq, exists } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  profiles,
  type UserRole,
} from "@/db/schema";

/**
 * Can user `me` (with role `meRole`) DM user `target` (with role `targetRole`)?
 * Encodes both the role-pair matrix and the relationship clause.
 */
export async function canDM(
  meId: string,
  meRole: UserRole,
  targetId: string,
  targetRole: UserRole,
): Promise<boolean> {
  if (meId === targetId) return false;
  if (meRole === targetRole) return false;

  // Admin can DM anyone (and vice versa).
  if (meRole === "admin" || targetRole === "admin") return true;

  // Parent ↔ Tutor
  if (
    (meRole === "parent" && targetRole === "tutor") ||
    (meRole === "tutor" && targetRole === "parent")
  ) {
    const parentId = meRole === "parent" ? meId : targetId;
    const tutorId = meRole === "tutor" ? meId : targetId;
    return parentTutorShareClass(parentId, tutorId);
  }

  // Student ↔ Tutor
  if (
    (meRole === "student" && targetRole === "tutor") ||
    (meRole === "tutor" && targetRole === "student")
  ) {
    const studentId = meRole === "student" ? meId : targetId;
    const tutorId = meRole === "tutor" ? meId : targetId;
    return studentTutorShareClass(studentId, tutorId);
  }

  return false;
}

async function parentTutorShareClass(
  parentId: string,
  tutorId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: classes.id })
    .from(familyLinks)
    .innerJoin(enrollments, eq(enrollments.studentId, familyLinks.studentId))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(familyLinks.parentId, parentId), eq(classes.tutorId, tutorId)))
    .limit(1);
  return rows.length > 0;
}

async function studentTutorShareClass(
  studentId: string,
  tutorId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: classes.id })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, studentId), eq(classes.tutorId, tutorId)))
    .limit(1);
  return rows.length > 0;
}

/** Look up a target user's role; returns null if not found. */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.role ?? null;
}
```

- [ ] **Step 2: Verify `exists` is not actually used and remove if unused**

The `exists` import is included above only if the implementation uses it. Re-read the file — it doesn't. Drop the `exists` from the import.

Final import line should be:
```ts
import { and, eq } from "drizzle-orm";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dm-permissions.ts
git commit -m "feat(dm): permission helper with relationship checks"
```

---

## Task 4: Read queries

**Files:**
- Create: `src/lib/dm-queries.ts`

- [ ] **Step 1: Create the queries file**

```ts
// src/lib/dm-queries.ts
import "server-only";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dmMessages,
  dmReads,
  dmThreads,
  profiles,
  type UserRole,
} from "@/db/schema";
import { canonicalPair } from "@/lib/dm";

export type ThreadInboxRow = {
  threadId: string;
  otherUserId: string;
  otherName: string;
  otherRole: UserRole;
  lastMessagePreview: string | null;
  lastActivityAt: Date;
  unread: boolean;
};

export type MessageRow = {
  id: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

/** List the current user's threads, newest activity first. */
export async function listMyThreads(meId: string): Promise<ThreadInboxRow[]> {
  // Pull all threads where I'm a participant. For each, get the other participant,
  // their profile, the most recent message, and my last-read pointer.
  const threadRows = await db
    .select({
      threadId: dmThreads.id,
      userAId: dmThreads.userAId,
      userBId: dmThreads.userBId,
      lastActivityAt: dmThreads.lastActivityAt,
    })
    .from(dmThreads)
    .where(or(eq(dmThreads.userAId, meId), eq(dmThreads.userBId, meId)))
    .orderBy(desc(dmThreads.lastActivityAt));

  if (threadRows.length === 0) return [];

  const out: ThreadInboxRow[] = [];
  for (const t of threadRows) {
    const otherId = t.userAId === meId ? t.userBId : t.userAId;

    const other = await db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        role: profiles.role,
      })
      .from(profiles)
      .where(eq(profiles.id, otherId))
      .limit(1);
    if (other.length === 0) continue;

    const lastMsg = await db
      .select({ body: dmMessages.body, senderId: dmMessages.senderId })
      .from(dmMessages)
      .where(eq(dmMessages.threadId, t.threadId))
      .orderBy(desc(dmMessages.createdAt))
      .limit(1);

    const readRow = await db
      .select({ lastReadAt: dmReads.lastReadAt })
      .from(dmReads)
      .where(and(eq(dmReads.userId, meId), eq(dmReads.threadId, t.threadId)))
      .limit(1);

    const lastReadAt = readRow[0]?.lastReadAt ?? new Date(0);
    const lastMsgSentByOther =
      lastMsg.length > 0 && lastMsg[0].senderId !== meId;
    const unread = lastMsgSentByOther && lastReadAt < t.lastActivityAt;

    out.push({
      threadId: t.threadId,
      otherUserId: otherId,
      otherName: `${other[0].firstName} ${other[0].lastName}`.trim(),
      otherRole: other[0].role,
      lastMessagePreview: lastMsg[0]?.body ?? null,
      lastActivityAt: t.lastActivityAt,
      unread,
    });
  }
  return out;
}

/** Get one thread the current user must be a participant of; null if not theirs or not found. */
export async function getThreadForMe(
  meId: string,
  threadId: string,
): Promise<{
  threadId: string;
  otherUserId: string;
  otherName: string;
  otherRole: UserRole;
  messages: MessageRow[];
} | null> {
  const t = await db
    .select({
      id: dmThreads.id,
      userAId: dmThreads.userAId,
      userBId: dmThreads.userBId,
    })
    .from(dmThreads)
    .where(
      and(
        eq(dmThreads.id, threadId),
        or(eq(dmThreads.userAId, meId), eq(dmThreads.userBId, meId)),
      ),
    )
    .limit(1);
  if (t.length === 0) return null;

  const otherId = t[0].userAId === meId ? t[0].userBId : t[0].userAId;

  const other = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, otherId))
    .limit(1);
  if (other.length === 0) return null;

  const messages = await db
    .select({
      id: dmMessages.id,
      senderId: dmMessages.senderId,
      body: dmMessages.body,
      createdAt: dmMessages.createdAt,
    })
    .from(dmMessages)
    .where(eq(dmMessages.threadId, threadId))
    .orderBy(dmMessages.createdAt);

  return {
    threadId,
    otherUserId: otherId,
    otherName: `${other[0].firstName} ${other[0].lastName}`.trim(),
    otherRole: other[0].role,
    messages,
  };
}

/**
 * Find or create the thread between two users in canonical order.
 * Caller MUST have already authorized the DM via canDM().
 */
export async function getOrCreateThread(
  userX: string,
  userY: string,
): Promise<string> {
  const { userAId, userBId } = canonicalPair(userX, userY);
  const existing = await db
    .select({ id: dmThreads.id })
    .from(dmThreads)
    .where(and(eq(dmThreads.userAId, userAId), eq(dmThreads.userBId, userBId)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const inserted = await db
    .insert(dmThreads)
    .values({ userAId, userBId })
    .returning({ id: dmThreads.id });
  return inserted[0].id;
}

/** Number of threads with at least one unread incoming message for `meId`. */
export async function getUnreadThreadCount(meId: string): Promise<number> {
  const threads = await listMyThreads(meId);
  return threads.filter((t) => t.unread).length;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dm-queries.ts
git commit -m "feat(dm): inbox + thread read queries + getOrCreateThread"
```

---

## Task 5: Server actions

**Files:**
- Create: `src/app/_actions/dm.ts`

- [ ] **Step 1: Create the actions file**

```ts
// src/app/_actions/dm.ts
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  dmMessages,
  dmReads,
  dmThreads,
  notifications,
  profiles,
  type UserRole,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { canDM, getUserRole } from "@/lib/dm-permissions";

const BODY_MAX = 4000;

const sendSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(BODY_MAX),
  rolePrefix: z.enum(["parent", "student", "tutor", "admin"]),
});

const markReadSchema = z.object({
  threadId: z.string().uuid(),
  rolePrefix: z.enum(["parent", "student", "tutor", "admin"]),
});

export async function sendMessage(formData: FormData) {
  const parsed = sendSchema.parse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
    rolePrefix: formData.get("rolePrefix"),
  });

  const user = await requireRole(parsed.rolePrefix);

  // Look up the thread; confirm I'm a participant; identify the other participant.
  const threadRow = await db
    .select({
      id: dmThreads.id,
      userAId: dmThreads.userAId,
      userBId: dmThreads.userBId,
    })
    .from(dmThreads)
    .where(eq(dmThreads.id, parsed.threadId))
    .limit(1);
  if (threadRow.length === 0) throw new Error("Thread not found");
  const t = threadRow[0];
  if (t.userAId !== user.id && t.userBId !== user.id) {
    throw new Error("Forbidden");
  }
  const otherId = t.userAId === user.id ? t.userBId : t.userAId;

  // Re-check relationship — defense in depth.
  const otherRole = await getUserRole(otherId);
  if (!otherRole) throw new Error("Recipient not found");
  const allowed = await canDM(
    user.id,
    parsed.rolePrefix,
    otherId,
    otherRole,
  );
  if (!allowed) throw new Error("Forbidden");

  // Insert + bump activity in one transaction.
  await db.transaction(async (tx) => {
    await tx.insert(dmMessages).values({
      threadId: t.id,
      senderId: user.id,
      body: parsed.body,
    });
    await tx
      .update(dmThreads)
      .set({ lastActivityAt: new Date() })
      .where(eq(dmThreads.id, t.id));
  });

  // Notification dedup: one unread per thread until recipient reads.
  const recipientHref = `/${otherRole}/messages/${t.id}`;
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, otherId),
        eq(notifications.href, recipientHref),
        isNull(notifications.readAt),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    const senderProfile = await db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);
    const senderName = senderProfile[0]
      ? `${senderProfile[0].firstName} ${senderProfile[0].lastName}`.trim()
      : "Someone";
    await db.insert(notifications).values({
      userId: otherId,
      channel: "in_app" as const,
      title: `New message from ${senderName}`,
      body: null,
      href: recipientHref,
    });
  }

  revalidatePath(`/${parsed.rolePrefix}/messages/${t.id}`);
  revalidatePath(`/${parsed.rolePrefix}/messages`);
}

export async function markThreadRead(formData: FormData) {
  const parsed = markReadSchema.parse({
    threadId: formData.get("threadId"),
    rolePrefix: formData.get("rolePrefix"),
  });
  const user = await requireRole(parsed.rolePrefix);

  // Confirm I'm a participant.
  const threadRow = await db
    .select({
      id: dmThreads.id,
      userAId: dmThreads.userAId,
      userBId: dmThreads.userBId,
    })
    .from(dmThreads)
    .where(eq(dmThreads.id, parsed.threadId))
    .limit(1);
  if (threadRow.length === 0) throw new Error("Thread not found");
  const t = threadRow[0];
  if (t.userAId !== user.id && t.userBId !== user.id) {
    throw new Error("Forbidden");
  }

  // Upsert lastReadAt.
  const existing = await db
    .select({ userId: dmReads.userId })
    .from(dmReads)
    .where(and(eq(dmReads.userId, user.id), eq(dmReads.threadId, t.id)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(dmReads).values({
      userId: user.id,
      threadId: t.id,
      lastReadAt: new Date(),
    });
  } else {
    await db
      .update(dmReads)
      .set({ lastReadAt: new Date() })
      .where(and(eq(dmReads.userId, user.id), eq(dmReads.threadId, t.id)));
  }

  // Clear the unread notification, if any.
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.href, `/${parsed.rolePrefix}/messages/${t.id}`),
        isNull(notifications.readAt),
      ),
    );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_actions/dm.ts
git commit -m "feat(dm): sendMessage + markThreadRead server actions"
```

---

## Task 6: Shared UI components

**Files:**
- Create: `src/components/dm/thread-row.tsx`
- Create: `src/components/dm/message-list.tsx`
- Create: `src/components/dm/message-composer.tsx`

- [ ] **Step 1: Create `thread-row.tsx`**

```tsx
// src/components/dm/thread-row.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ThreadInboxRow } from "@/lib/dm-queries";

export function ThreadRow({
  thread,
  hrefPrefix,
}: {
  thread: ThreadInboxRow;
  hrefPrefix: string; // e.g. "/parent/messages"
}) {
  const stamp = thread.lastActivityAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
  return (
    <Link
      href={`${hrefPrefix}/${thread.threadId}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-50/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-ink line-clamp-1">
            {thread.otherName}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
            {thread.otherRole}
          </span>
          {thread.unread && (
            <span
              aria-label="Unread"
              className="ml-1 inline-block h-2 w-2 rounded-full bg-brand-600"
            />
          )}
        </div>
        {thread.lastMessagePreview && (
          <div className="mt-1 text-sm text-ink-soft line-clamp-1">
            {thread.lastMessagePreview}
          </div>
        )}
      </div>
      <div className="text-[11px] uppercase tracking-[0.12em] tabular-nums text-muted shrink-0">
        {stamp}
      </div>
      <ChevronRight
        className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 shrink-0"
        aria-hidden
      />
    </Link>
  );
}
```

- [ ] **Step 2: Create `message-list.tsx`**

```tsx
// src/components/dm/message-list.tsx
import type { MessageRow } from "@/lib/dm-queries";

export function MessageList({
  messages,
  meId,
}: {
  messages: MessageRow[];
  meId: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="text-sm text-ink-soft py-8 text-center">
        No messages yet. Say hi.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {messages.map((m) => {
        const isMe = m.senderId === meId;
        const stamp = m.createdAt.toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit",
        });
        return (
          <div
            key={m.id}
            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                isMe
                  ? "bg-brand-100 text-ink"
                  : "bg-white border border-hairline/60 text-ink"
              }`}
            >
              <p className="text-base whitespace-pre-wrap leading-relaxed">
                {m.body}
              </p>
              <div
                className={`mt-1 text-[10px] uppercase tracking-[0.14em] tabular-nums ${
                  isMe ? "text-brand-700/70" : "text-muted"
                }`}
              >
                {stamp}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `message-composer.tsx`**

```tsx
// src/components/dm/message-composer.tsx
"use client";

import { useRef, useTransition } from "react";
import { sendMessage } from "@/app/_actions/dm";

export function MessageComposer({
  threadId,
  rolePrefix,
}: {
  threadId: string;
  rolePrefix: "parent" | "student" | "tutor" | "admin";
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        fd.append("threadId", threadId);
        fd.append("rolePrefix", rolePrefix);
        startTransition(async () => {
          await sendMessage(fd);
          formRef.current?.reset();
        });
      }}
      className="flex items-end gap-2 rounded-xl border border-hairline/60 bg-card p-3"
    >
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={2}
        placeholder="Write a message…"
        onKeyDown={handleKey}
        className="flex-1 resize-none bg-transparent border-0 outline-none text-base placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/dm/
git commit -m "feat(dm): shared UI components"
```

---

## Task 7: Parent routes

**Files:**
- Create: `src/app/parent/messages/page.tsx`
- Create: `src/app/parent/messages/[threadId]/page.tsx`
- Create: `src/app/parent/messages/with/[userId]/page.tsx`

- [ ] **Step 1: Create the inbox page**

```tsx
// src/app/parent/messages/page.tsx
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function ParentMessagesPage() {
  const user = await requireRole("parent");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Messages
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Conversations with your child's tutors and the admin office.
        </p>
      </header>
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No conversations yet. Start one from a contact card.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/parent/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the thread page**

```tsx
// src/app/parent/messages/[threadId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
import { markThreadRead } from "@/app/_actions/dm";

export default async function ParentThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireRole("parent");
  const thread = await getThreadForMe(user.id, threadId);
  if (!thread) notFound();

  // Mark as read on view. Fire-and-forget at the page boundary.
  const fd = new FormData();
  fd.append("threadId", threadId);
  fd.append("rolePrefix", "parent");
  await markThreadRead(fd);

  return (
    <div className="space-y-4 flex flex-col h-[calc(100dvh-160px)]">
      <Link
        href="/parent/messages"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted hover:text-ink font-medium"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Messages
      </Link>
      <Card className="px-5 py-3 flex items-baseline gap-2 shrink-0">
        <div className="text-lg font-semibold text-ink">{thread.otherName}</div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
          {thread.otherRole}
        </div>
      </Card>
      <Card className="flex-1 overflow-y-auto p-5">
        <MessageList messages={thread.messages} meId={user.id} />
      </Card>
      <MessageComposer threadId={thread.threadId} rolePrefix="parent" />
    </div>
  );
}
```

- [ ] **Step 3: Create the `/with/[userId]` resolver page**

```tsx
// src/app/parent/messages/with/[userId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canDM, getUserRole } from "@/lib/dm-permissions";
import { getOrCreateThread } from "@/lib/dm-queries";

export default async function ParentDMWithPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await requireRole("parent");

  const targetRole = await getUserRole(userId);
  if (!targetRole) notFound();
  if (!(await canDM(user.id, "parent", userId, targetRole))) notFound();

  const threadId = await getOrCreateThread(user.id, userId);
  redirect(`/parent/messages/${threadId}`);
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/parent/messages/
git commit -m "feat(dm): parent routes"
```

---

## Task 8: Student routes

**Files:**
- Create: `src/app/student/messages/page.tsx`
- Create: `src/app/student/messages/[threadId]/page.tsx`
- Create: `src/app/student/messages/with/[userId]/page.tsx`

- [ ] **Step 1: Create the inbox page**

```tsx
// src/app/student/messages/page.tsx
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function StudentMessagesPage() {
  const user = await requireRole("student");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Messages
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Conversations with your tutors and the admin office.
        </p>
      </header>
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No conversations yet. Start one from a contact card.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/student/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the thread page**

```tsx
// src/app/student/messages/[threadId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
import { markThreadRead } from "@/app/_actions/dm";

export default async function StudentThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireRole("student");
  const thread = await getThreadForMe(user.id, threadId);
  if (!thread) notFound();

  const fd = new FormData();
  fd.append("threadId", threadId);
  fd.append("rolePrefix", "student");
  await markThreadRead(fd);

  return (
    <div className="space-y-4 flex flex-col h-[calc(100dvh-160px)]">
      <Link
        href="/student/messages"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted hover:text-ink font-medium"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Messages
      </Link>
      <Card className="px-5 py-3 flex items-baseline gap-2 shrink-0">
        <div className="text-lg font-semibold text-ink">{thread.otherName}</div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
          {thread.otherRole}
        </div>
      </Card>
      <Card className="flex-1 overflow-y-auto p-5">
        <MessageList messages={thread.messages} meId={user.id} />
      </Card>
      <MessageComposer threadId={thread.threadId} rolePrefix="student" />
    </div>
  );
}
```

- [ ] **Step 3: Create the `/with/[userId]` resolver page**

```tsx
// src/app/student/messages/with/[userId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canDM, getUserRole } from "@/lib/dm-permissions";
import { getOrCreateThread } from "@/lib/dm-queries";

export default async function StudentDMWithPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await requireRole("student");

  const targetRole = await getUserRole(userId);
  if (!targetRole) notFound();
  if (!(await canDM(user.id, "student", userId, targetRole))) notFound();

  const threadId = await getOrCreateThread(user.id, userId);
  redirect(`/student/messages/${threadId}`);
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/student/messages/
git commit -m "feat(dm): student routes"
```

---

## Task 9: Tutor routes

**Files:**
- Create: `src/app/tutor/messages/page.tsx`
- Create: `src/app/tutor/messages/[threadId]/page.tsx`
- Create: `src/app/tutor/messages/with/[userId]/page.tsx`

- [ ] **Step 1: Create the inbox page**

```tsx
// src/app/tutor/messages/page.tsx
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function TutorMessagesPage() {
  const user = await requireRole("tutor");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Messages
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Conversations with your students, their parents, and the admin office.
        </p>
      </header>
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No conversations yet.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/tutor/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the thread page**

```tsx
// src/app/tutor/messages/[threadId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
import { markThreadRead } from "@/app/_actions/dm";

export default async function TutorThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireRole("tutor");
  const thread = await getThreadForMe(user.id, threadId);
  if (!thread) notFound();

  const fd = new FormData();
  fd.append("threadId", threadId);
  fd.append("rolePrefix", "tutor");
  await markThreadRead(fd);

  return (
    <div className="space-y-4 flex flex-col h-[calc(100dvh-160px)]">
      <Link
        href="/tutor/messages"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted hover:text-ink font-medium"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Messages
      </Link>
      <Card className="px-5 py-3 flex items-baseline gap-2 shrink-0">
        <div className="text-lg font-semibold text-ink">{thread.otherName}</div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
          {thread.otherRole}
        </div>
      </Card>
      <Card className="flex-1 overflow-y-auto p-5">
        <MessageList messages={thread.messages} meId={user.id} />
      </Card>
      <MessageComposer threadId={thread.threadId} rolePrefix="tutor" />
    </div>
  );
}
```

- [ ] **Step 3: Create the `/with/[userId]` resolver page**

```tsx
// src/app/tutor/messages/with/[userId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canDM, getUserRole } from "@/lib/dm-permissions";
import { getOrCreateThread } from "@/lib/dm-queries";

export default async function TutorDMWithPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await requireRole("tutor");

  const targetRole = await getUserRole(userId);
  if (!targetRole) notFound();
  if (!(await canDM(user.id, "tutor", userId, targetRole))) notFound();

  const threadId = await getOrCreateThread(user.id, userId);
  redirect(`/tutor/messages/${threadId}`);
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/tutor/messages/
git commit -m "feat(dm): tutor routes"
```

---

## Task 10: Admin routes

**Files:**
- Create: `src/app/admin/messages/page.tsx`
- Create: `src/app/admin/messages/[threadId]/page.tsx`
- Create: `src/app/admin/messages/with/[userId]/page.tsx`

- [ ] **Step 1: Create the inbox page**

```tsx
// src/app/admin/messages/page.tsx
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function AdminMessagesPage() {
  const user = await requireRole("admin");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Messages
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Your direct conversations with parents, students, and tutors.
        </p>
      </header>
      {threads.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No conversations yet.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/admin/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the thread page**

```tsx
// src/app/admin/messages/[threadId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
import { markThreadRead } from "@/app/_actions/dm";

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireRole("admin");
  const thread = await getThreadForMe(user.id, threadId);
  if (!thread) notFound();

  const fd = new FormData();
  fd.append("threadId", threadId);
  fd.append("rolePrefix", "admin");
  await markThreadRead(fd);

  return (
    <div className="space-y-4 flex flex-col h-[calc(100dvh-160px)]">
      <Link
        href="/admin/messages"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted hover:text-ink font-medium"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Messages
      </Link>
      <Card className="px-5 py-3 flex items-baseline gap-2 shrink-0">
        <div className="text-lg font-semibold text-ink">{thread.otherName}</div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
          {thread.otherRole}
        </div>
      </Card>
      <Card className="flex-1 overflow-y-auto p-5">
        <MessageList messages={thread.messages} meId={user.id} />
      </Card>
      <MessageComposer threadId={thread.threadId} rolePrefix="admin" />
    </div>
  );
}
```

- [ ] **Step 3: Create the `/with/[userId]` resolver page**

```tsx
// src/app/admin/messages/with/[userId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canDM, getUserRole } from "@/lib/dm-permissions";
import { getOrCreateThread } from "@/lib/dm-queries";

export default async function AdminDMWithPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await requireRole("admin");

  const targetRole = await getUserRole(userId);
  if (!targetRole) notFound();
  if (!(await canDM(user.id, "admin", userId, targetRole))) notFound();

  const threadId = await getOrCreateThread(user.id, userId);
  redirect(`/admin/messages/${threadId}`);
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/messages/
git commit -m "feat(dm): admin routes"
```

---

## Task 11: Navigation + entry points

**Files:**
- Modify: `src/components/portal/shell.tsx`
- Modify: `src/app/parent/page.tsx`
- Modify: `src/app/parent/_data.ts` (to expose tutor + admin user IDs)
- Modify: `src/app/tutor/students/[id]/page.tsx`
- Modify: `src/app/admin/users/[id]/page.tsx`

- [ ] **Step 1: Add `MessageCircle` icon import to the shell**

In `src/components/portal/shell.tsx`, find the lucide-react import block. Add `MessageCircle`.

```ts
import {
  // ...existing icons...
  MessageCircle,
  // ...existing icons...
} from "lucide-react";
```

- [ ] **Step 2: Add Messages nav entry × 4 roles**

Find `NAV_BY_ROLE` in the same file. Insert one entry per role.

For `parent`, after the "Feedback" entry:
```ts
{ label: "Messages", href: "/parent/messages", icon: <MessageCircle className={ICON_CLASS} /> },
```

For `student`, after the "Discussions" entry:
```ts
{ label: "Messages", href: "/student/messages", icon: <MessageCircle className={ICON_CLASS} /> },
```

For `tutor`, after the "Discussions" entry:
```ts
{ label: "Messages", href: "/tutor/messages", icon: <MessageCircle className={ICON_CLASS} /> },
```

For `admin`, after the "Discussions" entry:
```ts
{ label: "Messages", href: "/admin/messages", icon: <MessageCircle className={ICON_CLASS} /> },
```

- [ ] **Step 3: Add `userId` prop and Message button to `ContactRow` in `src/app/parent/page.tsx`**

Locate the `ContactRow` function (around line 432). Update its props and JSX:

```tsx
function ContactRow({
  name,
  meta,
  email,
  phone,
  userId,
}: {
  name: string;
  meta?: string;
  email: string;
  phone: string | null;
  userId?: string;
}) {
  return (
    <div className="space-y-1.5">
      {/* ...existing content for name, email, phone... */}
      {userId && (
        <a
          href={`/parent/messages/with/${userId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 uppercase tracking-[0.14em]"
        >
          Message →
        </a>
      )}
    </div>
  );
}
```

(Preserve the existing content of `ContactRow` — the snippet above only shows the new addition. Read the full function before editing and keep the rest.)

Then, in the caller sites in the same file (around lines 369 and 382), pass `userId`:

```tsx
<ContactRow
  key={t.id}
  name={`${t.firstName} ${t.lastName}`.trim()}
  meta={t.subjects.join(" · ")}
  email={t.email}
  phone={t.phone}
  userId={t.id}
/>
```

```tsx
<ContactRow
  name={`${admin.firstName} ${admin.lastName}`.trim()}
  meta="Taiyo Tuition"
  email={admin.email}
  phone={admin.phone}
  userId={admin.id}
/>
```

- [ ] **Step 4: Confirm the parent `_data.ts` already returns tutor + admin IDs**

Run: `grep -n "id:\s*profiles.id\|firstName:\s*profiles" src/app/parent/_data.ts | head -10`

If the tutor and admin query already select `id`, no change needed. If `id` is missing from either, add `id: profiles.id` to the select clause for that query. (Check by looking for the queries that produce `tutors` and `admin` in the parent dashboard data fetch.)

- [ ] **Step 5: Add Message buttons to `src/app/tutor/students/[id]/page.tsx`**

Read the file first to find the student detail page layout. There will be a header section with the student's name and a section showing linked parents.

At the top of the page (in the header card), after the student's name, add:

```tsx
<a
  href={`/tutor/messages/with/${student.id}`}
  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
>
  Message student
</a>
```

For each linked parent in the family-links section, add per row:

```tsx
<a
  href={`/tutor/messages/with/${familyLink.parentId}`}
  className="text-xs font-medium text-brand-700 hover:text-brand-800 uppercase tracking-[0.14em]"
>
  Message parent →
</a>
```

The exact placement depends on the existing JSX. Read the file and pick natural positions (next to the student name; next to each parent's name).

- [ ] **Step 6: Add Message button to `src/app/admin/users/[id]/page.tsx`**

Read the file. In the top header / detail card area, add:

```tsx
<a
  href={`/admin/messages/with/${profileUser.id}`}
  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
>
  Message
</a>
```

(The variable name for the viewed user's profile may differ. Adapt to whatever the local variable is called.)

- [ ] **Step 7: Unread badge on the Messages nav item**

This requires `shell.tsx` to know the current user's id so it can call `getUnreadThreadCount`. The shell currently takes `{ role, userName, children }`. Switch it to fetch the user inside the shell rather than threading `userId` through every page.

Modify `src/components/portal/shell.tsx`:

1. Make the function `async`.
2. At the top of the function body, fetch the current user and the unread count:

```ts
import { getCurrentUser } from "@/lib/auth";
import { getUnreadThreadCount } from "@/lib/dm-queries";

// inside PortalShell:
const user = await getCurrentUser();
const unread = user ? await getUnreadThreadCount(user.id) : 0;
```

3. Extend the `NavItem` type in `src/components/portal/nav-links.tsx` to support an optional `badge?: number` field. In the rendered link, if `badge` is positive, append a small pill:

```tsx
{item.badge && item.badge > 0 ? (
  <span className="ml-auto inline-flex items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-semibold min-w-5 h-5 px-1.5">
    {item.badge > 99 ? "99+" : item.badge}
  </span>
) : null}
```

(Adapt the JSX to NavLinks' actual structure — read the file first.)

4. In `shell.tsx`, when building the `nav` array, attach the unread count to the Messages entry for the current role:

```ts
const nav = NAV_BY_ROLE[role].map((item) =>
  item.href === `/${role}/messages` ? { ...item, badge: unread } : item,
);
```

- [ ] **Step 8: Add a contact card with Message buttons to student dashboard**

Read `src/app/student/page.tsx`. Find the right column (sidebar with announcements, etc.).

Add a new contact card section before announcements, listing each of the student's tutors + the admin. The student's tutors can be derived from a query on `enrollments → classes.tutorId → profiles`.

A minimal approach: if a `getStudentTutors` query doesn't already exist in `src/app/student/_data.ts` or `_lib/queries.ts`, add one. The fields needed: `id`, `firstName`, `lastName`. Same for `getAdminContact` if it doesn't exist.

Render:
```tsx
<Card className="p-0 overflow-hidden">
  <SectionHeader title="Contact" />
  <div className="p-5 space-y-4">
    {tutors.length > 0 && (
      <div className="space-y-3">
        <CardLabel>Tutors</CardLabel>
        {tutors.map((t) => (
          <div key={t.id} className="flex items-center justify-between">
            <div className="text-sm text-ink">{t.firstName} {t.lastName}</div>
            <a
              href={`/student/messages/with/${t.id}`}
              className="text-xs font-medium text-brand-700 hover:text-brand-800 uppercase tracking-[0.14em]"
            >
              Message →
            </a>
          </div>
        ))}
      </div>
    )}
    {admin && (
      <div className="pt-4 border-t border-hairline/60 space-y-3">
        <CardLabel>Admin office</CardLabel>
        <div className="flex items-center justify-between">
          <div className="text-sm text-ink">{admin.firstName} {admin.lastName}</div>
          <a
            href={`/student/messages/with/${admin.id}`}
            className="text-xs font-medium text-brand-700 hover:text-brand-800 uppercase tracking-[0.14em]"
          >
            Message →
          </a>
        </div>
      </div>
    )}
  </div>
</Card>
```

If the student dashboard does not currently have a sidebar layout, add the contact card wherever it best fits the existing layout (most likely as a section at the bottom or side).

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/portal/shell.tsx src/app/parent/ src/app/student/ src/app/tutor/students/ src/app/admin/users/
git commit -m "feat(dm): nav entries + Message buttons on contact rows"
```

---

## Task 12: Manual verification walkthrough

The codebase has no test framework. Verification is a guided browser walkthrough by the user.

- [ ] **Step 1: Ask the user to start the dev server in a terminal they own**

Tell the user: "Please start the dev server (`npm run dev`) in a terminal window you can see (not via Claude). I'll wait for you to walk through the checks below."

- [ ] **Step 2: Parent ↔ Tutor walkthrough**

Ask the user to log in as a parent whose child is enrolled in at least one class.

1. Visit `/parent`. **Expect:** "Message →" link beside each tutor in the contact block + beside admin.
2. Click "Message →" beside a tutor. **Expect:** redirect to `/parent/messages/<threadId>` with empty thread + composer.
3. Send "Hi, quick question about homework". **Expect:** message appears right-aligned in brand-100 bubble.
4. Visit `/parent/messages`. **Expect:** the thread shows at top with last-message preview + activity stamp + no unread dot (since sender doesn't show unread on their own thread).
5. Log out, log in as that tutor.
6. **Expect:** a notification row in `notifications` for the tutor with `href = /tutor/messages/<threadId>`.
7. Visit `/tutor/messages`. **Expect:** thread shows with the parent's name + unread dot.
8. Open the thread. **Expect:** see the parent's message left-aligned in white bubble. Reply. **Expect:** new message right-aligned brand-100.
9. Log out, log in as parent. Visit `/parent/messages`. **Expect:** new unread dot beside that thread.
10. Open thread. **Expect:** unread dot clears on next page render.

- [ ] **Step 3: Permission negative tests**

1. As a parent, visit `/parent/messages/with/<some-other-parent-id>`. **Expect:** 404 (same-role denied).
2. As a parent, visit `/parent/messages/with/<a-tutor-id-who-doesnt-teach-our-child>`. **Expect:** 404 (relationship denied).
3. As a student, visit `/student/messages/with/<another-student-id>`. **Expect:** 404.

- [ ] **Step 4: Admin walkthrough**

1. Log in as admin.
2. Visit `/admin/users/<some-user-id>`. **Expect:** "Message" button at top.
3. Click. **Expect:** redirect to `/admin/messages/<threadId>`. Send a message. Recipient gets a notification.

- [ ] **Step 5: Lapse policy**

(Optional — requires being able to withdraw an enrollment from the DB or admin UI.)

1. Note: a parent has an active DM with a tutor whose class their child is enrolled in.
2. Withdraw the child from that class (or set `enrollments.withdrawnAt` directly in Supabase).
3. As that parent, open the existing DM thread. **Expect:** still readable; existing messages visible.
4. Try to send a new message. **Expect:** server action throws "Forbidden" (the relationship no longer holds).

- [ ] **Step 6: Update the checklist**

Edit `docs/checklist.md`. Flip these rows from ⬜ to ✅:

- Parent row "Direct message tutor / admin" → ✅
- Add new entries to the Student and Tutor tables for "Direct message" if not already present.

Commit:
```bash
git add docs/checklist.md
git commit -m "chore(checklist): mark direct messaging as shipped"
```

- [ ] **Step 7: Report**

If any step fails, describe the symptom and which task/file to revisit. Otherwise mark the feature shipped.

---

## Self-review notes (for the executor)

- The `markThreadRead` action runs inline on every thread page render. This is a small write per page load — acceptable for MVP. If it becomes a hot path, move to a client-side `useEffect` + server action call.
- The inbox query (`listMyThreads`) runs O(threads) lookups for profile + last message + last read. For tens of threads this is fine. If it gets slow (~100+ threads/user), rewrite as a single SQL join with `lateral`.
- The "lapse policy" gives existing threads "read forever" access. This is intentional per the spec. If the user later wants strict revocation, swap the `listMyThreads` filter to re-check `canDM` per thread.
- `getUserRole` is in `dm-permissions.ts` but is also useful generally. If another feature needs it, move to `src/lib/profiles.ts` or similar.
- The 12 page files are deliberately verbose duplications instead of a single shared abstraction. Matches the existing portal pattern (per-role pages). Refactoring to a shared abstraction is a future cleanup once the patterns are clear.
