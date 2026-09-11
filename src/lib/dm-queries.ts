import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dmMessages,
  dmReads,
  dmThreads,
  profiles,
  type UserRole,
} from "@/db/schema";
import { canonicalPair } from "@/lib/dm";
import { coarseRole } from "@/lib/roles";

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

export async function listMyThreads(meId: string): Promise<ThreadInboxRow[]> {
  const rows = await db.execute<{
    threadId: string;
    otherUserId: string;
    otherFirst: string;
    otherLast: string;
    otherRole: UserRole;
    lastMessagePreview: string | null;
    lastActivityAt: Date;
    unread: boolean;
  }>(sql`
    select
      t.id as "threadId",
      other_profile.id as "otherUserId",
      other_profile.first_name as "otherFirst",
      other_profile.last_name as "otherLast",
      other_profile.role as "otherRole",
      latest.body as "lastMessagePreview",
      t.last_activity_at as "lastActivityAt",
      (
        latest.sender_id is not null
        and latest.sender_id <> ${meId}
        and latest.created_at > coalesce(
          read_state.last_read_at,
          timestamp with time zone 'epoch'
        )
      ) as unread
    from ${dmThreads} t
    join ${profiles} other_profile
      on other_profile.id = case
        when t.user_a_id = ${meId} then t.user_b_id
        else t.user_a_id
      end
    left join lateral (
      select message.sender_id, message.body, message.created_at
      from ${dmMessages} message
      where message.thread_id = t.id
      order by message.created_at desc, message.id desc
      limit 1
    ) latest on true
    left join ${dmReads} read_state
      on read_state.thread_id = t.id
      and read_state.user_id = ${meId}
    where t.user_a_id = ${meId} or t.user_b_id = ${meId}
    order by t.last_activity_at desc
  `);

  return rows.map((row) => ({
    threadId: row.threadId,
    otherUserId: row.otherUserId,
    otherName: `${row.otherFirst} ${row.otherLast}`.trim(),
    otherRole: row.otherRole,
    lastMessagePreview: row.lastMessagePreview,
    lastActivityAt: row.lastActivityAt,
    unread: Boolean(row.unread),
  }));
}

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

export async function getUnreadThreadCount(meId: string): Promise<number> {
  // This badge is rendered in every portal shell. The old implementation
  // loaded the full inbox and issued three extra queries per thread, making
  // every page slower as a user's message history grew. Count unread threads
  // in one database round trip instead.
  const rows = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from ${dmThreads} t
    join lateral (
      select message.sender_id, message.created_at
      from ${dmMessages} message
      where message.thread_id = t.id
      order by message.created_at desc
      limit 1
    ) latest on true
    left join ${dmReads} read_state
      on read_state.thread_id = t.id
      and read_state.user_id = ${meId}
    where (t.user_a_id = ${meId} or t.user_b_id = ${meId})
      and latest.sender_id <> ${meId}
      and latest.created_at > coalesce(
        read_state.last_read_at,
        timestamp with time zone 'epoch'
      )
  `);
  return Number(rows[0]?.count ?? 0);
}

export type DmDirectoryEntry = {
  id: string;
  firstName: string;
  lastName: string;
};

export type DmDirectory = {
  parents: DmDirectoryEntry[];
  tutors: DmDirectoryEntry[];
  students: DmDirectoryEntry[];
};

/**
 * Admin-only: every active user grouped by role, sorted alphabetically.
 * Used on the admin Messages page so the admin can initiate a DM with anyone.
 */
export async function listDmDirectoryForAdmin(
  meId: string,
): Promise<DmDirectory> {
  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.isActive, true));

  const directory: DmDirectory = { parents: [], tutors: [], students: [] };
  for (const r of rows) {
    if (r.id === meId) continue;
    const entry = { id: r.id, firstName: r.firstName, lastName: r.lastName };
    if (r.role === "parent") directory.parents.push(entry);
    else if (r.role === "tutor") directory.tutors.push(entry);
    else if (coarseRole(r.role) === "student") directory.students.push(entry);
  }
  const byName = (a: DmDirectoryEntry, b: DmDirectoryEntry) =>
    a.firstName.localeCompare(b.firstName) ||
    a.lastName.localeCompare(b.lastName);
  directory.parents.sort(byName);
  directory.tutors.sort(byName);
  directory.students.sort(byName);
  return directory;
}
