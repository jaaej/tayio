import "server-only";

import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  attendance,
  classCredits,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  lessonNotes,
  lessons,
  profiles,
  subjects,
} from "@/db/schema";
import { tutorHomeworkFilter } from "@/app/tutor/_lib/homework-access";
import { attendanceMovedSql, attendanceStatusShownSql } from "@/lib/attendance-moved";
import { studentBookedOnLessonSql, studentOnClassRosterSql } from "@/lib/class-roster-sql";
import { classDisplayName } from "@/lib/class-display";
import { lessonRanSql } from "@/lib/lesson-progress-sql";
import { getLatestQuizAttempts } from "@/lib/quiz-scores";
import {
  homeworkHistory,
  keyNumbers,
  lessonTimeline,
  type HomeworkHistoryRow,
  type HomeworkTask,
  type KeyNumber,
  type LessonTimelineEntry,
} from "@/lib/student-history";
import { melbourneDate } from "@/lib/tutor-cover-rules";

/**
 * Whose view of the record: an admin sees everything; a tutor sees the
 * lessons, notes, homework and quizzes of the classes they teach, plus the
 * notes they wrote. Another tutor's internal note never reaches a tutor:
 * the editor promised its author "Only you and admin see this".
 */
export type RecordScope = { kind: "admin" } | { kind: "tutor"; tutorId: string };

export type RecordNote = {
  id: string;
  authorId: string;
  authorName: string;
  topicCovered: string | null;
  performance: string | null;
  strengths: string | null;
  struggles: string | null;
  nextLessonFocus: string | null;
  parentVisibleComment: string | null;
  /** Null when empty, or when the viewer may not read it. */
  internalNote: string | null;
};

export type RecordHomework = HomeworkHistoryRow<
  HomeworkTask & {
    submittedAt: Date | null;
    submissionUrl: string | null;
    submissionText: string | null;
    feedback: string | null;
  }
>;

export type StudentRecord = {
  timeline: LessonTimelineEntry<RecordNote>[];
  homework: RecordHomework[];
  keyNumbers: KeyNumber[];
};

/**
 * One student's record for staff: every lesson they were on that has run
 * (marked, moved, a make-up, cancelled by Taiyo, or still unmarked) with
 * its roll note and lesson notes, every homework task with the hand-in and
 * feedback, and the four key numbers, all limited to `scope`. A tutor's
 * caller must check `assertTutorTeachesStudent` first.
 */
