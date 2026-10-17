import "server-only";

import { and, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
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
  TRIAL_WITHDRAW_FROM_END_DATE,
  freeTrialEndsTodayDedupeKey,
  freeTrialFollowUpDedupeKey,
  freeTrialLeftClassDedupeKey,
  freeTrialTodayDedupeKey,
  joinedForTrial,
  trialWithdrawalDue,
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

type TrialClass = {
  studentId: string;
  studentName: string;
  endDate: string;
  classId: string;
  classLabel: string;
  tutorId: string;
  tutorActive: boolean;
};

/**
 * Classes that students joined for a trial ending today or already over
 * (from the automatic-removal rollout on) and are still in.
 */
async function classesJoinedForTrials(today: string): Promise<TrialClass[]> {
  const rows = await db
    .select({
      studentId: studentTrials.studentId,
      studentFirst: trialStudent.firstName,
      studentLast: trialStudent.lastName,
      startDate: studentTrials.startDate,
      endDate: studentTrials.endDate,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      tutorId: classes.tutorId,
      tutorActive: assignedTutor.isActive,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(studentTrials)
    .innerJoin(trialStudent, eq(trialStudent.id, studentTrials.studentId))
    .innerJoin(enrollments, eq(enrollments.studentId, studentTrials.studentId))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(assignedTutor, eq(assignedTutor.id, classes.tutorId))
    .where(
      and(
        isNull(enrollments.withdrawnAt),
        gte(studentTrials.endDate, TRIAL_WITHDRAW_FROM_END_DATE),
        lte(studentTrials.endDate, today),
      ),
    );
  return rows
    .filter((r) => joinedForTrial(melbourneDate(r.enrolledAt), r))
    .map((r) => ({
      studentId: r.studentId,
      studentName: `${r.studentFirst} ${r.studentLast}`.trim(),
      endDate: r.endDate,
      classId: r.classId,
      classLabel: classDisplayName(r.subjectName, r.className),
      tutorId: r.tutorId,
      tutorActive: r.tutorActive,
    }));
}

/** "Year 9 Maths · Saturday AM and Year 9 English · Tuesday PM". */
function listClasses(labels: string[]): string {
  return labels.length <= 1
    ? labels.join("")
    : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
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

/** Daily, retry-safe free-trial sweep: today's trial alerts, the last-day
 * reminder, leaving the classes joined for a trial once it is over (tutors are
 * told), and the admin follow-up. It is run by the same secured Vercel cron as
 * tutor cover reminders and immediately after an admin saves a trial, so a
 * trial added on the day is not missed. */
export async function runFreeTrialSweep(now = new Date()) {
  const today = melbourneDate(now);
  const trialClasses = await classesJoinedForTrials(today);

  // Leave the classes joined for trials that are over. Only rows this run
  // actually withdrew are announced, so a retry never repeats a notice.
  const left = new Map<string, string[]>();
  const tutorValues: Array<typeof notifications.$inferInsert> = [];
  for (const c of trialClasses.filter((x) => trialWithdrawalDue(x.endDate, today))) {
    const withdrawn = await db
      .update(enrollments)
      .set({ withdrawnAt: now })
      .where(
        and(
          eq(enrollments.classId, c.classId),
          eq(enrollments.studentId, c.studentId),
          isNull(enrollments.withdrawnAt),
        ),
      )
      .returning({ classId: enrollments.classId });
    if (withdrawn.length === 0) continue;
    left.set(c.studentId, [...(left.get(c.studentId) ?? []), c.classLabel]);
    if (c.tutorActive) {
      tutorValues.push({
        userId: c.tutorId,
        channel: "in_app",
        title: "Free trial ended",
        body: `${c.studentName}’s free trial has ended, so they’re no longer in ${c.classLabel}.`,
        href: `/tutor/classes/${c.classId}/students`,
        dedupeKey: freeTrialLeftClassDedupeKey(c.classId, c.studentId, c.endDate),
      });
    }
  }

  // Last day: tell admins which classes the student leaves tomorrow.
  const endingToday = new Map<string, { name: string; endDate: string; classes: string[] }>();
  for (const c of trialClasses.filter((x) => x.endDate === today)) {
    const entry = endingToday.get(c.studentId) ?? { name: c.studentName, endDate: c.endDate, classes: [] };
    entry.classes.push(c.classLabel);
    endingToday.set(c.studentId, entry);
  }

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

  const endsTodayValues: Array<typeof notifications.$inferInsert> = [];
  for (const [studentId, trial] of endingToday) {
    for (const userId of adminIds) {
      endsTodayValues.push({
        userId,
        channel: "in_app",
        title: "Free trial ends today",
        body:
          `${trial.name}’s free trial ends today. Tomorrow they leave ` +
          `${listClasses(trial.classes)} unless you extend or clear the trial.`,
        href: `/admin/users/${studentId}`,
        dedupeKey: freeTrialEndsTodayDedupeKey(studentId, trial.endDate),
      });
    }
  }

  const followUpValues: Array<typeof notifications.$inferInsert> = [];
  for (const trial of endedTrials) {
    const studentName = `${trial.firstName} ${trial.lastName}`.trim();
    const leftClasses = left.get(trial.studentId) ?? [];
    for (const userId of adminIds) {
      followUpValues.push({
        userId,
        channel: "in_app",
        title: "Bump student for free-trial follow-up",
        body:
          `${studentName}’s free trial ended on ${formatDateLong(trial.endDate)}. ` +
          (leftClasses.length > 0 ? `They have left ${listClasses(leftClasses)}. ` : "") +
          "Follow up with the student or family.",
        href: `/admin/users/${trial.studentId}`,
        dedupeKey: freeTrialFollowUpDedupeKey(
          trial.studentId,
          trial.endDate,
        ),
      });
    }
  }

  const [todaySent, followUpsSent, endsTodaySent, tutorsTold] = await Promise.all([
    insertDeduped(todayValues),
    insertDeduped(followUpValues),
    insertDeduped(endsTodayValues),
    insertDeduped(tutorValues),
  ]);
  return {
    todaySent,
    followUpsSent,
    endsTodaySent,
    tutorsTold,
    classesLeft: [...left.values()].reduce((n, list) => n + list.length, 0),
    trialLessons: events.length,
  };
}
