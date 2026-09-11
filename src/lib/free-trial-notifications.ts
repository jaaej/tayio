import "server-only";

import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  lessonCancellations,
  lessons,
  notifications,
  profiles,
  rescheduleRequests,
  studentTrials,
  subjects,
  type UserRole,
} from "@/db/schema";
import { formatDateLong, formatTime } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import {
  freeTrialFollowUpDedupeKey,
  freeTrialTodayDedupeKey,
} from "@/lib/free-trial-rules";
import { ADMIN_TIERS } from "@/lib/roles";
import { melbourneDate } from "@/lib/tutor-cover-rules";

const ADMIN_ROLES = ["admin", ...ADMIN_TIERS] as UserRole[];
const trialStudent = alias(profiles, "trial_notice_student");
const assignedTutor = alias(profiles, "trial_notice_tutor");
const approvedMove = alias(rescheduleRequests, "trial_notice_approved_move");
const cancellation = alias(
  lessonCancellations,
  "trial_notice_lesson_cancellation",
);

type TrialLessonEvent = {
  lessonId: string;
  studentId: string;
  studentFirst: string;
  studentLast: string;
  className: string;
  subjectName: string;
  tutorId: string;
  tutorFirst: string;
  tutorLast: string;
  tutorActive: boolean;
  startTime: string;
  endTime: string;
};

function eventSelection() {
  return {
    lessonId: lessons.id,
    studentId: studentTrials.studentId,
    studentFirst: trialStudent.firstName,
    studentLast: trialStudent.lastName,
    className: classes.name,
    subjectName: subjects.name,
    tutorId: lessons.tutorId,
    tutorFirst: assignedTutor.firstName,
    tutorLast: assignedTutor.lastName,
    tutorActive: assignedTutor.isActive,
    startTime: lessons.startTime,
    endTime: lessons.endTime,
  };
}

