import "server-only";

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  familyLinks,
  homework,
  homeworkAssignments,
  lessons,
  profiles,
  studentLeave,
  studentTrials,
  subjects,
} from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { freeTrialDirectoryState } from "@/lib/account-schedule-status";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { getTutorStudentsByClass } from "@/app/tutor/_data";
import {
  RECENT_LESSONS,
  attendanceSummary,
  homeworkState,
  studentFlag,
  studentSubLine,
  yearKeyOf,
  yearOptions,
  type StudentListGroup,
} from "./student-list";

/** Not handed in yet: the statuses that can turn overdue. */
const OPEN_HOMEWORK = ["not_started", "viewed", "resubmission_requested"] as const;

/**
 * Each student's last few marked lessons in the classes this tutor teaches,
 * newest first. One windowed query for the whole roster.
 */
async function recentAttendance(
  classIds: string[],
  studentIds: string[],
): Promise<Map<string, string[]>> {
  const byStudent = new Map<string, string[]>();
  if (classIds.length === 0 || studentIds.length === 0) return byStudent;
  const rows = await db.execute<{ student_id: string; status: string }>(sql`
    select student_id, status
    from (
      select ${attendance.studentId} as student_id, ${attendance.status} as status,
             row_number() over (
               partition by ${attendance.studentId}
               order by ${lessons.date} desc, ${lessons.startTime} desc
             ) as rn
      from ${attendance}
      join ${lessons} on ${lessons.id} = ${attendance.lessonId}
      where ${inArray(lessons.classId, classIds)}
        and ${inArray(attendance.studentId, studentIds)}
    ) recent
    where rn <= ${RECENT_LESSONS}
  `);
  for (const r of rows) {
    const list = byStudent.get(r.student_id) ?? [];
    list.push(r.status);
    byStudent.set(r.student_id, list);
  }
  return byStudent;
}

export type StudentPaneData = {
  groups: StudentListGroup[];
  years: Array<{ key: string; label: string }>;
};

/**
 * Everything the students list pane needs, shaped once on the server: the
 * tutor's classes with their enrolled students, each row carrying recent
 * attendance and a single flag (leave, overdue work, due today, trial).
 */
export async function getStudentPaneData(tutorId: string): Promise<StudentPaneData> {
  const [{ classes: roster }, classYears] = await Promise.all([
    getTutorStudentsByClass(tutorId),
    db
      .select({ id: classes.id, yearLevel: subjects.yearLevel })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(eq(classes.tutorId, tutorId)),
  ]);
  const yearByClass = new Map(classYears.map((c) => [c.id, c.yearLevel]));
  const classIds = roster.map((c) => c.classId);
  const studentIds = Array.from(
    new Set(roster.flatMap((c) => c.students.map((s) => s.id))),
  );
  const today = melbourneDate(new Date());

  const [attendanceByStudent, openHomework, leaveRows, trialRows] =
    studentIds.length === 0
      ? [new Map<string, string[]>(), [], [], []]
      : await Promise.all([
          recentAttendance(classIds, studentIds),
          db
            .select({
              studentId: homeworkAssignments.studentId,
              status: homeworkAssignments.status,
              dueDate: homework.dueDate,
            })
            .from(homeworkAssignments)
            .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
            .where(
              and(
                eq(homework.tutorId, tutorId),
                inArray(homeworkAssignments.studentId, studentIds),
                inArray(homeworkAssignments.status, [...OPEN_HOMEWORK]),
              ),
            ),
          db
            .select({ studentId: studentLeave.studentId })
            .from(studentLeave)
            .where(
              and(
                inArray(studentLeave.studentId, studentIds),
                lte(studentLeave.startDate, today),
                gte(studentLeave.endDate, today),
              ),
            ),
          db
            .select({
              studentId: studentTrials.studentId,
              startDate: studentTrials.startDate,
              endDate: studentTrials.endDate,
            })
            .from(studentTrials)
            .where(inArray(studentTrials.studentId, studentIds)),
        ]);

  const overdue = new Map<string, number>();
  const dueToday = new Map<string, number>();
  for (const h of openHomework) {
    const state = homeworkState(h.status, melbourneDate(h.dueDate), today);
    if (state === "overdue") overdue.set(h.studentId, (overdue.get(h.studentId) ?? 0) + 1);
    if (state === "due_today") dueToday.set(h.studentId, (dueToday.get(h.studentId) ?? 0) + 1);
  }
  const onLeave = new Set(leaveRows.map((r) => r.studentId));
  const onTrial = new Set(
    trialRows
      .filter((t) => freeTrialDirectoryState(t, today) === "current")
      .map((t) => t.studentId),
  );

  const groups: StudentListGroup[] = roster.map((c) => ({
    classId: c.classId,
    label: classDisplayName(c.subjectName, c.className),
    subjectName: c.subjectName,
    yearKey: yearKeyOf(yearByClass.get(c.classId)),
    students: c.students.map((s) => {
      const att = attendanceSummary(attendanceByStudent.get(s.id) ?? []);
      const late = overdue.get(s.id) ?? 0;
      const trial = onTrial.has(s.id);
      return {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        avatarKey: s.profileAvatarKey,
        sub: studentSubLine(att, late, trial),
        flag: studentFlag({
          onLeave: onLeave.has(s.id),
          overdue: late,
          dueToday: dueToday.get(s.id) ?? 0,
          trial,
        }),
      };
    }),
  }));

  // Classes in a predictable order: by display name, as the class list reads.
  groups.sort((a, b) => a.label.localeCompare(b.label));

  return {
    groups,
    years: yearOptions(roster.map((c) => yearByClass.get(c.classId) ?? null)),
  };
}

/**
 * Profile header context for one student: their parents (name only, for the
 * header and "Message parent"), the tutor's classes they sit in, and whether
 * they are on leave or on a free trial today. Call only after
 * `assertTutorTeachesStudent` (getStudentProfile runs it).
 */
export async function getStudentHeaderContext(tutorId: string, studentId: string) {
  const today = melbourneDate(new Date());
  const [parents, classRows, [leave], [trial]] = await Promise.all([
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        isPrimaryContact: familyLinks.isPrimaryContact,
      })
      .from(familyLinks)
      .innerJoin(profiles, eq(profiles.id, familyLinks.parentId))
      .where(and(eq(familyLinks.studentId, studentId), eq(profiles.isActive, true)))
      .orderBy(asc(profiles.firstName)),
    db
      .select({ name: classes.name, subjectName: subjects.name })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(classes.tutorId, tutorId),
          sql`${enrollments.withdrawnAt} is null`,
        ),
      )
      .orderBy(asc(subjects.name)),
    db
      .select({ startDate: studentLeave.startDate, endDate: studentLeave.endDate })
      .from(studentLeave)
      .where(
        and(
          eq(studentLeave.studentId, studentId),
          lte(studentLeave.startDate, today),
          gte(studentLeave.endDate, today),
        ),
      )
      .limit(1),
    db
      .select({ startDate: studentTrials.startDate, endDate: studentTrials.endDate })
      .from(studentTrials)
      .where(eq(studentTrials.studentId, studentId))
      .limit(1),
  ]);

  // Primary contact first, so "Message parent" reaches the right person.
  parents.sort((a, b) => Number(b.isPrimaryContact) - Number(a.isPrimaryContact));

  return {
    today,
    parents: parents.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
    })),
    classNames: classRows.map((c) => classDisplayName(c.subjectName, c.name)),
    leave: leave ?? null,
    trial: trial && freeTrialDirectoryState(trial, today) === "current" ? trial : null,
  };
}
