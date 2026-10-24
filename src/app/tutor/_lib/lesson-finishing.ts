import "server-only";
import { and, asc, eq, lt, notInArray, sql } from "drizzle-orm";
import { tutorAwayFromLessonSql } from "@/lib/cover-away-sql";
import { db } from "@/db/client";
import { classes, lessons, subjects } from "@/db/schema";
import { describeLesson, type LessonView } from "@/lib/lesson-progress";
import { LESSON_OFF_STATUSES, lessonCountFields } from "@/lib/lesson-progress-sql";
import { melbourneDate, melbourneTime } from "@/lib/tutor-cover-rules";

export type LessonToFinish = LessonView & {
  classId: string;
  className: string;
  subjectName: string;
};

/**
 * Lessons this tutor taught before today that still need attendance or notes
 * (`describeLesson`), oldest first, with no cut-off: their own classes,
 * make-ups and covers alike. Today's "lessons need finishing" item counts
 * them. A lesson they asked cover for that nobody on the portal took is not
 * theirs to finish.
 */
export async function getLessonsToFinish(
  tutorId: string,
  now = new Date(),
): Promise<LessonToFinish[]> {
  const today = melbourneDate(now);
  const nowTime = melbourneTime(now);
  const rows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      ...lessonCountFields,
      classId: lessons.classId,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(lessons.tutorId, tutorId),
        lt(lessons.date, today),
        notInArray(lessons.status, [...LESSON_OFF_STATUSES]),
        // Covered off the portal or still waiting: not theirs to finish.
        sql`not ${tutorAwayFromLessonSql}`,
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));
  return rows
    .map((row) => ({
      ...describeLesson(row, today, nowTime),
      classId: row.classId,
      className: row.className,
      subjectName: row.subjectName,
    }))
    .filter((lesson) => !lesson.finished);
}