async function getTodaysTrialLessons(today: string): Promise<TrialLessonEvent[]> {
  // Regular attendees: exclude make-up lesson rows for the same class and any
  // student who has already moved/cancelled out of this particular lesson.
  const regular = await db
    .select(eventSelection())
    .from(studentTrials)
    .innerJoin(trialStudent, eq(trialStudent.id, studentTrials.studentId))
    .innerJoin(enrollments, eq(enrollments.studentId, studentTrials.studentId))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(lessons, eq(lessons.classId, classes.id))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(assignedTutor, eq(assignedTutor.id, lessons.tutorId))
    .leftJoin(
      approvedMove,
      and(
        eq(approvedMove.originalLessonId, lessons.id),
        eq(approvedMove.studentId, studentTrials.studentId),
        eq(approvedMove.status, "approved"),
      ),
    )
    .leftJoin(
      cancellation,
      and(
        eq(cancellation.lessonId, lessons.id),
        eq(cancellation.studentId, studentTrials.studentId),
      ),
    )
    .where(
      and(
        eq(lessons.date, today),
        inArray(lessons.status, ["upcoming", "completed", "missed"]),
        isNull(lessons.rescheduledFrom),
        eq(trialStudent.isActive, true),
        isNull(enrollments.withdrawnAt),
        isNull(approvedMove.id),
        isNull(cancellation.id),
        sql`${studentTrials.startDate} <= ${today}`,
        sql`${studentTrials.endDate} >= ${today}`,
      ),
    );

  // Temporary make-up attendees are not enrolled in the target class, so add
  // them from the approved reschedule record instead of the regular roll.
  const makeups = await db
    .select(eventSelection())
    .from(rescheduleRequests)
    .innerJoin(
      studentTrials,
      eq(studentTrials.studentId, rescheduleRequests.studentId),
    )
    .innerJoin(trialStudent, eq(trialStudent.id, studentTrials.studentId))
    .innerJoin(lessons, eq(lessons.id, rescheduleRequests.targetLessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(assignedTutor, eq(assignedTutor.id, lessons.tutorId))
    .where(
      and(
        eq(rescheduleRequests.status, "approved"),
        eq(lessons.date, today),
        inArray(lessons.status, ["upcoming", "makeup", "completed", "missed"]),
        eq(trialStudent.isActive, true),
        sql`${studentTrials.startDate} <= ${today}`,
        sql`${studentTrials.endDate} >= ${today}`,
      ),
    );

  const unique = new Map<string, TrialLessonEvent>();
  for (const event of [...regular, ...makeups]) {
    unique.set(`${event.lessonId}:${event.studentId}`, event);
  }
  return Array.from(unique.values());
}

async function insertDeduped(
  values: Array<typeof notifications.$inferInsert>,
): Promise<number> {
  if (values.length === 0) return 0;
  const inserted = await db
    .insert(notifications)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  return inserted.length;
}

/** Daily, retry-safe free-trial alert sweep. It is run by the same secured
 * Vercel cron as tutor cover reminders and immediately after an admin saves a
 * trial, so a trial added on the day is not missed. */
export async function runFreeTrialNotifications(now = new Date()) {
  const today = melbourneDate(now);
  const [adminRows, events, endedTrials] = await Promise.all([
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(
        and(inArray(profiles.role, ADMIN_ROLES), eq(profiles.isActive, true)),
      ),
    getTodaysTrialLessons(today),
    db
      .select({
        studentId: studentTrials.studentId,
        endDate: studentTrials.endDate,
        firstName: trialStudent.firstName,
        lastName: trialStudent.lastName,
      })
      .from(studentTrials)
      .innerJoin(trialStudent, eq(trialStudent.id, studentTrials.studentId))
      .where(
        and(lt(studentTrials.endDate, today), eq(trialStudent.isActive, true)),
      ),
  ]);
  const adminIds = adminRows.map((row) => row.id);

  const todayValues: Array<typeof notifications.$inferInsert> = [];
  for (const event of events) {
    const studentName = `${event.studentFirst} ${event.studentLast}`.trim();
    const tutorName = `${event.tutorFirst} ${event.tutorLast}`.trim();
    const body =
      `${studentName} has a free trial today: ` +
      `${classDisplayName(event.subjectName, event.className)}, ` +
      `${formatTime(event.startTime)}–${formatTime(event.endTime)}, ` +
      `with ${tutorName}.`;
    const dedupeKey = freeTrialTodayDedupeKey(
      event.lessonId,
      event.studentId,
    );
    for (const userId of adminIds) {
      todayValues.push({
        userId,
        channel: "in_app",
        title: "Free-trial student today",
        body,
        href: `/admin/attendance/${event.lessonId}`,
        dedupeKey,
      });
    }
    if (event.tutorActive) {
      todayValues.push({
        userId: event.tutorId,
        channel: "in_app",
        title: "Free-trial student today",
        body,
        href: `/tutor/lessons/${event.lessonId}`,
        dedupeKey,
      });
    }
  }

  const followUpValues: Array<typeof notifications.$inferInsert> = [];
  for (const trial of endedTrials) {
    const studentName = `${trial.firstName} ${trial.lastName}`.trim();
    for (const userId of adminIds) {
      followUpValues.push({
        userId,
        channel: "in_app",
        title: "Bump student for free-trial follow-up",
        body:
          `${studentName}’s free trial ended on ${formatDateLong(trial.endDate)}. ` +
          "Follow up with the student or family.",
        href: `/admin/users/${trial.studentId}`,
        dedupeKey: freeTrialFollowUpDedupeKey(
          trial.studentId,
          trial.endDate,
        ),
      });
    }
  }

  const [todaySent, followUpsSent] = await Promise.all([
    insertDeduped(todayValues),
    insertDeduped(followUpValues),
  ]);
  return {
    todaySent,
    followUpsSent,
    trialLessons: events.length,
  };
}
