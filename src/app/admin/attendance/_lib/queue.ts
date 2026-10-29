import "server-only";

import { and, asc, desc, eq, gte, inArray, not, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, lessons, profiles, subjects } from "@/db/schema";
import { addIsoDays } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { classDisplayName } from "@/lib/class-display";
import {
  LESSON_OFF_STATUSES,
  lessonRanSql,
  unmarkedOnRollSql,
} from "@/lib/lesson-progress-sql";
import {
  QUEUE_VIEWS,
  classParam,
  dateParam,
  lessonQueueState,
  parseQueueView,
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
  tutorId: string;
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

/** How far back the Marked tab reaches when no `from` is given. */
const DEFAULT_LOOKBACK_DAYS = 30;

/** The most lessons one tab lists; the backlogs are bounded by what is outstanding. */
const VIEW_LIMIT: Record<QueueView, number> = {
  to_mark: 1000,
  marked: 300,
  upcoming: 100,
};

/** Which lessons belong to each tab (one place, so counts and lists agree). */
function viewWhere(view: QueueView, now: Date): SQL {
  const ran = lessonRanSql(now);
  const off = inArray(lessons.status, [...LESSON_OFF_STATUSES]);
  switch (view) {
    case "to_mark":
      return sql`(${ran} and ${unmarkedOnRollSql} > 0)`;
    case "marked":
      // Cancelled and rescheduled lessons need no roll: filed with the done ones.
      return sql`(${off} or (${ran} and ${unmarkedOnRollSql} = 0))`;
    case "upcoming":
      return and(notInArray(lessons.status, [...LESSON_OFF_STATUSES]), not(ran)) as SQL;
  }
}

/**
 * The dates a tab covers: one class (every date), one picked day, or the
 * default range. Backlog tabs reach back to the oldest outstanding lesson
 * unless `from` narrows them; Marked starts 30 days back.
 */
function scopeWhere(filters: QueueFilters, view: QueueView, today: string): SQL | undefined {
  if (filters.classId) {
    return and(
      eq(lessons.classId, filters.classId),
      filters.date ? eq(lessons.date, filters.date) : undefined,
    );
  }
  if (filters.date) return eq(lessons.date, filters.date);
  if (filters.from) return gte(lessons.date, filters.from);
  if (view === "marked") return gte(lessons.date, addIsoDays(today, -DEFAULT_LOOKBACK_DAYS));
  return undefined;
}

function selectLessons(view: QueueView, where: SQL | undefined) {
  const dir = view === "upcoming" ? asc : desc;
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
      tutorId: lessons.tutorId,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      // Shared with the admin dashboard's counts, so the two always agree.
      unmarkedCount: unmarkedOnRollSql,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(where)
    .orderBy(dir(lessons.date), dir(lessons.startTime))
    .limit(VIEW_LIMIT[view]);
}

/**
 * The lesson queue shared by /admin/attendance and its lesson pages. Each
 * tab is its own query with an exact count, so a long run of past or future
 * lessons can never push outstanding ones out of the list or the count.
 */
export async function getAttendanceQueue(
  filters: QueueFilters,
  now = new Date(),
): Promise<AttendanceQueue> {
  const today = melbourneDate(now);
  const view = filters.view;

  const [rows, countRows, classLabel] = await Promise.all([
    selectLessons(view, and(scopeWhere(filters, view, today), viewWhere(view, now))),
    db.select(countSelection(filters, today, now)).from(lessons),
    filters.classId ? getClassLabel(filters.classId) : Promise.resolve(null),
  ]);

  const items: QueueItem[] = rows.map((row) => ({
    id: row.id,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    className: row.className,
    subjectName: row.subjectName,
    subjectColor: row.subjectColor,
    tutorId: row.tutorId,
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

  const counts = Object.fromEntries(
    QUEUE_VIEWS.map((v) => [v, Number(countRows[0]?.[v] ?? 0)]),
  ) as Record<QueueView, number>;

  return {
    filters,
    classLabel,
    items,
    counts,
    today,
  };
}

/** One `count(*) filter (...)` per tab, each with its own date scope. */
function countSelection(filters: QueueFilters, today: string, now: Date) {
  const selection = {} as Record<QueueView, SQL<number>>;
  for (const v of QUEUE_VIEWS) {
    const where = and(scopeWhere(filters, v, today), viewWhere(v, now));
    selection[v] = sql<number>`count(*) filter (where ${where})::int`;
  }
  return selection;
}

async function getClassLabel(classId: string): Promise<string | null> {
  const [cls] = await db
    .select({ name: classes.name, subjectName: subjects.name })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(classes.id, classId));
  return cls ? classDisplayName(cls.subjectName, cls.name) : null;
}

export type QueueBacklog = {
  toMark: { count: number; oldest: string | null };
};

/**
 * The To mark backlog counted with the same predicate as the queue, so the
 * admin dashboard's To do and the queue can never disagree.
 */
export async function getQueueBacklog(now = new Date()): Promise<QueueBacklog> {
  const toMark = viewWhere("to_mark", now);
  const [row] = await db
    .select({
      toMark: sql<number>`count(*) filter (where ${toMark})::int`,
      toMarkOldest: sql<string | null>`(min(${lessons.date}) filter (where ${toMark}))::text`,
    })
    .from(lessons)
    .where(lessonRanSql(now));
  return {
    toMark: { count: Number(row?.toMark ?? 0), oldest: row?.toMarkOldest ?? null },
  };
}
