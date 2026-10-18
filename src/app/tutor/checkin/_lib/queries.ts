import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { tutorCheckinEntries, tutorWeeklyCheckins } from "@/db/schema";
import { pendingCheckinWeeks } from "./pending-weeks";

/**
 * Weeks this tutor still has to confirm, oldest first (`pendingCheckinWeeks`).
 * Read from the weekly snapshots, which the Saturday and Sunday reminder run
 * creates for every active tutor; weeks before check-ins began have none.
 */
export async function getPendingCheckinWeeks(tutorId: string, now = new Date()) {
  const checkins = await db
    .select({
      id: tutorWeeklyCheckins.id,
      weekStart: tutorWeeklyCheckins.weekStart,
      status: tutorWeeklyCheckins.status,
    })
    .from(tutorWeeklyCheckins)
    .where(
      and(eq(tutorWeeklyCheckins.tutorId, tutorId), eq(tutorWeeklyCheckins.status, "pending")),
    );
  if (checkins.length === 0) return [];
  const entries = await db
    .select({
      checkinId: tutorCheckinEntries.checkinId,
      workDate: tutorCheckinEntries.workDate,
      endTime: tutorCheckinEntries.endTime,
      isRemoved: tutorCheckinEntries.isRemoved,
    })
    .from(tutorCheckinEntries)
    .where(inArray(tutorCheckinEntries.checkinId, checkins.map((c) => c.id)));
  return pendingCheckinWeeks(
    checkins.map((checkin) => ({
      ...checkin,
      entries: entries.filter((entry) => entry.checkinId === checkin.id),
    })),
    now,
  );
}
