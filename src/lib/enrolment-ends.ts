import "server-only";
import { and, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { enrollments } from "@/db/schema";
import { melbourneDate } from "@/lib/tutor-cover-rules";

/**
 * Daily: a student set to leave a class from a later lesson (`ends_on`)
 * leaves it on that day, so the class stops listing them everywhere else
 * (homework, messages, the class's student list). Rolls already follow
 * `ends_on` itself (`onRosterSql`).
 */
export async function runEnrolmentEndSweep(now = new Date()) {
  const rows = await db
    .update(enrollments)
    .set({ withdrawnAt: now })
    .where(and(isNull(enrollments.withdrawnAt), lte(enrollments.endsOn, melbourneDate(now))))
    .returning({ classId: enrollments.classId });
  return { left: rows.length };
}
