import "server-only";
import { and, between, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  lessonNotes,
  lessons,
  profiles,
  quizAttempts,
  quizzes,
  subjectWeeks,
  subjects,
  terms,
} from "@/db/schema";
import { average, combineGrade, type ReportGrade } from "@/lib/report-grade";

export type SubjectReport = {
  subjectId: string;
  subjectName: string;
  grade: ReportGrade | null;
  quizCount: number;
  testCount: number;
};

export type StudentTermReport = {
  student: { id: string; firstName: string; lastName: string; yearLevel: string | null };
  term: { id: string; year: number; termNumber: number; startDate: string; endDate: string };
  attendance: { present: number; total: number; percent: number | null };
  overall: ReportGrade | null;
  subjects: SubjectReport[];
  comments: Array<{ date: string; subjectName: string | null; comment: string }>;
};

/** Test scores (homeworkAssignments.score) are entered by tutors as a
 *  percentage (0-100); there is no per-test max column to normalise against. */
function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Assemble a student's term report: attendance, per-subject quiz + test grades
 * (equal-weight combined into a letter), an overall grade, and the tutor's
 * parent-visible comments for the term. Returns null if the student or term
 * doesn't exist. Caller is responsible for authorisation.
 */
export async function getStudentTermReport(
  studentId: string,
  termId: string,
): Promise<StudentTermReport | null> {
  const [student] = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      yearLevel: profiles.yearLevel,
    })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);
  if (!student) return null;

  const [term] = await db
    .select({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .where(eq(terms.id, termId))
    .limit(1);
  if (!term) return null;

  const start = term.startDate;
  const end = term.endDate;
  // homework.dueDate is a timestamp (Date), so it needs Date bounds rather than
  // the YYYY-MM-DD strings used for the `date`-typed lessons.date column.
  const startDt = new Date(`${start}T00:00:00`);
  const endExclusiveDt = new Date(`${end}T00:00:00`);
  endExclusiveDt.setDate(endExclusiveDt.getDate() + 1);

  // Enrolled subjects (the report's rows).
  const enrolledSubjects = await db
    .selectDistinct({ subjectId: subjects.id, subjectName: subjects.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(enrollments.studentId, studentId));

  // Attendance across the term.
  const attnRows = await db
    .select({ status: attendance.status })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .where(
      and(
        eq(attendance.studentId, studentId),
        between(lessons.date, start, end),
      ),
    );
  const attnTotal = attnRows.length;
  const attnPresent = attnRows.filter(
    (r) =>
      r.status === "present" ||
      r.status === "late" ||
      r.status === "makeup_attended",
  ).length;

  // Quiz attempts in the term, joined to each quiz's subject. Keep the LATEST
  // attempt per quiz, then average per subject.
  const attemptRows = await db
    .select({
      quizId: quizAttempts.quizId,
      subjectId: quizzes.subjectId,
      correct: quizAttempts.correctCount,
      total: quizAttempts.total,
      submittedAt: quizAttempts.submittedAt,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .where(
      and(
        eq(quizAttempts.studentId, studentId),
        eq(subjectWeeks.termId, termId),
      ),
    );
  const latestByQuiz = new Map<string, (typeof attemptRows)[number]>();
  for (const a of attemptRows) {
    const prev = latestByQuiz.get(a.quizId);
    if (!prev || a.submittedAt > prev.submittedAt) latestByQuiz.set(a.quizId, a);
  }
  const quizPctBySubject = new Map<string, number[]>();
  for (const a of latestByQuiz.values()) {
    if (a.total <= 0) continue;
    const list = quizPctBySubject.get(a.subjectId) ?? [];
    list.push(clampPct((a.correct / a.total) * 100));
    quizPctBySubject.set(a.subjectId, list);
  }

  // Test scores (is_test homework marked in the term), per subject.
  const testRows = await db
    .select({ subjectId: classes.subjectId, score: homeworkAssignments.score })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .innerJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(homework.isTest, true),
        sql`${homeworkAssignments.score} is not null`,
        gte(homework.dueDate, startDt),
        lt(homework.dueDate, endExclusiveDt),
      ),
    );
  const testPctBySubject = new Map<string, number[]>();
  for (const t of testRows) {
    if (t.score === null || t.subjectId === null) continue;
    const list = testPctBySubject.get(t.subjectId) ?? [];
    list.push(clampPct(Number(t.score)));
    testPctBySubject.set(t.subjectId, list);
  }

  const subjectReports: SubjectReport[] = enrolledSubjects.map((s) => {
    const quizzesPcts = quizPctBySubject.get(s.subjectId) ?? [];
    const testsPcts = testPctBySubject.get(s.subjectId) ?? [];
    const grade = combineGrade(average(quizzesPcts), average(testsPcts));
    return {
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      grade,
      quizCount: quizzesPcts.length,
      testCount: testsPcts.length,
    };
  });

  // Overall: pool every latest-quiz % and every test % across subjects, then
  // combine the two averages equally.
  const allQuiz = Array.from(quizPctBySubject.values()).flat();
  const allTest = Array.from(testPctBySubject.values()).flat();
  const overall = combineGrade(average(allQuiz), average(allTest));

  // Tutor parent-visible comments in the term.
  const commentRows = await db
    .select({
      date: lessons.date,
      subjectName: subjects.name,
      comment: lessonNotes.parentVisibleComment,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        between(lessons.date, start, end),
        sql`${lessonNotes.parentVisibleComment} is not null and length(${lessonNotes.parentVisibleComment}) > 0`,
      ),
    )
    .orderBy(lessons.date);

  return {
    student,
    term,
    attendance: {
      present: attnPresent,
      total: attnTotal,
      percent: attnTotal > 0 ? Math.round((attnPresent / attnTotal) * 100) : null,
    },
    overall,
    subjects: subjectReports,
    comments: commentRows.map((c) => ({
      date: c.date,
      subjectName: c.subjectName,
      comment: c.comment as string,
    })),
  };
}
