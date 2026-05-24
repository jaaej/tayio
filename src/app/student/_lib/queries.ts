import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  lessonNotes,
  lessons,
  profiles,
  subjects,
} from "@/db/schema";

export async function getEnrolledClassIds(studentId: string) {
  const rows = await db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(
      and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)),
    );
  return rows.map((r) => r.classId);
}

export type LessonRow = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  location: string | null;
  onlineLink: string | null;
  className: string;
  subjectName: string;
  tutorFirstName: string;
  tutorLastName: string;
};

export async function getStudentLessons(
  studentId: string,
  opts: { from?: Date; limit?: number } = {},
): Promise<LessonRow[]> {
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  if (enrolledClassIds.length === 0) return [];

  const conditions = [inArray(lessons.classId, enrolledClassIds)];
  if (opts.from) {
    conditions.push(gte(lessons.date, opts.from.toISOString().slice(0, 10)));
  }

  const query = db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      location: lessons.location,
      onlineLink: lessons.onlineLink,
      className: classes.name,
      subjectName: subjects.name,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(and(...conditions))
    .orderBy(asc(lessons.date), asc(lessons.startTime));

  const rows = opts.limit ? await query.limit(opts.limit) : await query;
  return rows;
}

export async function getNextLesson(studentId: string): Promise<LessonRow | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = await getStudentLessons(studentId, { from: today, limit: 1 });
  return rows[0] ?? null;
}

export type HomeworkRow = {
  homeworkId: string;
  title: string;
  description: string | null;
  attachmentUrl: string | null;
  dueDate: Date;
  allowResubmission: boolean;
  status: (typeof homeworkAssignments.$inferSelect)["status"];
  submittedAt: Date | null;
  submissionUrl: string | null;
  submissionText: string | null;
  score: string | null;
  feedback: string | null;
  className: string | null;
};

export async function getStudentHomework(studentId: string): Promise<HomeworkRow[]> {
  return db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      description: homework.description,
      attachmentUrl: homework.attachmentUrl,
      dueDate: homework.dueDate,
      allowResubmission: homework.allowResubmission,
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      submissionUrl: homeworkAssignments.submissionUrl,
      submissionText: homeworkAssignments.submissionText,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      className: classes.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .where(eq(homeworkAssignments.studentId, studentId))
    .orderBy(asc(homework.dueDate));
}

export async function getHomeworkDetail(studentId: string, homeworkId: string) {
  const rows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      description: homework.description,
      attachmentUrl: homework.attachmentUrl,
      dueDate: homework.dueDate,
      allowResubmission: homework.allowResubmission,
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      submissionUrl: homeworkAssignments.submissionUrl,
      submissionText: homeworkAssignments.submissionText,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      className: classes.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(homeworkAssignments.homeworkId, homeworkId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getDueHomeworkCount(studentId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(homeworkAssignments)
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        or(
          eq(homeworkAssignments.status, "not_started"),
          eq(homeworkAssignments.status, "viewed"),
          eq(homeworkAssignments.status, "resubmission_requested"),
        )!,
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function getNextDueHomework(studentId: string): Promise<HomeworkRow | null> {
  const rows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      description: homework.description,
      attachmentUrl: homework.attachmentUrl,
      dueDate: homework.dueDate,
      allowResubmission: homework.allowResubmission,
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      submissionUrl: homeworkAssignments.submissionUrl,
      submissionText: homeworkAssignments.submissionText,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      className: classes.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        or(
          eq(homeworkAssignments.status, "not_started"),
          eq(homeworkAssignments.status, "viewed"),
          eq(homeworkAssignments.status, "resubmission_requested"),
        )!,
      ),
    )
    .orderBy(asc(homework.dueDate))
    .limit(1);
  return rows[0] ?? null;
}

export type LessonRecap = {
  lessonId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  className: string;
  subjectName: string;
  tutorFirstName: string;
  tutorLastName: string;
  topicCovered: string | null;
  keyConcepts: string | null;
  performance: string | null;
  strengths: string | null;
  struggles: string | null;
  nextLessonFocus: string | null;
  parentVisibleComment: string | null;
  // internalNote intentionally excluded — never expose to students.
};

export async function getLessonRecap(
  studentId: string,
  lessonId: string,
): Promise<LessonRecap | null> {
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  if (enrolledClassIds.length === 0) return null;

  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
      topicCovered: lessonNotes.topicCovered,
      keyConcepts: lessonNotes.keyConcepts,
      performance: lessonNotes.performance,
      strengths: lessonNotes.strengths,
      struggles: lessonNotes.struggles,
      nextLessonFocus: lessonNotes.nextLessonFocus,
      parentVisibleComment: lessonNotes.parentVisibleComment,
      classId: lessons.classId,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .leftJoin(
      lessonNotes,
      and(
        eq(lessonNotes.lessonId, lessons.id),
        eq(lessonNotes.studentId, studentId),
      ),
    )
    .where(eq(lessons.id, lessonId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!enrolledClassIds.includes(row.classId)) return null;
  const { classId: _classId, ...recap } = row;
  return recap;
}

export type LessonWithNoteListItem = {
  lessonId: string;
  date: string;
  startTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  className: string;
  subjectName: string;
  hasNote: boolean;
};

export async function getStudentLessonsWithNotes(
  studentId: string,
): Promise<LessonWithNoteListItem[]> {
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  if (enrolledClassIds.length === 0) return [];

  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      noteId: lessonNotes.id,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(
      lessonNotes,
      and(
        eq(lessonNotes.lessonId, lessons.id),
        eq(lessonNotes.studentId, studentId),
      ),
    )
    .where(inArray(lessons.classId, enrolledClassIds))
    .orderBy(desc(lessons.date), desc(lessons.startTime))
    .limit(30);

  return rows.map(({ noteId, ...r }) => ({ ...r, hasNote: noteId !== null }));
}
