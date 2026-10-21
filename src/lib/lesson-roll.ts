import "server-only";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classCredits,
  enrollments,
  lessonCancellations,
  lessonRollAdditions,
  lessons,
  profiles,
  rescheduleRequests,
  studentLeave,
  studentTrials,
} from "@/db/schema";
import type { RollStudent } from "@/components/attendance/attendance-row";
import { yearLevelLabel } from "@/lib/format";
import { getLessonReschedules, lessonFromLabel } from "@/lib/reschedule";
import { moveReasons, rollMemberIds } from "@/lib/lesson-roll-rules";
import { onRosterSql } from "@/lib/class-roster-sql";
import { lessonGuestIds } from "@/lib/lesson-guests";
import { rollStatusOf } from "@/lib/attendance-roll";

/** A roll row, and whether the student is in the class (not just this lesson). */
export type LessonRollStudent = RollStudent & { inClass: boolean };

export type RollLesson = {
  id: string;
  classId: string;
  date: string;
  status: (typeof lessons.$inferSelect)["status"];
};

/**
 * Who is on a lesson's roll (`rollMemberIds`): the class on its date, the
 * students booked onto it (`lessonGuestIdsSql`: a reschedule, a credit, an
 * admin's one-off visit), and a student who has since left the class through
 * their mark; a student who joined the class after the lesson is not on it.
 * The admin and tutor rolls, both save actions and the lesson counts
 * (`lessonCountFields`) use this one rule.
 */
export async function lessonRollIds(
  lesson: Pick<RollLesson, "id" | "classId" | "status">,
): Promise<Set<string>> {
  const [regular, booked, marked] = await Promise.all([
    lesson.status === "makeup" ? Promise.resolve([]) : classRosterOnDate(lesson),
    lessonGuestIds(lesson.id),
    db
      .select({ studentId: attendance.studentId })
      .from(attendance)
      .where(eq(attendance.lessonId, lesson.id)),
  ]);
  return rollMemberIds(lesson.status, {
    classRoster: regular.map((r) => r.studentId),
    booked,
    marked: marked.map((r) => r.studentId),
  });
}

/**
 * The class's students on this lesson (`onRosterSql`): joined by its date,
 * not left before it, not taken off this lesson alone.
 */
function classRosterOnDate(lesson: Pick<RollLesson, "id" | "classId">) {
  return db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .innerJoin(lessons, eq(lessons.classId, enrollments.classId))
    .where(and(eq(lessons.id, lesson.id), eq(enrollments.classId, lesson.classId), onRosterSql("enrollments", "lessons")));
}

/**
 * The roll for one lesson, as both the admin Attendance page and the tutor
 * lesson page show it: the class's students first (with where a rescheduled
 * one went), then make-up attendees (with where they came from), each with
 * year level, leave, and free-trial context. Profile links are left to the
 * caller, since each role links somewhere different.
 */
