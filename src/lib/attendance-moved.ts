import "server-only";
import { sql } from "drizzle-orm";
import { attendance, lessonCancellations, rescheduleRequests } from "@/db/schema";
import { lessonGuestIdsSql } from "@/lib/class-roster-sql";

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

/**
 * True when the mark is for a lesson the student was booked onto outside
 * their class (`lessonGuestIdsSql`): a make-up or a one-off visit.
 */
export const attendanceBookedSql = sql<boolean>`(${attendance.studentId} in ${lessonGuestIdsSql(sql`${attendance.lessonId}`)})`;

/**
 * The mark as the history pages read it: a booked make-up the student came
 * to reads "Make-up attended", though the tutor marked them Present like the
 * class. Select it in place of `attendance.status` (any value it returns is
 * an attendance status).
 */
export const attendanceStatusShownSql = sql<(typeof attendance.status.enumValues)[number]>`(case
  when ${attendance.status} = 'present' and ${attendanceBookedSql} then 'makeup_attended'
  else ${attendance.status}::text
end)`;
