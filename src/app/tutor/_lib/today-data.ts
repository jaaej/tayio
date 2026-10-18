import "server-only";
import { and, asc, desc, eq, gte, inArray, min, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  lessons,
  profiles,
  quizzes,
  subjects,
  subjectWeeks,
} from "@/db/schema";
import { getLessonWeek } from "@/lib/week-plans";
import { getCoverBoardRows } from "@/lib/tutor-cover";
import type { LessonCounts } from "@/lib/lesson-progress";
import { lessonCountFields } from "@/lib/lesson-progress-sql";
import { lessonStartInstant, melbourneDate } from "@/lib/tutor-cover-rules";
import { TUTOR_QUIZ_TODO_STATUSES } from "./nav-badges";
import { quizWeekPlanHrefs } from "./quiz-week";
import { tutorHomeworkFilter } from "./homework-access";

// Queries behind the tutor Today page and the Classes next-class strip. Every
// query is scoped to the signed-in tutor's id.

/** Lessons that never ran: they need no note, no attendance and no slot. */
const NOT_RUN = ["cancelled", "rescheduled"] as const;

export type DayLesson = {
  id: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
  className: string;
  subjectName: string;
  subjectColor: string | null;
  /** Room for an in-person lesson, "Online" for an online one, else null. */
  place: string | null;
  recordingUrl: string | null;
  studentCount: number;
  /** Roll and note counts, for `describeLesson`. */
  counts: LessonCounts;
};

function lessonSelect() {
  return db
    .select({
      id: lessons.id,
      classId: lessons.classId,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      className: classes.name,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      lessonLocation: lessons.location,
      classLocation: classes.location,
      recordingUrl: lessons.recordingUrl,
      status: lessons.status,
      studentCount: sql<number>`(
        select count(*)::int from ${enrollments}
        where ${enrollments.classId} = ${lessons.classId}
          and ${enrollments.withdrawnAt} is null
      )`,
      ...lessonCountFields,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId));
}

type LessonRow = Awaited<ReturnType<ReturnType<typeof lessonSelect>["execute"]>>[number];

function toDayLesson(r: LessonRow): DayLesson {
  const location = r.lessonLocation ?? r.classLocation;
  return {
    id: r.id,
    classId: r.classId,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    className: r.className,
    subjectName: r.subjectName,
    subjectColor: r.subjectColor,
    place: location,
    recordingUrl: r.recordingUrl,
    studentCount: r.studentCount,
    counts: {
      id: r.id,
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      roster: r.roster,
      marked: r.marked,
      absent: r.absent,
      notesWritten: r.notesWritten,
    },
  };
}

/** The tutor's lessons on one Melbourne date, earliest first. */
export async function getTutorDayLessons(tutorId: string, isoDate: string) {
  const rows = await lessonSelect()
    .where(
      and(
        eq(lessons.tutorId, tutorId),
        eq(lessons.date, isoDate),
        notInArray(lessons.status, [...NOT_RUN]),
      ),
    )
    .orderBy(asc(lessons.startTime));
  return rows.map(toDayLesson);
}

/** The lesson in progress or next to start, from now on. Null when none. */
export async function getTutorUpcomingLesson(tutorId: string, now: Date) {
  const today = melbourneDate(now);
  const rows = await lessonSelect()
    .where(
      and(
        eq(lessons.tutorId, tutorId),
        gte(lessons.date, today),
        notInArray(lessons.status, [...NOT_RUN]),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime))
    .limit(8);
  const next = rows.find(
    (r) => lessonStartInstant(r.date, r.endTime).getTime() > now.getTime(),
  );
  return next ? toDayLesson(next) : null;
}

export type LessonWeekSummary = {
  weekNumber: number;
  title: string;
  quizStatus: string | null;
  /** Melbourne date of the earliest homework due for this class and week. */
  homeworkDueIso: string | null;
};

