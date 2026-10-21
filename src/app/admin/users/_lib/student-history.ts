import "server-only";

import { and, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { studentBookedOnLessonSql, studentOnClassRosterSql } from "@/lib/class-roster-sql";
import {
  attendance,
  classCredits,
  classes,
  homework,
  homeworkAssignments,
  lessonNotes,
  lessons,
  profiles,
  studentLeave,
  studentTrials,
  subjects,
} from "@/db/schema";
import { attendanceMovedSql, attendanceStatusShownSql } from "@/lib/attendance-moved";
import { classDisplayName } from "@/lib/class-display";
import { formatDateShort } from "@/lib/format";
import { lessonRanSql } from "@/lib/lesson-progress-sql";
import {
  attendanceHistory,
  homeworkHistory,
  staffNotesTimeline,
  type AttendanceHistoryRow,
  type HomeworkHistoryRow,
  type StaffNote,
} from "@/lib/student-history";
import type { AttendanceSummary } from "@/lib/attendance-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";

export type StudentHistory = {
  attendance: AttendanceHistoryRow[];
  summary: AttendanceSummary;
  homework: HomeworkHistoryRow[];
  /** The account's internal note: it has no date, so it heads the timeline. */
  accountNote: string | null;
  notes: StaffNote[];
};

function range(start: string, end: string) {
  return start === end ? formatDateShort(start) : `${formatDateShort(start)} - ${formatDateShort(end)}`;
}

/**
 * Everything staff know about one student, for the admin profile's History
 * tab: every lesson they were on the roll for that has run (marked, moved, a
 * make-up, or still unmarked), every homework task, and every staff note.
 */
export async function getStudentHistory(
  studentId: string,
  now = new Date(),
): Promise<StudentHistory> {
  const today = melbourneDate(now);
  const noteTutor = alias(profiles, "history_note_tutor");

  const [marks, unmarked, tasks, notes, leave, trial, account] = await Promise.all([
    db
      .select({
        lessonId: lessons.id,
        date: lessons.date,
        startTime: lessons.startTime,
        className: classes.name,
        subjectName: subjects.name,
        status: attendanceStatusShownSql,
        moved: attendanceMovedSql,
        note: attendance.note,
      })
      .from(attendance)
      .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(eq(attendance.studentId, studentId)),
    // The same roll as the Attendance queue's "to mark": lessons that have
    // run of their classes they were on the roll for, and lessons they were
    // booked onto (make-ups), with no mark for them.
    db
      .select({
        lessonId: lessons.id,
        date: lessons.date,
        startTime: lessons.startTime,
        className: classes.name,
        subjectName: subjects.name,
      })
      .from(lessons)
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(
          lessonRanSql(now),
          or(studentOnClassRosterSql(studentId), studentBookedOnLessonSql(studentId)),
          sql`not exists (select 1 from ${attendance} a where a.lesson_id = ${lessons.id} and a.student_id = ${studentId})`,
        ),
      ),
    db
      .select({
        homeworkId: homework.id,
        title: homework.title,
        dueDate: homework.dueDate,
        className: classes.name,
        subjectName: subjects.name,
        status: homeworkAssignments.status,
        score: homeworkAssignments.score,
      })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .leftJoin(classes, eq(classes.id, homework.classId))
      .leftJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(eq(homeworkAssignments.studentId, studentId)),
    db
      .select({
        lessonId: lessonNotes.lessonId,
        date: lessons.date,
        className: classes.name,
        subjectName: subjects.name,
        tutorFirst: noteTutor.firstName,
        tutorLast: noteTutor.lastName,
        text: lessonNotes.internalNote,
      })
      .from(lessonNotes)
      .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .innerJoin(noteTutor, eq(noteTutor.id, lessonNotes.tutorId))
      .where(
        and(
          eq(lessonNotes.studentId, studentId),
          sql`length(trim(coalesce(${lessonNotes.internalNote}, ''))) > 0`,
        ),
      ),
    db
      .select({
        id: studentLeave.id,
        startDate: studentLeave.startDate,
        endDate: studentLeave.endDate,
        note: studentLeave.note,
      })
      .from(studentLeave)
      .where(eq(studentLeave.studentId, studentId)),
    db
      .select({
        startDate: studentTrials.startDate,
        endDate: studentTrials.endDate,
        note: studentTrials.note,
      })
      .from(studentTrials)
      .where(eq(studentTrials.studentId, studentId))
      .limit(1),
    db
      .select({ note: profiles.adminNotes })
      .from(profiles)
      .where(eq(profiles.id, studentId))
      .limit(1),
  ]);

  // Lessons Taiyo cancelled that they were booked on: each gave them a credit.
  const cancelledLessons = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(classCredits)
    .innerJoin(lessons, eq(lessons.id, classCredits.grantedFromLessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(and(eq(classCredits.studentId, studentId), eq(classCredits.grantReason, "lesson_cancelled")));

  const { rows, summary } = attendanceHistory([
    ...cancelledLessons.map((c) => ({
      lessonId: c.lessonId,
      date: c.date,
      startTime: c.startTime,
      className: classDisplayName(c.subjectName, c.className),
      status: null,
      moved: false,
      cancelled: true,
    })),
    ...marks.map((m) => ({
      lessonId: m.lessonId,
      date: m.date,
      startTime: m.startTime,
      className: classDisplayName(m.subjectName, m.className),
      status: m.status,
      moved: Boolean(m.moved),
    })),
    ...unmarked.map((u) => ({
      lessonId: u.lessonId,
      date: u.date,
      startTime: u.startTime,
      className: classDisplayName(u.subjectName, u.className),
      status: null,
      moved: false,
    })),
  ]);

  return {
    attendance: rows,
    summary,
    homework: homeworkHistory(
      tasks.map((t) => ({
        homeworkId: t.homeworkId,
        title: t.title,
        className:
          t.className && t.subjectName ? classDisplayName(t.subjectName, t.className) : null,
        dueDate: melbourneDate(t.dueDate),
        status: t.status,
        score: t.score,
      })),
      today,
    ),
    accountNote: account[0]?.note?.trim() || null,
    notes: staffNotesTimeline({
      lessonNotes: notes.map((n) => ({
        lessonId: n.lessonId,
        date: n.date,
        className: classDisplayName(n.subjectName, n.className),
        tutorName: `${n.tutorFirst} ${n.tutorLast}`.trim(),
        text: n.text,
      })),
      rollNotes: marks.map((m) => ({
        lessonId: m.lessonId,
        date: m.date,
        className: classDisplayName(m.subjectName, m.className),
        text: m.note,
      })),
      leave,
      trial: trial[0] ?? null,
      formatRange: range,
    }),
  };
}