export async function getLessonRoll(lesson: RollLesson): Promise<LessonRollStudent[]> {
  const ids = await lessonRollIds(lesson);
  if (ids.size === 0) return [];
  const studentIds = [...ids];

  const [
    people,
    marks,
    { movedOut, movedIn },
    regular,
    leave,
    trials,
    credits,
    creditedOut,
    moveRequests,
    cancellations,
    added,
  ] = await Promise.all([
      db
        .select({
          id: profiles.id,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          yearLevel: profiles.yearLevel,
        })
        .from(profiles)
        .where(inArray(profiles.id, studentIds))
        .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
      db
        .select({ studentId: attendance.studentId, status: attendance.status, note: attendance.note })
        .from(attendance)
        .where(eq(attendance.lessonId, lesson.id)),
      getLessonReschedules(lesson.id),
      lesson.status === "makeup" ? Promise.resolve([]) : classRosterOnDate(lesson),
      db
        .select({ studentId: studentLeave.studentId })
        .from(studentLeave)
        .where(
          and(
            inArray(studentLeave.studentId, studentIds),
            sql`${studentLeave.startDate} <= ${lesson.date}`,
            sql`${studentLeave.endDate} >= ${lesson.date}`,
          ),
        ),
      getStudentTrialsOnDate(studentIds, lesson.date),
      db
        .select({ studentId: classCredits.studentId, fromLessonId: classCredits.grantedFromLessonId })
        .from(classCredits)
        .where(eq(classCredits.redeemedOnLessonId, lesson.id)),
      // Students who took a class credit instead of this lesson.
      db
        .select({ studentId: classCredits.studentId, reason: classCredits.requestReason })
        .from(classCredits)
        .where(eq(classCredits.grantedFromLessonId, lesson.id)),
      // Approved moves out of or into this lesson, for their reasons.
      db
        .select({
          studentId: rescheduleRequests.studentId,
          reason: rescheduleRequests.reason,
          out: sql<boolean>`${rescheduleRequests.originalLessonId} = ${lesson.id}`,
        })
        .from(rescheduleRequests)
        .where(
          and(
            eq(rescheduleRequests.status, "approved"),
            or(
              eq(rescheduleRequests.originalLessonId, lesson.id),
              eq(rescheduleRequests.targetLessonId, lesson.id),
            ),
          ),
        ),
      db
        .select({ studentId: lessonCancellations.studentId, reason: lessonCancellations.reason })
        .from(lessonCancellations)
        .where(eq(lessonCancellations.lessonId, lesson.id)),
      // Put on this lesson alone by an admin (actions-roll).
      db
        .select({ studentId: lessonRollAdditions.studentId })
        .from(lessonRollAdditions)
        .where(eq(lessonRollAdditions.lessonId, lesson.id)),
    ]);

  const markBy = new Map(marks.map((m) => [m.studentId, m]));
  const movedOutTo = new Map(movedOut.map((m) => [m.studentId, m.toLabel]));
  const inClass = new Set(regular.map((r) => r.studentId));
  const onLeave = new Set(leave.map((r) => r.studentId));
  const trialBy = new Map(trials.map((t) => [t.studentId, t]));
  const makeupFrom = new Map(movedIn.map((m) => [m.studentId, m.fromLabel]));
  const tookCredit = new Set(creditedOut.map((c) => c.studentId));
  const visitors = new Set(added.map((a) => a.studentId));
  const reasonBy = moveReasons({
    movedOut: moveRequests.filter((r) => r.out),
    cancelled: cancellations,
    credited: creditedOut,
    movedIn: moveRequests.filter((r) => !r.out),
  });
  for (const c of credits) {
    if (makeupFrom.has(c.studentId)) continue;
    makeupFrom.set(c.studentId, c.fromLessonId ? await lessonFromLabel(c.fromLessonId) : "Credit");
  }

  const roll = people.map((p): LessonRollStudent => {
    const mark = markBy.get(p.id);
    const trial = trialBy.get(p.id);
    const joined = !inClass.has(p.id) ? makeupFrom.get(p.id) : undefined;
    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      // Everyone starts unmarked, make-ups too: the tutor marks who came.
      status: rollStatusOf(mark?.status),
      note: mark?.note ?? "",
      detail: p.yearLevel ? yearLevelLabel(p.yearLevel) : null,
      onLeave: onLeave.has(p.id),
      onTrial: Boolean(trial),
      trialNote: trial?.note?.trim() || null,
      inClass: inClass.has(p.id),
      ...(inClass.has(p.id) && movedOutTo.has(p.id) && { movedOutTo: movedOutTo.get(p.id) }),
      ...(!movedOutTo.has(p.id) && tookCredit.has(p.id) && { tookCredit: true }),
      ...(joined && { makeupFrom: joined }),
      ...(!inClass.has(p.id) && !joined && visitors.has(p.id) && { visiting: true }),
      ...(reasonBy.has(p.id) && { moveReason: reasonBy.get(p.id) }),
    };
  });
  // The class first, then the students joining it for this lesson.
  return [...roll.filter((s) => s.inClass), ...roll.filter((s) => !s.inClass)];
}

/** Free-trial context for a lesson roll. The date condition keeps a trial's
 * note off the roll outside the trial, including for make-up attendees. */
export async function getStudentTrialsOnDate(studentIds: string[], lessonDate: string) {
  if (studentIds.length === 0) return [];
  return db
    .select({ studentId: studentTrials.studentId, note: studentTrials.note })
    .from(studentTrials)
    .where(
      and(
        inArray(studentTrials.studentId, studentIds),
        sql`${studentTrials.startDate} <= ${lessonDate}`,
        sql`${studentTrials.endDate} >= ${lessonDate}`,
      ),
    );
}
