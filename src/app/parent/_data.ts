import "server-only";
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  familyLinks,
  homework,
  homeworkAssignments,
  invoices,
  lessonNotes,
  lessons,
  profiles,
  subjects,
} from "@/db/schema";

export type ParentChild = {
  id: string;
  firstName: string;
  lastName: string;
  yearLevel: string | null;
  relationship: string;
};

export async function getParentChildren(parentId: string): Promise<ParentChild[]> {
  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      yearLevel: profiles.yearLevel,
      relationship: familyLinks.relationship,
    })
    .from(familyLinks)
    .innerJoin(profiles, eq(profiles.id, familyLinks.studentId))
    .where(eq(familyLinks.parentId, parentId))
    .orderBy(profiles.firstName);
  return rows;
}

export async function resolveSelectedChild(
  parentId: string,
  requested: string | undefined,
): Promise<{ children: ParentChild[]; selected: ParentChild | null }> {
  const children = await getParentChildren(parentId);
  if (children.length === 0) return { children, selected: null };
  const match = requested
    ? children.find((c) => c.id === requested) ?? children[0]
    : children[0];
  return { children, selected: match };
}

export type DashboardData = {
  attendanceRate: number | null;
  attendanceCount: number;
  homeworkCompleted: number;
  homeworkTotal: number;
  nextLesson: {
    date: string;
    startTime: string;
    subjectName: string;
    tutorName: string;
  } | null;
  latestFeedback: {
    createdAt: Date;
    parentVisibleComment: string;
    subjectName: string | null;
    tutorName: string;
  } | null;
};

export async function getDashboardData(studentId: string): Promise<DashboardData> {
  const attendanceRows = await db
    .select({ status: attendance.status })
    .from(attendance)
    .where(eq(attendance.studentId, studentId));
  const attendanceCount = attendanceRows.length;
  const presentLike = attendanceRows.filter(
    (r) => r.status === "present" || r.status === "late" || r.status === "makeup_attended",
  ).length;
  const attendanceRate =
    attendanceCount > 0 ? Math.round((presentLike / attendanceCount) * 100) : null;

  const homeworkRows = await db
    .select({ status: homeworkAssignments.status })
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.studentId, studentId));
  const homeworkTotal = homeworkRows.length;
  const homeworkCompleted = homeworkRows.filter(
    (r) => r.status === "submitted" || r.status === "marked" || r.status === "returned",
  ).length;

  const tutorProfile = profiles;
  const today = new Date().toISOString().slice(0, 10);
  const nextLessonRows = await db
    .select({
      date: lessons.date,
      startTime: lessons.startTime,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
    })
    .from(enrollments)
    .innerJoin(lessons, eq(lessons.classId, enrollments.classId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessons.tutorId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        gte(lessons.date, today),
        or(eq(lessons.status, "upcoming"), eq(lessons.status, "rescheduled")),
      ),
    )
    .orderBy(lessons.date, lessons.startTime)
    .limit(1);

  const nextLesson = nextLessonRows[0]
    ? {
        date: nextLessonRows[0].date,
        startTime: nextLessonRows[0].startTime,
        subjectName: nextLessonRows[0].subjectName,
        tutorName: `${nextLessonRows[0].tutorFirst} ${nextLessonRows[0].tutorLast}`.trim(),
      }
    : null;

  const noteRows = await db
    .select({
      createdAt: lessonNotes.createdAt,
      parentVisibleComment: lessonNotes.parentVisibleComment,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessonNotes.tutorId))
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        sql`${lessonNotes.parentVisibleComment} IS NOT NULL AND length(${lessonNotes.parentVisibleComment}) > 0`,
      ),
    )
    .orderBy(desc(lessonNotes.createdAt))
    .limit(1);

  const latestFeedback = noteRows[0]
    ? {
        createdAt: noteRows[0].createdAt,
        parentVisibleComment: noteRows[0].parentVisibleComment!,
        subjectName: noteRows[0].subjectName,
        tutorName: `${noteRows[0].tutorFirst} ${noteRows[0].tutorLast}`.trim(),
      }
    : null;

  return {
    attendanceRate,
    attendanceCount,
    homeworkCompleted,
    homeworkTotal,
    nextLesson,
    latestFeedback,
  };
}

export async function getOutstandingBalanceForParent(parentId: string): Promise<number> {
  const rows = await db
    .select({ amount: invoices.amount, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.parentId, parentId));
  return rows
    .filter((r) => r.status === "unpaid" || r.status === "overdue" || r.status === "partially_paid")
    .reduce((sum, r) => sum + Number(r.amount), 0);
}

export type AttendanceRow = {
  lessonId: string;
  date: string;
  startTime: string;
  subjectName: string | null;
  tutorName: string;
  status: typeof attendance.status.enumValues[number];
  note: string | null;
};

export async function getAttendance(studentId: string): Promise<AttendanceRow[]> {
  const tutorProfile = profiles;
  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
      status: attendance.status,
      note: attendance.note,
    })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessons.tutorId))
    .where(eq(attendance.studentId, studentId))
    .orderBy(desc(lessons.date), desc(lessons.startTime));

  return rows.map((r) => ({
    lessonId: r.lessonId,
    date: r.date,
    startTime: r.startTime,
    subjectName: r.subjectName,
    tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
    status: r.status,
    note: r.note,
  }));
}

export type HomeworkRow = {
  homeworkId: string;
  title: string;
  subjectName: string | null;
  dueDate: Date;
  status: typeof homeworkAssignments.status.enumValues[number];
  score: string | null;
  feedback: string | null;
  submittedAt: Date | null;
};

export async function getHomework(studentId: string): Promise<HomeworkRow[]> {
  const rows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      subjectName: subjects.name,
      dueDate: homework.dueDate,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      submittedAt: homeworkAssignments.submittedAt,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(homeworkAssignments.studentId, studentId))
    .orderBy(desc(homework.dueDate));

  return rows;
}

export type FeedbackRow = {
  id: string;
  createdAt: Date;
  lessonDate: string;
  subjectName: string | null;
  tutorName: string;
  topicCovered: string | null;
  parentVisibleComment: string;
};

export async function getFeedback(studentId: string): Promise<FeedbackRow[]> {
  const tutorProfile = profiles;
  const rows = await db
    .select({
      id: lessonNotes.id,
      createdAt: lessonNotes.createdAt,
      lessonDate: lessons.date,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
      topicCovered: lessonNotes.topicCovered,
      parentVisibleComment: lessonNotes.parentVisibleComment,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessonNotes.tutorId))
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        sql`${lessonNotes.parentVisibleComment} IS NOT NULL AND length(${lessonNotes.parentVisibleComment}) > 0`,
      ),
    )
    .orderBy(desc(lessonNotes.createdAt));

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    lessonDate: r.lessonDate,
    subjectName: r.subjectName,
    tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
    topicCovered: r.topicCovered,
    parentVisibleComment: r.parentVisibleComment!,
  }));
}
