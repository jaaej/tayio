import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  announcements,
  classMoveRequests,
  invoices,
  quizzes,
  tutorLeaveRequests,
  tutorWeeklyCheckins,
} from "@/db/schema";
import { getQueueBacklog, type QueueBacklog } from "@/app/admin/attendance/_lib/queue";
import { OPEN_INVOICE_STATUSES, isInvoiceOverdue } from "@/lib/invoice-rules";
import { getAdminCoverBoardRows } from "@/lib/tutor-cover";
import { MIN_COVER_NOTICE_HOURS, melbourneDate } from "@/lib/tutor-cover-rules";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";

/*
 * Every queue waiting on an admin, counted once. The dashboard's To do and
 * the sidebar badges read these functions, so a number on the dashboard is
 * always the number on the page it links to.
 */

export type CoverLeaveQueue = {
  /** Upcoming lessons still waiting for a cover tutor (the Cover board). */
  coverOpen: number;
  /** Of those, how many start within the 48-hour notice window. */
  coverSoon: number;
  /** Start date of the soonest lesson needing cover. */
  coverNext: string | null;
  leavePending: number;
  /** Start date of the earliest pending leave. */
  leaveNext: string | null;
  classMovesPending: number;
};

/** What the Cover & leave page holds for an admin to decide. */
export async function getCoverLeaveQueue(now = new Date()): Promise<CoverLeaveQueue> {
  const [board, leave, moves] = await Promise.all([
    getAdminCoverBoardRows(now),
    db
      .select({
        count: sql<number>`count(*)::int`,
        next: sql<string | null>`min(${tutorLeaveRequests.startDate})::text`,
      })
      .from(tutorLeaveRequests)
      .where(eq(tutorLeaveRequests.status, "pending")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(classMoveRequests)
      .where(eq(classMoveRequests.status, "pending")),
  ]);
  // Still needing a tutor, including a class that started with nobody on it.
  const open = board.filter((row) => row.status === "open" || row.status === "expired");
  return {
    coverOpen: open.length,
    coverSoon: open.filter((row) => row.hoursRemaining <= MIN_COVER_NOTICE_HOURS).length,
    coverNext: open[0]?.date ?? null,
    leavePending: leave[0]?.count ?? 0,
    leaveNext: leave[0]?.next ?? null,
    classMovesPending: moves[0]?.count ?? 0,
  };
}

/** The Cover & leave menu badge: everything on that page waiting on a decision. */
export function coverLeaveBadge(queue: CoverLeaveQueue): number {
  return queue.coverOpen + queue.leavePending + queue.classMovesPending;
}

export type OverdueInvoices = {
  count: number;
  total: number;
  /** Due date of the oldest overdue invoice. */
  oldestDue: string | null;
};

/** Overdue by the shared invoice rule: open and past its due date. */
export async function getOverdueInvoices(now = new Date()): Promise<OverdueInvoices> {
  const today = melbourneDate(now);
  const open = await db
    .select({ status: invoices.status, dueDate: invoices.dueDate, amount: invoices.amount })
    .from(invoices)
    .where(inArray(invoices.status, [...OPEN_INVOICE_STATUSES]));
  const overdue = open.filter((row) => isInvoiceOverdue(row, today));
  return {
    count: overdue.length,
    total: overdue.reduce((sum, row) => sum + Number(row.amount), 0),
    oldestDue: overdue.reduce<string | null>(
      (oldest, row) => (oldest === null || row.dueDate < oldest ? row.dueDate : oldest),
      null,
    ),
  };
}

export type AdminQueues = {
  backlog: QueueBacklog;
  coverLeave: CoverLeaveQueue;
  quizzes: { count: number; oldest: Date | null };
  announcements: number;
  overdue: OverdueInvoices;
  /** Owner only: tutors who have not approved last week's hours. */
  checkins: { count: number; weekStart: string };
};

export async function getAdminQueues(
  now: Date,
  opts: { isOwner: boolean },
): Promise<AdminQueues> {
  const lastWeekStart = weekStartForIsoDate(addIsoDays(melbourneDate(now), -7));
  const [backlog, coverLeave, quizRows, noticeRows, overdue, checkinRows] = await Promise.all([
    getQueueBacklog(now),
    getCoverLeaveQueue(now),
    db
      .select({
        count: sql<number>`count(*)::int`,
        oldest: sql<Date | null>`min(${quizzes.updatedAt})`.mapWith(quizzes.updatedAt),
      })
      .from(quizzes)
      .where(eq(quizzes.status, "pending_review")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(announcements)
      .where(eq(announcements.status, "pending")),
    getOverdueInvoices(now),
    opts.isOwner
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(tutorWeeklyCheckins)
          .where(
            and(
              eq(tutorWeeklyCheckins.weekStart, lastWeekStart),
              inArray(tutorWeeklyCheckins.status, ["pending", "disputed"]),
            ),
          )
      : Promise.resolve([{ count: 0 }]),
  ]);
  return {
    backlog,
    coverLeave,
    quizzes: { count: quizRows[0]?.count ?? 0, oldest: quizRows[0]?.oldest ?? null },
    announcements: noticeRows[0]?.count ?? 0,
    overdue,
    checkins: { count: checkinRows[0]?.count ?? 0, weekStart: lastWeekStart },
  };
}
