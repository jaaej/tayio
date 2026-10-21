import "server-only";
import { and, between, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { alias } from "drizzle-orm/pg-core";
import {
  attendance,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  lessons,
  profiles,
  quizAttempts,
  quizzes,
  subjectWeeks,
  subjects,
  termReportEntries,
  terms,
} from "@/db/schema";
import { attendanceMovedSql } from "@/lib/attendance-moved";
import { attendanceSummary } from "@/lib/attendance-rules";
import { isHandedIn } from "@/lib/homework-rules";
import { average, combineGrade, type ReportGrade } from "@/lib/report-grade";
import { enrolledInTermSql } from "@/lib/term-enrolment-sql";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { weekNumberOn } from "@/lib/week-plan-rules";

/** The tutor's part of a subject's report (migration 0081). */
export type ReportEntry = {
  summary: string;
  effort: number;
  homework: number;
  understanding: number;
  writtenBy: string | null;
  updatedAt: Date;
};

export type SubjectReport = {
  subjectId: string;
  subjectName: string;
  /** The tutors of the student's classes in this subject this term. */
  tutorNames: string[];
  grade: ReportGrade | null;
  quizCount: number;
  testCount: number;
  attendance: { attended: number; total: number };
  /** Homework set this term (not tests) and how much was handed in. */
  homework: { handedIn: number; set: number };
  /** The latest attempt at each of the term's quizzes, in week order. */
  quizzes: { label: string; percent: number }[];
  /** The term's curriculum weeks that have started, in order. */
  topics: string[];
  entry: ReportEntry | null;
};

export type StudentTermReport = {
  student: { id: string; firstName: string; lastName: string; yearLevel: string | null };
  term: { id: string; year: number; termNumber: number; startDate: string; endDate: string };
  attendance: { present: number; total: number; percent: number | null };
  overall: ReportGrade | null;
  subjects: SubjectReport[];
};

/** Test scores (homeworkAssignments.score) are entered by tutors as a
 *  percentage (0-100); there is no per-test max column to normalise against. */
function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Assemble a student's term report: attendance, an overall grade, and per
 * subject the quiz + test grade (equal-weight, as a letter), attendance,
 * homework handed in, each quiz's score, the curriculum covered and the
 * tutor's summary and ratings. The subjects are those of the classes the
 * student had during the term. Returns null if the student or term doesn't
 * exist. Caller is responsible for authorisation.
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

  // The subjects of the classes the student had during the term, with
  // each class's tutor.
  const tutor = alias(profiles, "class_tutor");
  const subjectRows = await db
    .selectDistinct({
      subjectId: subjects.id,
      subjectName: subjects.name,
      tutorFirst: tutor.firstName,
      tutorLast: tutor.lastName,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutor, eq(tutor.id, classes.tutorId))
    .where(and(eq(enrollments.studentId, studentId), enrolledInTermSql(term)));
  const enrolledSubjects = new Map<string, { subjectId: string; subjectName: string; tutorNames: string[] }>();
  for (const r of subjectRows) {
    const row = enrolledSubjects.get(r.subjectId) ?? { subjectId: r.subjectId, subjectName: r.subjectName, tutorNames: [] };
    const name = `${r.tutorFirst} ${r.tutorLast}`.trim();
    if (!row.tutorNames.includes(name)) row.tutorNames.push(name);
    enrolledSubjects.set(r.subjectId, row);
  }

  // Attendance across the term, overall and per subject.
  // The shared rule: late and left early count as attended, and a moved
  // lesson (approved reschedule or credit) is left out.
  const attnRows = await db
    .select({ status: attendance.status, moved: attendanceMovedSql, subjectId: classes.subjectId })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .where(
      and(
        eq(attendance.studentId, studentId),
        between(lessons.date, start, end),
      ),
    );
  const attn = attendanceSummary(attnRows);

  // Quiz attempts in the term, joined to each quiz's subject. Keep the LATEST
  // attempt per quiz, then average per subject.
  const attemptRows = await db
    .select({
      quizId: quizAttempts.quizId,
      subjectId: quizzes.subjectId,
      correct: quizAttempts.correctCount,
      total: quizAttempts.total,
      submittedAt: quizAttempts.submittedAt,
      weekNumber: subjectWeeks.weekNumber,
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
  const quizListBySubject = new Map<string, { label: string; percent: number; week: number }[]>();
  for (const a of latestByQuiz.values()) {
    if (a.total <= 0) continue;
    const pct = clampPct((a.correct / a.total) * 100);
    const list = quizPctBySubject.get(a.subjectId) ?? [];
    list.push(pct);
    quizPctBySubject.set(a.subjectId, list);
    const shown = quizListBySubject.get(a.subjectId) ?? [];
    shown.push({ label: `Week ${a.weekNumber}`, percent: Math.round(pct), week: a.weekNumber });
    quizListBySubject.set(a.subjectId, shown);
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

  // Homework set this term (tests are graded above), per subject.
  const homeworkRows = await db
    .select({
      subjectId: sql<string | null>`coalesce(${classes.subjectId}, ${subjectWeeks.subjectId})`,
      status: homeworkAssignments.status,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .leftJoin(subjectWeeks, eq(subjectWeeks.id, homework.weekId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(homework.isTest, false),
        gte(homework.dueDate, startDt),
        lt(homework.dueDate, endExclusiveDt),
      ),
    );

  // The curriculum covered: the term's weeks that have started by today.
  const subjectIds = [...enrolledSubjects.keys()];
  const lastDay = melbourneDate(new Date()) < end ? melbourneDate(new Date()) : end;
  const weeksStarted = lastDay < start ? 0 : weekNumberOn(start, lastDay);
  const [weekRows, entryRows] = subjectIds.length
    ? await Promise.all([
        db
          .select({ subjectId: subjectWeeks.subjectId, weekNumber: subjectWeeks.weekNumber, title: subjectWeeks.title })
          .from(subjectWeeks)
          .where(and(eq(subjectWeeks.termId, termId), inArray(subjectWeeks.subjectId, subjectIds)))
          .orderBy(subjectWeeks.weekNumber),
        db
          .select({
            subjectId: termReportEntries.subjectId,
            summary: termReportEntries.summary,
            effort: termReportEntries.effort,
            homework: termReportEntries.homework,
            understanding: termReportEntries.understanding,
            updatedAt: termReportEntries.updatedAt,
            writerFirst: profiles.firstName,
            writerLast: profiles.lastName,
          })
          .from(termReportEntries)
          .leftJoin(profiles, eq(profiles.id, termReportEntries.writtenBy))
          .where(and(eq(termReportEntries.studentId, studentId), eq(termReportEntries.termId, termId))),
      ])
    : [[], []];
  const entryBySubject = new Map(entryRows.map((e) => [e.subjectId, e]));

  const subjectReports: SubjectReport[] = [...enrolledSubjects.values()]
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName))
    .map((s) => {
      const quizzesPcts = quizPctBySubject.get(s.subjectId) ?? [];
      const testsPcts = testPctBySubject.get(s.subjectId) ?? [];
      const grade = combineGrade(average(quizzesPcts), average(testsPcts));
      const subjectAttn = attendanceSummary(attnRows.filter((r) => r.subjectId === s.subjectId));
      const subjectHomework = homeworkRows.filter((h) => h.subjectId === s.subjectId);
      const entry = entryBySubject.get(s.subjectId);
      return {
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        tutorNames: s.tutorNames,
        grade,
        quizCount: quizzesPcts.length,
        testCount: testsPcts.length,
        attendance: { attended: subjectAttn.attended, total: subjectAttn.total },
        homework: {
          handedIn: subjectHomework.filter((h) => isHandedIn(h.status)).length,
          set: subjectHomework.length,
        },
        quizzes: (quizListBySubject.get(s.subjectId) ?? [])
          .sort((a, b) => a.week - b.week)
          .map(({ label, percent }) => ({ label, percent })),
        topics: weekRows
          .filter((w) => w.subjectId === s.subjectId && w.weekNumber <= weeksStarted)
          .map((w) => w.title),
        entry: entry
          ? {
              summary: entry.summary,
              effort: entry.effort,
              homework: entry.homework,
              understanding: entry.understanding,
              writtenBy: entry.writerFirst ? `${entry.writerFirst} ${entry.writerLast ?? ""}`.trim() : null,
              updatedAt: entry.updatedAt,
            }
          : null,
      };
    });

  // Overall: pool every latest-quiz % and every test % across subjects, then
  // combine the two averages equally.
  const allQuiz = Array.from(quizPctBySubject.values()).flat();
  const allTest = Array.from(testPctBySubject.values()).flat();
  const overall = combineGrade(average(allQuiz), average(allTest));

  return {
    student,
    term,
    attendance: {
      present: attn.attended,
      total: attn.total,
      percent: attn.percent,
    },
    overall,
    subjects: subjectReports,
  };
}