export async function getStudentRecord(
  studentId: string,
  scope: RecordScope,
  now = new Date(),
): Promise<StudentRecord> {
  const today = melbourneDate(now);
  const tutorId = scope.kind === "tutor" ? scope.tutorId : null;
  // Lessons and quizzes of the classes this tutor teaches; everything for an admin.
  const inScope = (extra: SQL | undefined) =>
    tutorId ? and(extra, eq(classes.tutorId, tutorId)) : extra;
  const noteAuthor = alias(profiles, "record_note_author");

  const [marks, unmarked, cancelled, notes, tasks, quizSubjects] = await Promise.all([
    db
      .select({
        lessonId: lessons.id,
        date: lessons.date,
        startTime: lessons.startTime,
        className: classes.name,
        subjectName: subjects.name,
        tutorId: lessons.tutorId,
        status: attendanceStatusShownSql,
        moved: attendanceMovedSql,
        note: attendance.note,
      })
      .from(attendance)
      .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(inScope(eq(attendance.studentId, studentId))),
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
        tutorId: lessons.tutorId,
      })
      .from(lessons)
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        inScope(
          and(
            lessonRanSql(now),
            or(studentOnClassRosterSql(studentId), studentBookedOnLessonSql(studentId)),
            sql`not exists (select 1 from ${attendance} a where a.lesson_id = ${lessons.id} and a.student_id = ${studentId})`,
          ),
        ),
      ),
    // Lessons Taiyo cancelled that they were booked on: each gave them a credit.
    db
      .select({
        lessonId: lessons.id,
        date: lessons.date,
        startTime: lessons.startTime,
        className: classes.name,
        subjectName: subjects.name,
        tutorId: lessons.tutorId,
      })
      .from(classCredits)
      .innerJoin(lessons, eq(lessons.id, classCredits.grantedFromLessonId))
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        inScope(and(eq(classCredits.studentId, studentId), eq(classCredits.grantReason, "lesson_cancelled"))),
      ),
    // A tutor also sees the notes they wrote on a class they no longer teach.
    db
      .select({
        id: lessonNotes.id,
        lessonId: lessonNotes.lessonId,
        date: lessons.date,
        startTime: lessons.startTime,
        className: classes.name,
        subjectName: subjects.name,
        tutorId: lessons.tutorId,
        authorId: lessonNotes.tutorId,
        authorFirst: noteAuthor.firstName,
        authorLast: noteAuthor.lastName,
        topicCovered: lessonNotes.topicCovered,
        performance: lessonNotes.performance,
        strengths: lessonNotes.strengths,
        struggles: lessonNotes.struggles,
        nextLessonFocus: lessonNotes.nextLessonFocus,
        parentVisibleComment: lessonNotes.parentVisibleComment,
        internalNote: tutorId
          ? sql<string | null>`case when ${lessonNotes.tutorId} = ${tutorId} then ${lessonNotes.internalNote} end`
          : lessonNotes.internalNote,
      })
      .from(lessonNotes)
      .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .innerJoin(noteAuthor, eq(noteAuthor.id, lessonNotes.tutorId))
      .where(
        and(
          eq(lessonNotes.studentId, studentId),
          tutorId ? or(eq(classes.tutorId, tutorId), eq(lessonNotes.tutorId, tutorId)) : undefined,
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
        submittedAt: homeworkAssignments.submittedAt,
        submissionUrl: homeworkAssignments.submissionUrl,
        submissionText: homeworkAssignments.submissionText,
        feedback: homeworkAssignments.feedback,
      })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .leftJoin(classes, eq(classes.id, homework.classId))
      .leftJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(
          eq(homeworkAssignments.studentId, studentId),
          tutorId ? tutorHomeworkFilter(tutorId) : undefined,
        ),
      ),
    // Quizzes count in the subjects of their current classes (the tutor's).
    db
      .selectDistinct({ id: classes.subjectId })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(inScope(and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)))),
  ]);

  const quizAttempts = await getLatestQuizAttempts(
    studentId,
    quizSubjects.map((r) => r.id),
  );

  // A student can be in two of a tutor's subjects, so each row's class
  // label names its subject ("Y7 Mathematics · Tuesday").
  const lessonOf = (r: (typeof unmarked)[number]) => ({
    lessonId: r.lessonId,
    date: r.date,
    startTime: r.startTime,
    className: classDisplayName(r.subjectName, r.className),
    tutorId: r.tutorId,
  });

  const timeline = lessonTimeline<RecordNote>(
    [
      ...unmarked.map((u) => ({ ...lessonOf(u), status: null, moved: false, rollNote: null })),
      ...cancelled.map((c) => ({ ...lessonOf(c), status: null, moved: false, cancelled: true, rollNote: null })),
      ...marks.map((m) => ({
        ...lessonOf(m),
        status: m.status,
        moved: Boolean(m.moved),
        rollNote: m.note?.trim() || null,
      })),
    ],
    notes.map((n) => ({
      lesson: lessonOf(n),
      note: {
        id: n.id,
        authorId: n.authorId,
        authorName: `${n.authorFirst} ${n.authorLast}`.trim(),
        topicCovered: n.topicCovered,
        performance: n.performance,
        strengths: n.strengths,
        struggles: n.struggles,
        nextLessonFocus: n.nextLessonFocus,
        parentVisibleComment: n.parentVisibleComment,
        internalNote: n.internalNote?.trim() || null,
      },
    })),
  );

  const homeworkRows = homeworkHistory(
    tasks.map((t) => ({
      homeworkId: t.homeworkId,
      title: t.title,
      className: t.className && t.subjectName ? classDisplayName(t.subjectName, t.className) : null,
      dueDate: melbourneDate(t.dueDate),
      status: t.status,
      score: t.score,
      submittedAt: t.submittedAt,
      submissionUrl: t.submissionUrl,
      submissionText: t.submissionText,
      feedback: t.feedback,
    })),
    today,
  );

  return {
    timeline,
    homework: homeworkRows,
    keyNumbers: keyNumbers({
      timeline,
      homework: homeworkRows,
      quizAttempts,
      noteDates: notes.map((n) => n.date),
      today,
    }),
  };
}