/** The curriculum week a lesson falls in, with its quiz and homework state. */
export async function getLessonWeekSummary(
  lesson: Pick<DayLesson, "classId" | "date">,
): Promise<LessonWeekSummary | null> {
  const week = await getLessonWeek(lesson.classId, lesson.date);
  if (!week) return null;
  const [[quiz], [hw]] = await Promise.all([
    db
      .select({ status: quizzes.status })
      .from(quizzes)
      .where(eq(quizzes.subjectWeekId, week.subjectWeekId))
      .limit(1),
    db
      .select({ due: min(homework.dueDate) })
      .from(homework)
      .where(
        and(
          eq(homework.classId, lesson.classId),
          eq(homework.weekId, week.subjectWeekId),
        ),
      ),
  ]);
  return {
    weekNumber: week.weekNumber,
    title: week.title,
    quizStatus: quiz?.status ?? null,
    homeworkDueIso: hw?.due ? melbourneDate(new Date(hw.due)) : null,
  };
}

export type MarkingSummary = {
  total: number;
  late: number;
  /** The submission to mention: the oldest late one, else the oldest. */
  first: { firstName: string; lastName: string; title: string } | null;
};

export async function getMarkingSummary(tutorId: string): Promise<MarkingSummary> {
  const rows = await db
    .select({
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      title: homework.title,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .innerJoin(profiles, eq(profiles.id, homeworkAssignments.studentId))
    .where(
      and(
        tutorHomeworkFilter(tutorId),
        inArray(homeworkAssignments.status, ["submitted", "late"]),
      ),
    )
    .orderBy(asc(homeworkAssignments.submittedAt));
  const late = rows.filter((r) => r.status === "late");
  const first = late[0] ?? rows[0] ?? null;
  return {
    total: rows.length,
    late: late.length,
    first: first
      ? { firstName: first.firstName, lastName: first.lastName, title: first.title }
      : null,
  };
}

export type QuizRequest = {
  id: string;
  status: string;
  title: string;
  subjectName: string;
  weekNumber: number;
  note: string | null;
  /** The quiz's week in the tutor's class week plan, where the quiz lives. */
  href: string;
};

/** Quizzes an admin asked this tutor to write or fix, oldest ask first. */
export async function getQuizRequests(tutorId: string): Promise<QuizRequest[]> {
  const rows = await db
    .select({
      id: quizzes.id,
      status: quizzes.status,
      title: quizzes.title,
      subjectId: quizzes.subjectId,
      subjectWeekId: quizzes.subjectWeekId,
      subjectName: subjects.name,
      weekNumber: subjectWeeks.weekNumber,
      note: quizzes.note,
    })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .where(
      and(
        eq(quizzes.assignedTutorId, tutorId),
        inArray(quizzes.status, [...TUTOR_QUIZ_TODO_STATUSES]),
      ),
    )
    .orderBy(asc(quizzes.updatedAt));
  const hrefs = await quizWeekPlanHrefs(tutorId, rows);
  return rows.map(({ subjectId: _subjectId, ...row }) => ({
    ...row,
    href: hrefs.get(row.subjectWeekId) ?? "/tutor/classes",
  }));
}

/** Open covers this tutor could take (not their own), soonest first. */
export async function getClaimableCovers(tutorId: string, now: Date) {
  const rows = await getCoverBoardRows(now);
  return rows.filter(
    (row) => row.status === "open" && row.originalTutorId !== tutorId,
  );
}

/** Homework past due and not handed in, for "Students to bump". */
export async function getOverdueHomework(tutorId: string, now: Date) {
  const rows = await db
    .select({
      studentId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      className: classes.name,
      dueDate: homework.dueDate,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .innerJoin(profiles, eq(profiles.id, homeworkAssignments.studentId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        tutorHomeworkFilter(tutorId),
        inArray(homeworkAssignments.status, [
          "not_started",
          "viewed",
          "resubmission_requested",
        ]),
        sql`${homework.dueDate} < ${now.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(desc(homework.dueDate))
    .limit(200);
  // Overdue means due on an earlier day: work due later today is not late yet.
  const today = melbourneDate(now);
  return rows
    .map((r) => ({
      studentId: r.studentId,
      firstName: r.firstName,
      lastName: r.lastName,
      className: r.className,
      dueIso: melbourneDate(new Date(r.dueDate)),
    }))
    .filter((r) => r.dueIso < today);
}
