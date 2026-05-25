import "server-only";
import { notFound } from "next/navigation";
import { and, eq, inArray, sql, desc, isNull, asc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  lessons,
  lessonNotes,
  attendance,
  homework,
  homeworkAssignments,
  profiles,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";

export async function requireTutor() {
  const user = await requireRole("tutor");
  return { id: user.id, email: user.email ?? "" };
}

function todayDateString() {
  // The rest of the codebase (seed, MiniWeekCalendar, shared isoDate) keys
  // dates as `local-midnight → toISOString`. In AEST this is "previous day in UTC".
  // Match that convention so date comparisons line up with stored lesson rows.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export async function getTodayLessons(tutorId: string) {
  return db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      location: lessons.location,
      onlineLink: lessons.onlineLink,
      className: classes.name,
      classId: classes.id,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .innerJoin(subjects, eq(classes.subjectId, subjects.id))
    .where(and(eq(lessons.tutorId, tutorId), eq(lessons.date, todayDateString())))
    .orderBy(asc(lessons.startTime));
}

export async function getTutorClasses(tutorId: string) {
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      capacity: classes.capacity,
      location: classes.location,
      onlineLink: classes.onlineLink,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
      subjectName: subjects.name,
      subjectYear: subjects.yearLevel,
      enrolledCount: sql<number>`count(distinct ${enrollments.studentId})::int`,
    })
    .from(classes)
    .innerJoin(subjects, eq(classes.subjectId, subjects.id))
    .leftJoin(
      enrollments,
      and(eq(enrollments.classId, classes.id), isNull(enrollments.withdrawnAt)),
    )
    .where(eq(classes.tutorId, tutorId))
    .groupBy(
      classes.id,
      classes.name,
      classes.capacity,
      classes.location,
      classes.onlineLink,
      classes.weekday,
      classes.startTime,
      classes.endTime,
      subjects.name,
      subjects.yearLevel,
    )
    .orderBy(asc(classes.name));
  return rows;
}

async function getTutorClassIds(tutorId: string): Promise<string[]> {
  const rows = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.tutorId, tutorId));
  return rows.map((r) => r.id);
}

export async function getTutorStudents(tutorId: string) {
  const classIds = await getTutorClassIds(tutorId);
  if (classIds.length === 0) return [];
  return db
    .selectDistinct({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      yearLevel: profiles.yearLevel,
      school: profiles.school,
    })
    .from(profiles)
    .innerJoin(enrollments, eq(enrollments.studentId, profiles.id))
    .where(
      and(
        inArray(enrollments.classId, classIds),
        isNull(enrollments.withdrawnAt),
        eq(profiles.role, "student"),
      ),
    )
    .orderBy(asc(profiles.lastName), asc(profiles.firstName));
}

export async function assertTutorTeachesStudent(
  tutorId: string,
  studentId: string,
) {
  const classIds = await getTutorClassIds(tutorId);
  if (classIds.length === 0) notFound();
  const [row] = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        inArray(enrollments.classId, classIds),
        eq(enrollments.studentId, studentId),
      ),
    )
    .limit(1);
  if (!row) notFound();
}

