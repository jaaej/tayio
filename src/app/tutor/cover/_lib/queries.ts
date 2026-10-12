import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { lessons, tutorCoverRequests } from "@/db/schema";
import { getDateOverrides, getWeeklyRules } from "@/app/tutor/_lib/availability";
import { addIsoDays } from "@/lib/tutor-checkin-rules";
import {
  getLeaveAffectedLessonCounts,
  getTutorCoverPageData,
  type CoverBoardRow,
} from "@/lib/tutor-cover";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { coverFit, type CoverFit } from "./fit";

type LeaveRequestRow = Awaited<
  ReturnType<typeof getTutorCoverPageData>
>["leaveRequests"][number];

export type TutorLeaveRow = LeaveRequestRow & {
  /** Pending: classes it would post. Approved: classes it posted for cover. */
  affected: number;
  /** Approved only: how many of the posted classes are covered. */
  covered: number;
};

/** Add class counts: what pending leave would post, what approved leave did. */
async function withLeaveCounts(
  rows: LeaveRequestRow[],
  now: Date,
): Promise<TutorLeaveRow[]> {
  const pending = rows.filter((row) => row.status === "pending");
  const approvedIds = rows
    .filter((row) => row.status === "approved")
    .map((row) => row.id);
  const [pendingCounts, approvedRows] = await Promise.all([
    getLeaveAffectedLessonCounts(pending, now),
    approvedIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            leaveId: tutorCoverRequests.leaveRequestId,
            total: sql<number>`count(*)::int`,
            covered: sql<number>`(count(*) filter (where ${tutorCoverRequests.status} = 'claimed'))::int`,
          })
          .from(tutorCoverRequests)
          .where(inArray(tutorCoverRequests.leaveRequestId, approvedIds))
          .groupBy(tutorCoverRequests.leaveRequestId),
  ]);
  const approved = new Map(approvedRows.map((row) => [row.leaveId, row]));
  return rows.map((row) => ({
    ...row,
    affected:
      row.status === "pending"
        ? (pendingCounts.get(row.id) ?? 0)
        : Number(approved.get(row.id)?.total ?? 0),
    covered: Number(approved.get(row.id)?.covered ?? 0),
  }));
}

/** How each open cover request fits this tutor's lessons and hours. */
async function fitsFor(tutorId: string, rows: CoverBoardRow[]) {
  const fits = new Map<string, CoverFit>();
  if (rows.length === 0) return fits;
  const dates = Array.from(new Set(rows.map((row) => row.date))).sort();
  const [ownLessons, weekly, dateRows] = await Promise.all([
    db
      .select({
        date: lessons.date,
        startTime: lessons.startTime,
        endTime: lessons.endTime,
      })
      .from(lessons)
      .where(
        and(
          eq(lessons.tutorId, tutorId),
          inArray(lessons.date, dates),
          inArray(lessons.status, ["upcoming", "makeup"]),
        ),
      ),
    getWeeklyRules(tutorId),
    getDateOverrides(tutorId, dates[0], addIsoDays(dates[dates.length - 1], 1)),
  ]);
  for (const row of rows) {
    fits.set(row.id, coverFit(row, ownLessons, weekly, dateRows));
  }
  return fits;
}

export async function getTutorCoverBoard(tutorId: string, now = new Date()) {
  const data = await getTutorCoverPageData(tutorId, now);
  // Your own posted classes live under "Your requests", not "Needs cover".
  const needsCover = data.open.filter((row) => row.originalTutorId !== tutorId);
  const [fits, leave] = await Promise.all([
    fitsFor(tutorId, needsCover),
    withLeaveCounts(data.leaveRequests, now),
  ]);
  return {
    needsCover,
    fits,
    covering: data.claimedByMe,
    requests: data.requestedByMe,
    leave,
  };
}

/**
 * Upcoming time away for the schedule page: single classes you posted for
 * cover, and leave that is waiting for approval or still running.
 */
export async function getTutorTimeAway(tutorId: string, now = new Date()) {
  const data = await getTutorCoverPageData(tutorId, now);
  const today = melbourneDate(now);
  const leave = await withLeaveCounts(
    data.leaveRequests.filter(
      (row) =>
        (row.status === "pending" || row.status === "approved") &&
        row.endDate >= today,
    ),
    now,
  );
  return {
    // Classes posted by a leave request are summarised by that request.
    absences: data.requestedByMe.filter((row) => !row.leaveRequestId),
    leave,
  };
}
