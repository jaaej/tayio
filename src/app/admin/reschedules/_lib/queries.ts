import "server-only";

import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, tutorLeaveRequests } from "@/db/schema";

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
