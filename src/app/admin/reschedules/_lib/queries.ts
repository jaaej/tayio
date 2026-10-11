import "server-only";

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { lessons, profiles, tutorLeaveRequests } from "@/db/schema";
import { melbourneDate } from "@/lib/tutor-cover-rules";

/**
 * How many of each pending leave request's own upcoming lessons it would put
 * on the cover board if approved. Keyed by leave request id.
 */
export async function getLeaveAffectedLessonCounts(
  leaves: { id: string; tutorId: string; startDate: string; endDate: string }[],
  now = new Date(),
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (leaves.length === 0) return counts;
  const today = melbourneDate(now);
  const rows = await db
    .select({
      leaveId: tutorLeaveRequests.id,
      count: sql<number>`count(${lessons.id})::int`,
    })
    .from(tutorLeaveRequests)
    .innerJoin(
      lessons,
      and(
        eq(lessons.tutorId, tutorLeaveRequests.tutorId),
        sql`${lessons.date} between ${tutorLeaveRequests.startDate} and ${tutorLeaveRequests.endDate}`,
        sql`${lessons.date} >= ${today}`,
        inArray(lessons.status, ["upcoming", "makeup"]),
      ),
    )
    .where(
      inArray(
        tutorLeaveRequests.id,
        leaves.map((leave) => leave.id),
      ),
    )
    .groupBy(tutorLeaveRequests.id);
  for (const row of rows) counts.set(row.leaveId, Number(row.count));
  return counts;
}

const RECENT_DECISIONS_LIMIT = 20;

/** The most recently decided leave requests, for the Leave requests tab. */
export async function getRecentLeaveDecisions() {
  return db
    .select({
      id: tutorLeaveRequests.id,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      startDate: tutorLeaveRequests.startDate,
      endDate: tutorLeaveRequests.endDate,
      reason: tutorLeaveRequests.reason,
      status: tutorLeaveRequests.status,
      decidedAt: tutorLeaveRequests.decidedAt,
      updatedAt: tutorLeaveRequests.updatedAt,
    })
    .from(tutorLeaveRequests)
    .innerJoin(profiles, eq(profiles.id, tutorLeaveRequests.tutorId))
    .where(ne(tutorLeaveRequests.status, "pending"))
    .orderBy(desc(sql`coalesce(${tutorLeaveRequests.decidedAt}, ${tutorLeaveRequests.updatedAt})`))
    .limit(RECENT_DECISIONS_LIMIT);
}