export async function getStudentProfile(tutorId: string, studentId: string) {
  await assertTutorTeachesStudent(tutorId, studentId);

  const [student] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, studentId), eq(profiles.role, "student")))
    .limit(1);
  if (!student) notFound();

  // Limit attendance/notes/homework to lessons/classes this tutor teaches —
  // a tutor shouldn't see what other tutors said about the student.
  const classIds = await getTutorClassIds(tutorId);

  const attendanceRows = await db
    .select({
      lessonId: attendance.lessonId,
      status: attendance.status,
      note: attendance.note,
      markedAt: attendance.markedAt,
      lessonDate: lessons.date,
      className: classes.name,
    })
    .from(attendance)
    .innerJoin(lessons, eq(attendance.lessonId, lessons.id))
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .where(
      and(
        eq(attendance.studentId, studentId),
        inArray(classes.id, classIds.length ? classIds : ["__none__"]),
      ),
    )
    .orderBy(desc(lessons.date));

  const notes = await db
    .select({
      id: lessonNotes.id,
      lessonId: lessonNotes.lessonId,
      topicCovered: lessonNotes.topicCovered,
      performance: lessonNotes.performance,
      strengths: lessonNotes.strengths,
      struggles: lessonNotes.struggles,
      nextLessonFocus: lessonNotes.nextLessonFocus,
      parentVisibleComment: lessonNotes.parentVisibleComment,
      internalNote: lessonNotes.internalNote,
      createdAt: lessonNotes.createdAt,
      lessonDate: lessons.date,
      className: classes.name,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessonNotes.lessonId, lessons.id))
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        eq(lessonNotes.tutorId, tutorId),
      ),
    )
    .orderBy(desc(lessonNotes.createdAt));

  const homeworkRows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
      submittedAt: homeworkAssignments.submittedAt,
      feedback: homeworkAssignments.feedback,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homeworkAssignments.homeworkId, homework.id))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(homework.tutorId, tutorId),
      ),
    )
    .orderBy(desc(homework.dueDate));

  return { student, attendance: attendanceRows, notes, homework: homeworkRows };
}

