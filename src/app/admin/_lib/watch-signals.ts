import "server-only";

import { and, eq, lt, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attendance, homework, homeworkAssignments, lessons } from "@/db/schema";
import { attendanceMovedSql } from "@/lib/attendance-moved";
import { HANDED_IN_STATUSES, isHomeworkOverdue } from "@/lib/homework-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { RECENT_MARKS, watchSignalsFrom, type WatchSignals } from "./watch-rules";

/**
 * The warning signs behind the dashboard's "Students to watch" and the user
 * directory's row flags, so both always name the same students: 2+ absences
 * in the last four counted lessons (a moved lesson is not an absence), or 2+
 * homework tasks overdue (not handed in after the due date; a late hand-in
 * is handed in).
 */
export async function getWatchSignals(now = new Date()): Promise<WatchSignals> {
  const today = melbourneDate(now);

  const recent = db
    .select({
      studentId: attendance.studentId,
      status: attendance.status,
      rn: sql<number>`row_number() over (partition by ${attendance.studentId} order by ${lessons.date} desc, ${lessons.startTime} desc)`.as(
        "rn",
      ),
    })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .where(sql`not ${attendanceMovedSql}`)
    .as("recent");

  const [marks, homeworkRows] = await Promise.all([
    db
      .select({ studentId: recent.studentId, status: recent.status })
      .from(recent)
      .where(lte(recent.rn, RECENT_MARKS)),
    // Narrowed in SQL; the shared rule decides on the Melbourne due date.
    db
      .select({
        studentId: homeworkAssignments.studentId,
        status: homeworkAssignments.status,
        dueDate: homework.dueDate,
      })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .where(
        and(
          notInArray(homeworkAssignments.status, [...HANDED_IN_STATUSES]),
          lt(homework.dueDate, now),
        ),
      ),
  ]);

  return watchSignalsFrom(
    marks,
    homeworkRows
      .filter((h) => isHomeworkOverdue(h.status, melbourneDate(h.dueDate), today))
      .map((h) => h.studentId),
  );
}
