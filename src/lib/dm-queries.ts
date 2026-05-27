import "server-only";
import { and, desc, eq, or } from "drizzle-orm";
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

export async function listMyThreads(meId: string): Promise<ThreadInboxRow[]> {
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
  const threads = await listMyThreads(meId);
  return threads.filter((t) => t.unread).length;
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
    else if (r.role === "student") directory.students.push(entry);
  }
  const byName = (a: DmDirectoryEntry, b: DmDirectoryEntry) =>
    a.firstName.localeCompare(b.firstName) ||
    a.lastName.localeCompare(b.lastName);
  directory.parents.sort(byName);
  directory.tutors.sort(byName);
  directory.students.sort(byName);
  return directory;
}
