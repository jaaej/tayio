import "server-only";
import { cache } from "react";
import { and, asc, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  announcements,
  classes,
  enrollments,
  lessons,
  subjects,
  terms,
} from "@/db/schema";
import { COVER_TIME_ZONE, melbourneDate } from "@/lib/tutor-cover-rules";
import { weekNumberOn } from "@/lib/week-plan-rules";
import { addDays, mondayOf, type LessonCounts } from "./lesson-progress";

// Data behind the class page (shared header + tabs). Wrapped in React
// `cache` so the layout and the tab page share one query per request.

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: COVER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Melbourne "today" and wall-clock "HH:MM", the frame lesson dates use. */
export function melbourneNow(now = new Date()) {
  return { today: melbourneDate(now), nowTime: clockFormatter.format(now) };
}

export type ClassHub = {
  id: string;
  name: string;
  subjectName: string;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  rosterCount: number;
  termWeek: { termId: string; termNumber: number; weekNumber: number } | null;
};

/** The tutor's class, or null when it is not theirs (callers 404). */
export const getClassHub = cache(
  async (tutorId: string, classId: string): Promise<ClassHub | null> => {
    const [cls] = await db
      .select({
        id: classes.id,
        name: classes.name,
        subjectName: subjects.name,
        weekday: classes.weekday,
        startTime: classes.startTime,
        endTime: classes.endTime,
        location: classes.location,
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(and(eq(classes.id, classId), eq(classes.tutorId, tutorId)))
      .limit(1);
    if (!cls) return null;

    const { today } = melbourneNow();
    const [[roster], [term]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(
          and(eq(enrollments.classId, classId), isNull(enrollments.withdrawnAt)),
        ),
      db
        .select({
          id: terms.id,
          termNumber: terms.termNumber,
          startDate: terms.startDate,
        })
        .from(terms)
        .where(and(lte(terms.startDate, today), gte(terms.endDate, today)))
        .orderBy(asc(terms.startDate))
        .limit(1),
    ]);

    return {
      ...cls,
      rosterCount: roster?.count ?? 0,
      termWeek: term
        ? {
            termId: term.id,
            termNumber: term.termNumber,
            weekNumber: weekNumberOn(term.startDate, today),
          }
        : null,
    };
  },
);

/**
 * This tutor's lessons of the class up to the end of this week, with roll and
 * note counts. Make-up sessions are left out: they belong to one student's
 * catch-up, not the class's run of lessons. Covered lessons (another tutor on
 * `lessons.tutor_id`) are the cover tutor's to finish, so they are left out
 * too.
 */
export const getClassLessonCounts = cache(
  async (tutorId: string, classId: string): Promise<LessonCounts[]> => {
    const { today } = melbourneNow();
    const weekEnd = addDays(mondayOf(today), 6);
    return db
      .select({
        id: lessons.id,
        date: lessons.date,
        startTime: lessons.startTime,
        endTime: lessons.endTime,
        status: lessons.status,
        // Spelled out with table names: Drizzle drops the table prefix from
        // columns in a single-table select, which would turn these
        // correlated subqueries into self-comparisons.
        roster: sql<number>`(
          select count(*)::int from enrollments e
          where e.class_id = lessons.class_id and e.withdrawn_at is null
        )`,
        marked: sql<number>`(
          select count(*)::int from attendance a
          where a.lesson_id = lessons.id
        )`,
        absent: sql<number>`(
          select count(*)::int from attendance a
          where a.lesson_id = lessons.id and a.status = 'absent'
        )`,
        notesWritten: sql<number>`(
          select count(distinct n.student_id)::int from lesson_notes n
          where n.lesson_id = lessons.id and n.tutor_id = lessons.tutor_id
        )`,
      })
      .from(lessons)
      .where(
        and(
          eq(lessons.classId, classId),
          eq(lessons.tutorId, tutorId),
          ne(lessons.status, "makeup"),
          lte(lessons.date, weekEnd),
        ),
      )
      .orderBy(asc(lessons.date), asc(lessons.startTime));
  },
);

/** Announcements an admin sent back for changes (the tab badge). */
export const getChangesRequestedCount = cache(async (classId: string) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements)
    .where(
      and(
        eq(announcements.audienceClassId, classId),
        eq(announcements.status, "rejected"),
      ),
    );
  return row?.count ?? 0;
});

/** Every term's dates, to label a lesson with its term week. */
export const getTermDates = cache(async () =>
  db
    .select({
      id: terms.id,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .orderBy(asc(terms.startDate)),
);
