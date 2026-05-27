import "server-only";
import { desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
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
  subjectName: string | null;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Date;
  deletedAt: Date | null;
  replies: Array<{
    id: string;
    parentReplyId: string | null;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    body: string;
    createdAt: Date;
    deletedAt: Date | null;
  }>;
};

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
    // sql`max(...)` returns whatever the driver gives — often a string for
    // timestamp aggregations. Normalize to Date here so consumers can trust
    // the BoardSummary type contract.
    const raw = row.lastActivityAt as Date | string | null;
    const t = raw ? (raw instanceof Date ? raw : new Date(raw)) : null;
    countBySubjectId.set(row.subjectId, {
      c: row.threadCount,
      t,
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
      subjectName: subjects.name,
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
    .leftJoin(subjects, eq(subjects.id, discussionThreads.subjectId))
    .where(eq(discussionThreads.id, threadId))
    .limit(1);

  if (threadRow.length === 0) return null;
  const t = threadRow[0];

  const replyRows = await db
    .select({
      id: discussionReplies.id,
      parentReplyId: discussionReplies.parentReplyId,
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
    subjectName: t.subjectName,
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
