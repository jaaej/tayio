import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  profiles,
  subjects,
  termReportEntries,
  termReportIssues,
  terms,
} from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { enrolledInTermSql } from "@/lib/term-enrolment-sql";
import { reportWritingTerm } from "@/lib/term-report-entry-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";

/*
 * Who writes which part of a term report: the tutor of each class a student
 * had during the term writes that subject's summary (migration 0081).
 */

export type ReportTerm = { id: string; year: number; termNumber: number; startDate: string; endDate: string };

/** The term tutors are writing reports for today (`reportWritingTerm`), or null. */
export async function getReportWritingTerm(now = new Date()): Promise<ReportTerm | null> {
  const rows = await db
    .select({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms);
  return reportWritingTerm(rows, melbourneDate(now));
}

export type ReportStudentRow = {
  id: string;
  name: string;
  written: boolean;
  /** When the report went to the family; then only an admin can change it. */
  sentAt: Date | null;
};

export type TutorReportClass = {
  classId: string;
  label: string;
  subjectId: string;
  subjectName: string;
  students: ReportStudentRow[];
};

/** A tutor's classes in the term, each with its students and whether their part is written. */
export async function getTutorReportClasses(tutorId: string, term: ReportTerm): Promise<TutorReportClass[]> {
  const rows = await db
    .selectDistinct({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      studentId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(enrollments, eq(enrollments.classId, classes.id))
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .where(and(eq(classes.tutorId, tutorId), enrolledInTermSql(term)))
    .orderBy(asc(subjects.name), asc(classes.name), asc(profiles.firstName), asc(profiles.lastName));
  if (rows.length === 0) return [];

  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const [entries, issues] = await Promise.all([
    db
      .select({ studentId: termReportEntries.studentId, subjectId: termReportEntries.subjectId })
      .from(termReportEntries)
      .where(and(eq(termReportEntries.termId, term.id), inArray(termReportEntries.studentId, studentIds))),
    db
      .select({ studentId: termReportIssues.studentId, issuedAt: termReportIssues.issuedAt })
      .from(termReportIssues)
      .where(and(eq(termReportIssues.termId, term.id), inArray(termReportIssues.studentId, studentIds))),
  ]);
  const written = new Set(entries.map((e) => `${e.studentId}:${e.subjectId}`));
  const sentAt = new Map(issues.map((i) => [i.studentId, i.issuedAt]));

  const byClass = new Map<string, TutorReportClass>();
  for (const r of rows) {
    const c =
      byClass.get(r.classId) ??
      {
        classId: r.classId,
        label: classDisplayName(r.subjectName, r.className),
        subjectId: r.subjectId,
        subjectName: r.subjectName,
        students: [],
      };
    c.students.push({
      id: r.studentId,
      name: `${r.firstName} ${r.lastName}`.trim(),
      written: written.has(`${r.studentId}:${r.subjectId}`),
      sentAt: sentAt.get(r.studentId) ?? null,
    });
    byClass.set(r.classId, c);
  }
  return [...byClass.values()];
}

/** How many term report parts a tutor still has to write, for the menu and Today. */
export async function countReportsToWrite(tutorId: string): Promise<{ term: ReportTerm; count: number } | null> {
  const term = await getReportWritingTerm();
  if (!term) return null;
  const classesForTerm = await getTutorReportClasses(tutorId, term);
  const count = classesForTerm
    .flatMap((c) => c.students)
    .filter((s) => !s.written && !s.sentAt).length;
  return { term, count };
}

/**
 * Per student, the subjects they had in the term and how many have their
 * tutor's part written, for Reports > Term reports.
 */
export async function getReportProgress(
  term: Pick<ReportTerm, "id" | "startDate" | "endDate">,
  studentIds: string[],
): Promise<Map<string, { written: number; total: number }>> {
  if (studentIds.length === 0) return new Map();
  const [subjectRows, entryRows] = await Promise.all([
    db
      .selectDistinct({ studentId: enrollments.studentId, subjectId: classes.subjectId })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(and(inArray(enrollments.studentId, studentIds), enrolledInTermSql(term))),
    db
      .select({ studentId: termReportEntries.studentId, subjectId: termReportEntries.subjectId })
      .from(termReportEntries)
      .where(and(eq(termReportEntries.termId, term.id), inArray(termReportEntries.studentId, studentIds))),
  ]);
  const written = new Set(entryRows.map((e) => `${e.studentId}:${e.subjectId}`));
  const progress = new Map<string, { written: number; total: number }>();
  for (const r of subjectRows) {
    const p = progress.get(r.studentId) ?? { written: 0, total: 0 };
    p.total += 1;
    if (written.has(`${r.studentId}:${r.subjectId}`)) p.written += 1;
    progress.set(r.studentId, p);
  }
  return progress;
}

/**
 * The classes in which the student had this subject during the term, with
 * their tutors: who may write that part of the report.
 */
export async function subjectTutorsInTerm(
  studentId: string,
  subjectId: string,
  term: ReportTerm,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ tutorId: classes.tutorId })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, studentId), eq(classes.subjectId, subjectId), enrolledInTermSql(term)));
  return rows.map((r) => r.tutorId);
}
