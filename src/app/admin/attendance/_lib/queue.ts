import "server-only";

import { and, asc, desc, eq, gt, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, lessons, profiles, subjects } from "@/db/schema";
import { addIsoDays } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { classDisplayName } from "@/lib/class-display";
import {
  QUEUE_VIEWS,
  buildQueue,
  classParam,
  dateParam,
  lessonQueueState,
  parseQueueView,
  viewForState,
  type LessonQueueState,
  type QueueView,
} from "./queue-logic";

export type QueueFilters = {
  view: QueueView;
  /** A picked day replaces the default range entirely. */
  date: string | null;
  /** Start of the default range; only set when it came from the URL. */
  from: string | null;
  /** One class's lessons, every date (the class delete dialog links here). */
  classId: string | null;
};

export type QueueItem = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  className: string;
  subjectName: string;
  subjectColor: string | null;
  tutorName: string;
  state: LessonQueueState;
  unmarkedCount: number;
};

export type AttendanceQueue = {
  filters: QueueFilters;
  /** The filtered class's name, shown with a way back to every class. */
  classLabel: string | null;
  items: QueueItem[];
  counts: Record<QueueView, number>;
  today: string;
};

export function parseQueueFilters(params: {
  view?: string;
  date?: string;
  from?: string;
  class?: string;
}): QueueFilters {
  return {
    view: parseQueueView(params.view),
    date: dateParam(params.date),
    from: dateParam(params.from),
    classId: classParam(params.class),
  };
}

/** How far back the default range reaches when no `from` is given. */
const DEFAULT_LOOKBACK_DAYS = 30;
const PAST_LIMIT = 300;
const FUTURE_LIMIT = 100;
const CLASS_LIMIT = 500;

function selectLessons(where: SQL | undefined, order: "asc" | "desc", limit: number) {
  const dir = order === "asc" ? asc : desc;
  return db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      // Students on the roll who have no attendance row yet. It mirrors who the
      // save action accepts: a make-up lesson's roll is only the students
      // moved into it, and those rows are written when the move is booked.
      // Students who enrolled after the lesson date were never expected there.
      unmarkedCount: sql<number>`case when ${lessons.status} = 'makeup' then 0 else (
        select count(*)::int from enrollments e
        where e.class_id = ${lessons.classId}
          and e.withdrawn_at is null
          and (e.enrolled_at at time zone 'Australia/Melbourne')::date <= ${lessons.date}
          and not exists (
            select 1 from attendance a
            where a.lesson_id = ${lessons.id} and a.student_id = e.student_id
          )
      ) end`,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(where)
    .orderBy(dir(lessons.date), dir(lessons.startTime))
    .limit(limit);
}

/**
 * The lesson queue shared by /admin/attendance and its lesson pages. Past and
 * future lessons are fetched separately so a long run of generated future
 * lessons can never push the unmarked past ones out of the result.
 */
export async function getAttendanceQueue(
  filters: QueueFilters,
  now = new Date(),
): Promise<AttendanceQueue> {
  const today = melbourneDate(now);

  let rows: Awaited<ReturnType<typeof selectLessons>>;
  let classLabel: string | null = null;
  if (filters.classId) {
    rows = await selectLessons(
      and(
        eq(lessons.classId, filters.classId),
        filters.date ? eq(lessons.date, filters.date) : undefined,
      ),
      "desc",
      CLASS_LIMIT,
    );
    const [cls] = await db
      .select({ name: classes.name, subjectName: subjects.name })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(eq(classes.id, filters.classId));
    classLabel = cls ? classDisplayName(cls.subjectName, cls.name) : null;
  } else if (filters.date) {
    rows = await selectLessons(eq(lessons.date, filters.date), "asc", 200);
  } else {
    const from = filters.from ?? addIsoDays(today, -DEFAULT_LOOKBACK_DAYS);
    const [past, future] = await Promise.all([
      selectLessons(
        and(gte(lessons.date, from), lte(lessons.date, today)),
        "desc",
        PAST_LIMIT,
      ),
      selectLessons(
        and(gte(lessons.date, from), gt(lessons.date, today)),
        "asc",
        FUTURE_LIMIT,
      ),
    ]);
    rows = [...past, ...future];
  }

  const all: QueueItem[] = rows.map((row) => ({
    id: row.id,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    className: row.className,
    subjectName: row.subjectName,
    subjectColor: row.subjectColor,
    tutorName: `${row.tutorFirst} ${row.tutorLast}`.trim(),
    unmarkedCount: Number(row.unmarkedCount),
    state: lessonQueueState(
      {
        date: row.date,
        startTime: row.startTime,
        status: row.status,
        unmarkedCount: Number(row.unmarkedCount),
      },
      now,
    ),
  }));

  const counts = Object.fromEntries(QUEUE_VIEWS.map((view) => [view, 0])) as Record<
    QueueView,
    number
  >;
  for (const item of all) counts[viewForState(item.state)] += 1;

  return { filters, classLabel, items: buildQueue(all, filters.view), counts, today };
}
