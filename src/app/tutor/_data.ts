import "server-only";
import { notFound } from "next/navigation";
import { and, eq, inArray, sql, desc, isNull, asc, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { attendanceMovedSql } from "@/lib/attendance-moved";
import { db } from "@/db/client";
import {
  announcements,
  classes,
  enrollments,
  lessons,
  lessonNotes,
  attendance,
  homework,
  homeworkAssignments,
  familyLinks,
  profiles,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getLatestQuizAttempts } from "@/lib/quiz-scores";
import { ADMIN_TIERS, STUDENT_TIERS } from "@/lib/roles";
import { yearLevelLabel } from "@/lib/format";
import { tutorHomeworkFilter } from "./_lib/homework-access";

const noteAuthor = alias(profiles, "note_author");

export async function requireTutor() {
  const user = await requireRole("tutor");
  return { id: user.id, email: user.email ?? "" };
}

/** Local calendar date `YYYY-MM-DD` - matches the local dates stored in the
 * `lessons.date` column. Using toISOString() would shift a day on AEST. */
function isoDateLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function getTutorClasses(tutorId: string) {
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      capacity: classes.capacity,
      location: classes.location,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
      subjectId: classes.subjectId,
      subjectName: subjects.name,
      subjectColor: subjects.color,
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
      classes.weekday,
      classes.startTime,
      classes.endTime,
      subjects.name,
      subjects.color,
      subjects.yearLevel,
    )
    .orderBy(asc(classes.name));
  return rows;
}

/**
 * A class's announcements (newest first) plus its active roster size, for the
 * announcements card on the class curriculum page. Verifies the tutor owns the
 * class (404 otherwise).
 */
export async function getClassAnnouncementsForTutor(
  tutorId: string,
  classId: string,
) {
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.tutorId, tutorId)))
    .limit(1);
  if (!cls) notFound();

  const [rows, [rosterRow]] = await Promise.all([
    db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        status: announcements.status,
        isUrgent: announcements.isUrgent,
        includeLinkedParents: announcements.includeLinkedParents,
        rejectedReason: announcements.rejectedReason,
        publishedAt: announcements.publishedAt,
      })
      .from(announcements)
      .where(eq(announcements.audienceClassId, classId))
      .orderBy(desc(announcements.publishedAt))
      .limit(20),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(
        and(eq(enrollments.classId, classId), isNull(enrollments.withdrawnAt)),
      ),
  ]);

  return { announcements: rows, rosterCount: rosterRow?.count ?? 0 };
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
    })
    .from(profiles)
    .innerJoin(enrollments, eq(enrollments.studentId, profiles.id))
    .where(
      and(
        inArray(enrollments.classId, classIds),
        isNull(enrollments.withdrawnAt),
        inArray(profiles.role, STUDENT_TIERS),
      ),
    )
    .orderBy(asc(profiles.lastName), asc(profiles.firstName));
}

export type TutorClassRoster = {
  classId: string;
  className: string;
  subjectName: string;
  weekday: number | null;
  startTime: string | null;
  students: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    yearLevel: string | null;
    profileAvatarKey: string | null;
  }>;
};

/**
 * The tutor's students grouped by the class they're in - the roster the way a
 * tutor thinks about it. A student enrolled in two of the tutor's classes
 * appears under each. Empty classes are still listed so the tutor sees every
 * class they teach.
 */
export async function getTutorStudentsByClass(
  tutorId: string,
): Promise<{ classes: TutorClassRoster[]; totalStudents: number }> {
  const rows = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      weekday: classes.weekday,
      startTime: classes.startTime,
      studentId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      yearLevel: profiles.yearLevel,
      profileAvatarKey: profiles.profileAvatarKey,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.classId, classes.id),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .leftJoin(
      profiles,
      and(
        eq(profiles.id, enrollments.studentId),
        inArray(profiles.role, STUDENT_TIERS),
      ),
    )
    .where(eq(classes.tutorId, tutorId))
    .orderBy(asc(classes.name), asc(profiles.lastName), asc(profiles.firstName));

  const byClass = new Map<string, TutorClassRoster>();
  const distinctStudents = new Set<string>();
  for (const r of rows) {
    let group = byClass.get(r.classId);
    if (!group) {
      group = {
        classId: r.classId,
        className: r.className,
        subjectName: r.subjectName,
        weekday: r.weekday,
        startTime: r.startTime,
        students: [],
      };
      byClass.set(r.classId, group);
    }
    if (r.studentId) {
      group.students.push({
        id: r.studentId,
        firstName: r.firstName ?? "",
        lastName: r.lastName ?? "",
        email: r.email ?? "",
        yearLevel: r.yearLevel,
        profileAvatarKey: r.profileAvatarKey,
      });
      distinctStudents.add(r.studentId);
    }
  }

  return {
    classes: Array.from(byClass.values()),
    totalStudents: distinctStudents.size,
  };
}

export type TutorDmContacts = {
  students: { id: string; name: string; meta?: string }[];
  parents: { id: string; name: string }[];
  admin: { id: string; name: string } | null;
};

