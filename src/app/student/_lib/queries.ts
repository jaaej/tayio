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
  progressTopics,
  subjects,
} from "@/db/schema";

export type SubjectSummary = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  yearLevel: string | null;
  tutorFirstName: string;
  tutorLastName: string;
  nextLessonDate: string | null;
  dueHomeworkCount: number;
  masteryPercent: number; // 0..100
};

const MASTERY_PERCENT = {
  not_started: 0,
  needs_work: 30,
  improving: 65,
  strong: 92,
} as const;

export async function getStudentSubjects(studentId: string): Promise<SubjectSummary[]> {
  // Base list — enrolled classes with subject + tutor
  const enrolled = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      yearLevel: subjects.yearLevel,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(
      and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)),
    )
    .orderBy(asc(subjects.name));

  if (enrolled.length === 0) return [];

  const classIds = enrolled.map((e) => e.classId);
  const subjectIds = enrolled.map((e) => e.subjectId);
  const today = new Date().toISOString().slice(0, 10);

  // Next upcoming lesson per class
  const nextLessons = await db
    .select({
      classId: lessons.classId,
      date: sql<string>`min(${lessons.date})`,
    })
    .from(lessons)
    .where(
      and(
        inArray(lessons.classId, classIds),
        gte(lessons.date, today),
        eq(lessons.status, "upcoming"),
      ),
    )
    .groupBy(lessons.classId);
  const nextLessonByClass = new Map(nextLessons.map((r) => [r.classId, r.date]));

  // Due homework count per class
  const dueByClass = await db
    .select({
      classId: homework.classId,
      count: sql<number>`count(*)::int`,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
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
    .groupBy(homework.classId);
  const dueByClassMap = new Map(
    dueByClass.filter((r) => r.classId).map((r) => [r.classId!, r.count]),
  );

  // Mastery percent per subject (averaged across topics)
  const mastery = await db
    .select({
      subjectId: progressTopics.subjectId,
      mastery: progressTopics.mastery,
    })
    .from(progressTopics)
    .where(
      and(
        eq(progressTopics.studentId, studentId),
        inArray(progressTopics.subjectId, subjectIds),
      ),
    );
  const masteryBySubject = new Map<string, { sum: number; count: number }>();
  for (const row of mastery) {
    const cur = masteryBySubject.get(row.subjectId) ?? { sum: 0, count: 0 };
    cur.sum += MASTERY_PERCENT[row.mastery];
    cur.count += 1;
    masteryBySubject.set(row.subjectId, cur);
  }

  return enrolled.map((e) => {
    const m = masteryBySubject.get(e.subjectId);
    return {
      ...e,
      nextLessonDate: nextLessonByClass.get(e.classId) ?? null,
      dueHomeworkCount: dueByClassMap.get(e.classId) ?? 0,
      masteryPercent: m && m.count > 0 ? Math.round(m.sum / m.count) : 0,
    };
  });
}

export type SubjectDetail = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  yearLevel: string | null;
  tutorFirstName: string;
  tutorLastName: string;
  location: string | null;
  onlineLink: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  masteryPercent: number;
  topics: Array<{
    topic: string;
    mastery: "not_started" | "needs_work" | "improving" | "strong";
  }>;
  lessons: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: (typeof lessons.$inferSelect)["status"];
    hasNote: boolean;
  }>;
  homework: Array<{
    homeworkId: string;
    title: string;
    dueDate: Date;
    status: (typeof homeworkAssignments.$inferSelect)["status"];
    score: string | null;
  }>;
};

export async function getSubjectDetail(
  studentId: string,
  classId: string,
): Promise<SubjectDetail | null> {
  // Verify enrolment
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  if (!enrolledClassIds.includes(classId)) return null;

  const [row] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      yearLevel: subjects.yearLevel,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
      location: classes.location,
      onlineLink: classes.onlineLink,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(eq(classes.id, classId))
    .limit(1);
  if (!row) return null;

  const topics = await db
    .select({
      topic: progressTopics.topic,
      mastery: progressTopics.mastery,
    })
    .from(progressTopics)
    .where(
      and(
        eq(progressTopics.studentId, studentId),
        eq(progressTopics.subjectId, row.subjectId),
      ),
    )
    .orderBy(asc(progressTopics.topic));

  const masterySum = topics.reduce(
    (acc, t) => acc + MASTERY_PERCENT[t.mastery],
    0,
  );
  const masteryPercent =
    topics.length > 0 ? Math.round(masterySum / topics.length) : 0;

  const lessonRows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      noteId: lessonNotes.id,
    })
    .from(lessons)
    .leftJoin(
      lessonNotes,
      and(
        eq(lessonNotes.lessonId, lessons.id),
        eq(lessonNotes.studentId, studentId),
      ),
    )
    .where(eq(lessons.classId, classId))
    .orderBy(desc(lessons.date), desc(lessons.startTime))
    .limit(20);

  const homeworkRows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(homework.classId, classId),
      ),
    )
    .orderBy(desc(homework.dueDate))
    .limit(20);

  return {
    ...row,
    masteryPercent,
    topics,
    lessons: lessonRows.map(({ noteId, ...l }) => ({
      ...l,
      hasNote: noteId !== null,
    })),
    homework: homeworkRows,
  };
}

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
