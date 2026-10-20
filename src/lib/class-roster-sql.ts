import "server-only";
import { sql, type SQL } from "drizzle-orm";

/**
 * The one rule for whether an enrolment puts its student on a lesson's roll
 * (migration 0080): they had joined by the lesson's date (Melbourne), they
 * had not left before it (`ends_on`, or for an enrolment withdrawn before
 * 0080, any withdrawal), and they were not taken off that lesson alone
 * (`lesson_roll_exclusions`). A make-up lesson has no class roll; callers
 * add that themselves.
 *
 * `e` and `l` are the SQL names of the enrolment and lesson rows in the
 * caller's query (table names or aliases), never user input. Rolls, roll
 * counts, the student timetable and the History tab all use this, so they
 * agree on who was in a lesson.
 */
export function onRosterSql(e: string, l: string): SQL {
  return sql.raw(`(
    (${e}.enrolled_at at time zone 'Australia/Melbourne')::date <= ${l}.date
    and (case when ${e}.ends_on is not null then ${l}.date < ${e}.ends_on else ${e}.withdrawn_at is null end)
    and not exists (
      select 1 from lesson_roll_exclusions rx
      where rx.lesson_id = ${l}.id and rx.student_id = ${e}.student_id
    )
  )`);
}

/** Melbourne midnight of a date, for `enrolled_at` when a student joins from a lesson. */
export function melbourneStartOfDaySql(isoDate: string): SQL {
  return sql`(${isoDate}::date::timestamp at time zone 'Australia/Melbourne')`;
}

/**
 * The outer query's `lessons` row is a lesson of one of the student's
 * classes that they are on the roll for. A make-up lesson is a private
 * booking that only points at a class, so it never counts here: a student's
 * own make-ups come from their attendance, and a classmate's stay private.
 */
export function studentOnClassRosterSql(studentId: string): SQL {
  return sql`(lessons.status <> 'makeup' and exists (
    select 1 from enrollments e
    where e.class_id = lessons.class_id
      and e.student_id = ${studentId}
      and ${onRosterSql("e", "lessons")}
  ))`;
}
