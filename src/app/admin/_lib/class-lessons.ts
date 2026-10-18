import "server-only";

import { and, eq, gte, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { db } from "@/db/client";
import {
  attendance,
  classCredits,
  classMoveRequests,
  enrollments,
  familyLinks,
  homework,
  lessonCancellations,
  lessonNotes,
  lessons,
  rescheduleRequests,
  tutorCheckinEntries,
  tutorCoverRequests,
} from "@/db/schema";
import { lessonStartInstant, melbourneDate } from "@/lib/tutor-cover-rules";
import type { ScheduleChangePlan, SlotLesson } from "@/lib/class-schedule-change";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * True when any record points at the lesson: attendance, notes, a reschedule
 * or make-up booking, a cover request, a student's cancellation, a credit,
 * homework, a tutor's logged hours, or a lesson moved out of it. Such a
 * lesson is never deleted by a schedule change.
 */
function lessonHasDependents(lessonId: SQL | typeof lessons.id) {
  return sql<boolean>`(
    exists (select 1 from ${attendance} where ${attendance.lessonId} = ${lessonId})
    or exists (select 1 from ${lessonNotes} where ${lessonNotes.lessonId} = ${lessonId})
    or exists (select 1 from ${rescheduleRequests} where ${rescheduleRequests.originalLessonId} = ${lessonId} or ${rescheduleRequests.targetLessonId} = ${lessonId})
    or exists (select 1 from ${tutorCoverRequests} where ${tutorCoverRequests.lessonId} = ${lessonId})
    or exists (select 1 from ${lessonCancellations} where ${lessonCancellations.lessonId} = ${lessonId})
    or exists (select 1 from ${classCredits} where ${classCredits.grantedFromLessonId} = ${lessonId} or ${classCredits.redeemedOnLessonId} = ${lessonId})
    or exists (select 1 from ${homework} where ${homework.lessonId} = ${lessonId})
    or exists (select 1 from ${tutorCheckinEntries} where ${tutorCheckinEntries.lessonId} = ${lessonId})
    or exists (select 1 from ${lessons} moved where moved.rescheduled_from = ${lessonId})
  )`;
}

/**
 * The class's lessons that came from its weekly slot and have not started:
 * upcoming, not created by a reschedule, starting after `now` (Melbourne).
 */
export async function loadSlotLessons(
  tx: DbTx,
  classId: string,
  now: Date,
): Promise<SlotLesson[]> {
  const rows = await tx
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      tutorId: lessons.tutorId,
      location: lessons.location,
      hasDependents: lessonHasDependents(lessons.id),
    })
    .from(lessons)
    .where(
      and(
        eq(lessons.classId, classId),
        eq(lessons.status, "upcoming"),
        isNull(lessons.rescheduledFrom),
        gte(lessons.date, melbourneDate(now)),
      ),
    )
    .orderBy(lessons.date, lessons.startTime);
  return rows.filter((r) => lessonStartInstant(r.date, r.startTime) > now);
}

/** Apply a schedule change plan inside the caller's transaction. */
export async function applyScheduleChangePlan(tx: DbTx, plan: ScheduleChangePlan) {
  for (const { id, set } of plan.updates) {
    await tx.update(lessons).set(set).where(eq(lessons.id, id));
  }
  if (plan.deletes.length > 0) {
    // Re-checked here: a booking made since the lessons were read wins.
    await tx
      .delete(lessons)
      .where(
        and(inArray(lessons.id, plan.deletes), sql`not ${lessonHasDependents(lessons.id)}`),
      );
  }
}

/** Active students in the class and their linked parents. */
export async function classFamilies(tx: DbTx, classId: string) {
  const students = await tx
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.classId, classId), isNull(enrollments.withdrawnAt)));
  const studentIds = students.map((s) => s.id);
  const parents =
    studentIds.length === 0
      ? []
      : await tx
          .select({ parentId: familyLinks.parentId, studentId: familyLinks.studentId })
          .from(familyLinks)
          .where(inArray(familyLinks.studentId, studentIds));
  // One notification per parent, opened on their first child in the class.
  const parentChild = new Map<string, string>();
  for (const p of parents) if (!parentChild.has(p.parentId)) parentChild.set(p.parentId, p.studentId);
  return { studentIds, parentChild };
}

/** A lesson something was recorded on: attendance, a note, or homework (marks). */
function lessonHasRecord(lessonId: SQL | typeof lessons.id) {
  return sql<boolean>`(
    exists (select 1 from ${attendance} where ${attendance.lessonId} = ${lessonId})
    or exists (select 1 from ${lessonNotes} where ${lessonNotes.lessonId} = ${lessonId})
    or exists (select 1 from ${homework} where ${homework.lessonId} = ${lessonId})
  )`;
}

export type ClassDeletionImpact = {
  upcomingLessons: number;
  pastLessons: number;
  /** Lessons with attendance, notes or marks; while any exist the class
   *  cannot be deleted, so that record is never lost by accident. */
  recordedLessons: number;
  enrolled: number;
  moveRequests: number;
};

/** What deleting the class would remove, and whether it is allowed. */
export async function classDeletionImpact(
  tx: DbTx,
  classId: string,
  now: Date,
): Promise<ClassDeletionImpact> {
  const today = melbourneDate(now);
  const [[counts], [moves], [enr]] = await Promise.all([
    tx
      .select({
        upcoming: sql<number>`count(*) filter (where ${lessons.date} >= ${today} and ${lessons.status} not in ('completed', 'missed'))::int`,
        past: sql<number>`count(*) filter (where ${lessons.date} < ${today} or ${lessons.status} in ('completed', 'missed'))::int`,
        recorded: sql<number>`count(*) filter (where ${lessonHasRecord(lessons.id)})::int`,
      })
      .from(lessons)
      .where(and(eq(lessons.classId, classId), ne(lessons.status, "cancelled"))),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(classMoveRequests)
      .where(
        sql`${classMoveRequests.fromClassId} = ${classId} or ${classMoveRequests.toClassId} = ${classId}`,
      ),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(and(eq(enrollments.classId, classId), isNull(enrollments.withdrawnAt))),
  ]);
  return {
    upcomingLessons: counts?.upcoming ?? 0,
    pastLessons: counts?.past ?? 0,
    recordedLessons: counts?.recorded ?? 0,
    enrolled: enr?.n ?? 0,
    moveRequests: moves?.n ?? 0,
  };
}

export type LessonDeletionImpact = {
  /** Only a lesson that has started can be deleted; a future weekly lesson
   *  would just be made again by the daily sweep. */
  started: boolean;
  attendanceRecords: number;
  lessonNotes: number;
  homework: number;
};

export async function lessonDeletionImpact(
  tx: DbTx,
  lessonId: string,
  now: Date,
): Promise<LessonDeletionImpact | null> {
  const [row] = await tx
    .select({
      date: lessons.date,
      startTime: lessons.startTime,
      attendance: sql<number>`(select count(*)::int from ${attendance} where ${attendance.lessonId} = ${lessons.id})`,
      notes: sql<number>`(select count(*)::int from ${lessonNotes} where ${lessonNotes.lessonId} = ${lessons.id})`,
      homework: sql<number>`(select count(*)::int from ${homework} where ${homework.lessonId} = ${lessons.id})`,
    })
    .from(lessons)
    .where(eq(lessons.id, lessonId));
  if (!row) return null;
  return {
    started: lessonStartInstant(row.date, row.startTime) <= now,
    attendanceRecords: row.attendance,
    lessonNotes: row.notes,
    homework: row.homework,
  };
}