/** Contacts a tutor can DM: their students, those students' parents, + admin. */
export async function getTutorDmContacts(
  tutorId: string,
): Promise<TutorDmContacts> {
  const studentRows = await getTutorStudents(tutorId);
  const students = studentRows.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`.trim(),
    meta: s.yearLevel ? yearLevelLabel(s.yearLevel) : undefined,
  }));

  const studentIds = studentRows.map((s) => s.id);
  let parents: { id: string; name: string }[] = [];
  if (studentIds.length > 0) {
    const prows = await db
      .selectDistinct({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(familyLinks)
      .innerJoin(profiles, eq(profiles.id, familyLinks.parentId))
      .where(inArray(familyLinks.studentId, studentIds));
    parents = prows
      .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const adminRows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(and(inArray(profiles.role, ADMIN_TIERS), eq(profiles.isActive, true)))
    .orderBy(asc(profiles.firstName))
    .limit(1);
  const admin = adminRows[0]
    ? {
        id: adminRows[0].id,
        name: `${adminRows[0].firstName} ${adminRows[0].lastName}`.trim(),
      }
    : null;

  return { students, parents, admin };
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
    // Keep private account fields (including the admin-only directory note)
    // out of the tutor data boundary even if this object is reused later.
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      yearLevel: profiles.yearLevel,
      profileAvatarKey: profiles.profileAvatarKey,
    })
    .from(profiles)
    .where(and(eq(profiles.id, studentId), inArray(profiles.role, STUDENT_TIERS)))
    .limit(1);
  if (!student) notFound();

  // Limit attendance/notes/homework to lessons/classes this tutor teaches -
  // a tutor shouldn't see what other tutors said about the student.
  const classIds = await getTutorClassIds(tutorId);

  const attendanceRows = await db
    .select({
      lessonId: attendance.lessonId,
      status: attendance.status,
      moved: attendanceMovedSql,
      note: attendance.note,
      markedAt: attendance.markedAt,
      lessonDate: lessons.date,
      lessonTutorId: lessons.tutorId,
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

  // Notes on the lessons of this tutor's classes, whoever wrote them (a
  // class taken over from another tutor keeps its history), plus the notes
  // this tutor wrote. Another tutor's internal note is not sent: the editor
  // promised its author "Only you and admin see this".
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
      internalNote: sql<string | null>`case when ${lessonNotes.tutorId} = ${tutorId} then ${lessonNotes.internalNote} end`,
      createdAt: lessonNotes.createdAt,
      authorId: lessonNotes.tutorId,
      authorFirstName: noteAuthor.firstName,
      authorLastName: noteAuthor.lastName,
      lessonDate: lessons.date,
      lessonTutorId: lessons.tutorId,
      className: classes.name,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessonNotes.lessonId, lessons.id))
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .innerJoin(noteAuthor, eq(noteAuthor.id, lessonNotes.tutorId))
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        or(
          inArray(classes.id, classIds.length ? classIds : ["__none__"]),
          eq(lessonNotes.tutorId, tutorId),
        ),
      ),
    )
    .orderBy(desc(lessons.date), desc(lessonNotes.createdAt));

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
        tutorHomeworkFilter(tutorId),
      ),
    )
    .orderBy(desc(homework.dueDate));

  // Quizzes count in the subjects this tutor teaches the student.
  const sharedSubjects = await db
    .selectDistinct({ id: classes.subjectId })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(classes.tutorId, tutorId),
        isNull(enrollments.withdrawnAt),
      ),
    );
  const quizAttempts = await getLatestQuizAttempts(
    studentId,
    sharedSubjects.map((r) => r.id),
  );

  return { student, attendance: attendanceRows, notes, homework: homeworkRows, quizAttempts };
}

export async function getLessonForTutor(tutorId: string, lessonId: string) {
  const [lesson] = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      // A make-up lesson has no room of its own: it is taught in the class's.
      location: sql<string | null>`coalesce(nullif(trim(${lessons.location}), ''), nullif(trim(${classes.location}), ''))`,
      recordingUrl: lessons.recordingUrl,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      subjectColor: subjects.color,
    })
    .from(lessons)
    .innerJoin(classes, eq(lessons.classId, classes.id))
    .innerJoin(subjects, eq(classes.subjectId, subjects.id))
    .where(and(eq(lessons.id, lessonId), eq(lessons.tutorId, tutorId)))
    .limit(1);
  if (!lesson) notFound();

  const existingNotes = await db
    .select()
    .from(lessonNotes)
    .where(
      and(eq(lessonNotes.lessonId, lessonId), eq(lessonNotes.tutorId, tutorId)),
    );

  return { lesson, notes: existingNotes };
}

export async function getHomeworkDetail(tutorId: string, homeworkId: string) {
  const [hw] = await db
    .select()
    .from(homework)
    .where(and(eq(homework.id, homeworkId), tutorHomeworkFilter(tutorId)))
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
        tutorHomeworkFilter(tutorId),
        inArray(homeworkAssignments.status, ["submitted", "late"]),
      ),
    );
  return count ?? 0;
}

export async function getTutorWeekLessons(
  tutorId: string,
  weekStart: Date,
  weekEnd: Date,
) {
  const start = isoDateLocal(weekStart);
  const end = isoDateLocal(weekEnd);
  return db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      subjectColor: subjects.color,
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
