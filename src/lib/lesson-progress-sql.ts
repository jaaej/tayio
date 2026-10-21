import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { lessons } from "@/db/schema";
import { melbourneDate, melbourneTime } from "@/lib/tutor-cover-rules";
import { lessonGuestIdsSql, onRosterSql } from "@/lib/class-roster-sql";
import { coveredOffPortalSql } from "@/lib/cover-away-sql";

/**
 * Database versions of the lesson rules in `lesson-progress.ts`, so the admin
 * dashboard, the Attendance queue and the tutor pages count the same lessons.
 */

/** A lesson that did not run: it needs no attendance or notes. */
export const LESSON_OFF_STATUSES = ["cancelled", "rescheduled"] as const;

/** The lesson ran: not cancelled or moved, and its start time has passed (Melbourne). */
export function lessonRanSql(now: Date): SQL {
  const today = melbourneDate(now);
  const time = melbourneTime(now);
  return sql`(${lessons.status} not in ('cancelled', 'rescheduled') and (${lessons.date} < ${today} or (${lessons.date} = ${today} and ${lessons.startTime} <= ${time})))`;
}

/**
 * The students a lesson is for: the class on its date (`onRosterSql`; nobody
 * on a make-up lesson, a private booking) and the students booked onto it
 * (`lessonGuestIdsSql`). Spelled `lessons.*` for the reason below.
 */
const lessonForSql = sql`(
  select e.student_id from enrollments e
  where lessons.status <> 'makeup'
    and e.class_id = lessons.class_id
    and ${onRosterSql("e", "lessons")}
  union
  ${lessonGuestIdsSql(sql.raw("lessons.id"))}
)`;

/**
 * Students on the lesson's roll with no attendance yet (`lessonForSql`). A
 * booked make-up starts unmarked like the class, so a make-up lesson nobody
 * marked still needs its attendance.
 */
export const unmarkedOnRollSql = sql<number>`(
  select count(*)::int from ${lessonForSql} roll
  where not exists (
    select 1 from attendance a
    where a.lesson_id = lessons.id and a.student_id = roll.student_id
  )
)`;

/**
 * Students marked as attending (present, late, left early or make-up) with
 * no lesson note yet. Absent students need no note, and a lesson taught by
 * someone not on the portal needs none at all.
 */
export const notesMissingSql = sql<number>`case when ${coveredOffPortalSql} then 0 else (
  select count(*)::int from attendance a
  where a.lesson_id = ${lessons.id}
    and a.status in ('present', 'late', 'left_early', 'makeup_attended')
    and not exists (
      select 1 from lesson_notes n
      where n.lesson_id = ${lessons.id} and n.student_id = a.student_id
    )
) end`;

/**
 * The `LessonCounts` columns `describeLesson` reads, for a select over
 * `lessons` (single-table or joined). The roll is `lessonRollIds`' rule: the
 * class's students on the lesson (`onRosterSql`; nobody on a make-up, a
 * private booking) and anyone marked on the lesson. Notes count
 * only students who were not absent: absent students need none. Columns are
 * spelled `lessons.*`: Drizzle drops the table prefix from select-list
 * columns in a single-table select, which would bind these correlated
 * subqueries to the inner tables.
 */
export const lessonCountFields = {
  roster: sql<number>`(
    select count(*)::int from (
      select roll_for.student_id from ${lessonForSql} roll_for
      union
      select a.student_id from attendance a where a.lesson_id = lessons.id
    ) roll
  )`,
  marked: sql<number>`(
    select count(*)::int from attendance a where a.lesson_id = lessons.id
  )`,
  absent: sql<number>`(
    select count(*)::int from attendance a
    where a.lesson_id = lessons.id and a.status = 'absent'
  )`,
  notesWritten: sql<number>`(
    select count(distinct n.student_id)::int from lesson_notes n
    where n.lesson_id = lessons.id
      and not exists (
        select 1 from attendance a
        where a.lesson_id = lessons.id
          and a.student_id = n.student_id
          and a.status = 'absent'
      )
  )`,
};
