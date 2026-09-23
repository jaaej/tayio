import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  studentCurriculumTermGrants,
  subjectWeeks,
  subjects,
  terms,
} from "@/db/schema";
import {
  findCurriculumEntryTerm,
  melbourneDateKey,
  type CurriculumAccessTerm,
} from "@/lib/curriculum-access-rules";

export type AdminCurriculumAccessSubject = {
  subjectId: string;
  subjectName: string;
  enrolledDate: string;
  automaticFrom: { year: number; termNumber: number } | null;
  earlierTerms: Array<{
    id: string;
    year: number;
    termNumber: number;
    granted: boolean;
  }>;
};

export async function getStudentCurriculumAccessOverview(
  studentId: string,
): Promise<AdminCurriculumAccessSubject[]> {
  const active = await db
    .selectDistinct({ subjectId: subjects.id, subjectName: subjects.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .orderBy(asc(subjects.name));
  if (active.length === 0) return [];

  const subjectIds = active.map((subject) => subject.subjectId);
  const [history, termRows, grants] = await Promise.all([
    db
      .select({
        subjectId: classes.subjectId,
        enrolledAt: enrollments.enrolledAt,
      })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          inArray(classes.subjectId, subjectIds),
        ),
      )
      .orderBy(asc(enrollments.enrolledAt)),
    db
      .selectDistinct({
        subjectId: subjectWeeks.subjectId,
        id: terms.id,
        year: terms.year,
        termNumber: terms.termNumber,
        startDate: terms.startDate,
        endDate: terms.endDate,
      })
      .from(subjectWeeks)
      .innerJoin(terms, eq(terms.id, subjectWeeks.termId))
      .where(inArray(subjectWeeks.subjectId, subjectIds)),
    db
      .select({
        subjectId: studentCurriculumTermGrants.subjectId,
        termId: studentCurriculumTermGrants.termId,
      })
      .from(studentCurriculumTermGrants)
      .where(eq(studentCurriculumTermGrants.studentId, studentId)),
  ]);

  const today = melbourneDateKey();
  return active.map((subject) => {
    const enrolledAt = history.find(
      (row) => row.subjectId === subject.subjectId,
    )?.enrolledAt;
    const subjectTerms: CurriculumAccessTerm[] = termRows
      .filter((row) => row.subjectId === subject.subjectId)
      .map(({ id, year, termNumber, startDate, endDate }) => ({
        id,
        year,
        termNumber,
        startDate,
        endDate,
      }));
    const enrolledDate = enrolledAt ? melbourneDateKey(enrolledAt) : today;
    const entry = findCurriculumEntryTerm(subjectTerms, enrolledDate);
    const grantedIds = new Set(
      grants
        .filter((grant) => grant.subjectId === subject.subjectId)
        .map((grant) => grant.termId),
    );

    return {
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      enrolledDate,
      automaticFrom: entry
        ? { year: entry.year, termNumber: entry.termNumber }
        : null,
      earlierTerms: subjectTerms
        .filter(
          (term) =>
            term.startDate <= today &&
            (!entry || term.startDate < entry.startDate),
        )
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((term) => ({
          id: term.id,
          year: term.year,
          termNumber: term.termNumber,
          granted: grantedIds.has(term.id),
        })),
    };
  });
}
