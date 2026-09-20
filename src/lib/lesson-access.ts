import { ne, or, sql, type SQLWrapper } from "drizzle-orm";
import { attendance, lessons } from "@/db/schema";

/**
 * A `makeup` lesson is a one-student booking that still points at the
 * student's recurring class for subject/curriculum context. Enrolment in that
 * class alone must therefore never make the booking visible to every student
 * in the class. The attendance row created with the booking is the durable
 * lesson-level membership record (and remains present if its status is later
 * changed by the tutor/admin).
 *
 * `studentId` can be either a concrete id or an outer-query column, which lets
 * parent queries apply the same rule to their linked child.
 */
export function studentCanAccessLesson(studentId: SQLWrapper | string) {
  return or(
    ne(lessons.status, "makeup"),
    sql`exists (
      select 1
      from ${attendance} as student_lesson_attendance
      where student_lesson_attendance.lesson_id = ${lessons.id}
        and student_lesson_attendance.student_id = ${studentId}
    )`,
  )!;
}

/** Student-facing schedule cards omit the original slot once the student has
 * been moved/cancelled out. Historical attendance/resource views intentionally
 * use `studentCanAccessLesson` instead so the original record is preserved. */
export function studentIsScheduledForLesson(studentId: SQLWrapper | string) {
  return sql`${studentCanAccessLesson(studentId)} and not exists (
    select 1
    from ${attendance} as student_lesson_absence
    where student_lesson_absence.lesson_id = ${lessons.id}
      and student_lesson_absence.student_id = ${studentId}
      and student_lesson_absence.status = 'absent'
  )`;
}
