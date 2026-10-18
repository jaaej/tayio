import "server-only";
import { sql } from "drizzle-orm";
import { attendance, lessonCancellations, rescheduleRequests } from "@/db/schema";

/**
 * True for an `absent` mark that is really a move: the student has an
 * approved reschedule out of that lesson, or cancelled it for a credit. Select
 * it next to `attendance.status` and pass both to `attendanceSummary`.
 */
export const attendanceMovedSql = sql<boolean>`(${attendance.status} = 'absent' and (
  exists (
    select 1 from ${rescheduleRequests} moved_r
    where moved_r.original_lesson_id = ${attendance.lessonId}
      and moved_r.student_id = ${attendance.studentId}
      and moved_r.status = 'approved'
  )
  or exists (
    select 1 from ${lessonCancellations} moved_c
    where moved_c.lesson_id = ${attendance.lessonId}
      and moved_c.student_id = ${attendance.studentId}
  )
))`;