export async function getLessonForTutor(tutorId: string, lessonId: string) {
  const [lesson] = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      location: lessons.location,
      onlineLink: lessons.onlineLink,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .innerJoin(subjects, eq(classes.subjectId, subjects.id))
    .where(and(eq(lessons.id, lessonId), eq(lessons.tutorId, tutorId)))
    .limit(1);
  if (!lesson) notFound();

  const roster = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      yearLevel: profiles.yearLevel,
      attendanceStatus: attendance.status,
      attendanceNote: attendance.note,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .leftJoin(
      attendance,
      and(
        eq(attendance.lessonId, lesson.id),
        eq(attendance.studentId, profiles.id),
      ),
    )
    .where(
      and(
        eq(enrollments.classId, lesson.classId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .orderBy(asc(profiles.lastName));

  const existingNotes = await db
    .select()
    .from(lessonNotes)
    .where(
      and(eq(lessonNotes.lessonId, lessonId), eq(lessonNotes.tutorId, tutorId)),
    );

  return { lesson, roster, notes: existingNotes };
}

export async function getTutorHomework(tutorId: string) {
  const items = await db
    .select({
      id: homework.id,
      title: homework.title,
      description: homework.description,
      dueDate: homework.dueDate,
      createdAt: homework.createdAt,
      attachmentUrl: homework.attachmentUrl,
      className: classes.name,
      classId: classes.id,
    })
    .from(homework)
    .leftJoin(classes, eq(homework.classId, classes.id))
    .where(eq(homework.tutorId, tutorId))
    .orderBy(desc(homework.createdAt));

  if (items.length === 0) return [];

  const ids = items.map((i) => i.id);
  const counts = await db
    .select({
      homeworkId: homeworkAssignments.homeworkId,
      status: homeworkAssignments.status,
      total: sql<number>`count(*)::int`,
    })
    .from(homeworkAssignments)
    .where(inArray(homeworkAssignments.homeworkId, ids))
    .groupBy(homeworkAssignments.homeworkId, homeworkAssignments.status);

  return items.map((i) => {
    const rows = counts.filter((c) => c.homeworkId === i.id);
    const total = rows.reduce((a, r) => a + r.total, 0);
    const toMark = rows
      .filter((r) => r.status === "submitted" || r.status === "late")
      .reduce((a, r) => a + r.total, 0);
    const marked = rows
      .filter((r) => r.status === "marked" || r.status === "returned")
      .reduce((a, r) => a + r.total, 0);
    return { ...i, total, toMark, marked };
  });
}

export async function getHomeworkDetail(tutorId: string, homeworkId: string) {
  const [hw] = await db
    .select()
    .from(homework)
    .where(and(eq(homework.id, homeworkId), eq(homework.tutorId, tutorId)))
    .limit(1);
  if (!hw) notFound();

  const submissions = await db
    .select({
      studentId: homeworkAssignments.studentId,
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      submissionUrl: homeworkAssignments.submissionUrl,
      submissionText: homeworkAssignments.submissionText,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      markedAt: homeworkAssignments.markedAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      yearLevel: profiles.yearLevel,
    })
    .from(homeworkAssignments)
    .innerJoin(profiles, eq(profiles.id, homeworkAssignments.studentId))
    .where(eq(homeworkAssignments.homeworkId, homeworkId))
    .orderBy(asc(profiles.lastName));

  return { homework: hw, submissions };
}

export async function getPendingMarkCount(tutorId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(
      and(
        eq(homework.tutorId, tutorId),
        inArray(homeworkAssignments.status, ["submitted", "late"]),
      ),
    );
  return count ?? 0;
}

export async function getPendingNotesCount(tutorId: string) {
  // Lessons in the past where this tutor has not yet written any note.
  const today = todayDateString();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .leftJoin(
      lessonNotes,
      and(
        eq(lessonNotes.lessonId, lessons.id),
        eq(lessonNotes.tutorId, tutorId),
      ),
    )
    .where(
      and(
        eq(lessons.tutorId, tutorId),
        sql`${lessons.date} <= ${today}`,
        sql`${lessonNotes.id} is null`,
      ),
    );
  return count ?? 0;
}

export async function getTutorWeekLessons(
  tutorId: string,
  weekStart: Date,
  weekEnd: Date,
) {
  const start = weekStart.toISOString().slice(0, 10);
  const end = weekEnd.toISOString().slice(0, 10);
  return db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .innerJoin(subjects, eq(classes.subjectId, subjects.id))
    .where(
      and(
        eq(lessons.tutorId, tutorId),
        sql`${lessons.date} >= ${start}`,
        sql`${lessons.date} < ${end}`,
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));
}

export async function getSubmissionsToMark(tutorId: string, limit = 8) {
  return db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      studentId: homeworkAssignments.studentId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      className: classes.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .innerJoin(profiles, eq(profiles.id, homeworkAssignments.studentId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        eq(homework.tutorId, tutorId),
        inArray(homeworkAssignments.status, ["submitted", "late"]),
      ),
    )
    .orderBy(desc(homeworkAssignments.submittedAt))
    .limit(limit);
}

export async function getLessonsMissingNotes(tutorId: string, limit = 6) {
  // Lessons in the past 7 days, taught by this tutor, with no note row by this tutor.
  const today = todayDateString();
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const since = sevenAgo.toISOString().slice(0, 10);
  return db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .innerJoin(subjects, eq(classes.subjectId, subjects.id))
    .leftJoin(
      lessonNotes,
      and(
        eq(lessonNotes.lessonId, lessons.id),
        eq(lessonNotes.tutorId, tutorId),
      ),
    )
    .where(
      and(
        eq(lessons.tutorId, tutorId),
        sql`${lessons.date} <= ${today}`,
        sql`${lessons.date} >= ${since}`,
        sql`${lessonNotes.id} is null`,
      ),
    )
    .orderBy(desc(lessons.date), asc(lessons.startTime))
    .limit(limit);
}

export async function getTodayLessonCount(tutorId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .where(
      and(eq(lessons.tutorId, tutorId), eq(lessons.date, todayDateString())),
    );
  return count ?? 0;
}

export async function getRecentLessonNotes(tutorId: string, limit = 20) {
  return db
    .select({
      id: lessonNotes.id,
      createdAt: lessonNotes.createdAt,
      topicCovered: lessonNotes.topicCovered,
      parentVisibleComment: lessonNotes.parentVisibleComment,
      internalNote: lessonNotes.internalNote,
      lessonDate: lessons.date,
      className: classes.name,
      studentFirstName: profiles.firstName,
      studentLastName: profiles.lastName,
      studentId: lessonNotes.studentId,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessonNotes.lessonId, lessons.id))
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .innerJoin(profiles, eq(profiles.id, lessonNotes.studentId))
    .where(eq(lessonNotes.tutorId, tutorId))
    .orderBy(desc(lessonNotes.createdAt))
    .limit(limit);
}
