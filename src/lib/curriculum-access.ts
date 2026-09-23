import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  studentCurriculumTermGrants,
  subjectWeeks,
  terms,
} from "@/db/schema";
import {
  filterAccessibleTerms,
  melbourneDateKey,
  releasedCurriculumWeek,
  type CurriculumAccessTerm,
} from "@/lib/curriculum-access-rules";

export async function accessibleCurriculumTermsForStudent({
  studentId,
  subjectId,
  enrolledAt,
  termRows,
  today = new Date(),
}: {
  studentId: string;
  subjectId: string;
  enrolledAt: Date;
  termRows: CurriculumAccessTerm[];
  today?: Date;
}) {
  const grants = await db
    .select({ termId: studentCurriculumTermGrants.termId })
    .from(studentCurriculumTermGrants)
    .where(
      and(
        eq(studentCurriculumTermGrants.studentId, studentId),
        eq(studentCurriculumTermGrants.subjectId, subjectId),
      ),
    );

  return filterAccessibleTerms(
    termRows,
    melbourneDateKey(enrolledAt),
    new Set(grants.map((grant) => grant.termId)),
    melbourneDateKey(today),
  );
}
/**
 * Authoritative server-side guard for videos, booklets, quizzes, and progress
 * writes. It deliberately repeats the access calculation instead of trusting
 * a disabled/locked control rendered by the client.
 */
export async function canStudentAccessCurriculumWeek(
  studentId: string,
  subjectWeekId: string,
  today: Date = new Date(),
): Promise<boolean> {
  const [week] = await db
    .select({
      subjectId: subjectWeeks.subjectId,
      termId: subjectWeeks.termId,
      weekNumber: subjectWeeks.weekNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
      year: terms.year,
      termNumber: terms.termNumber,
    })
    .from(subjectWeeks)
    .innerJoin(terms, eq(terms.id, subjectWeeks.termId))
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  if (!week) return false;

  const [activeEnrollment, firstEnrollment, subjectTermRows, grant] =
    await Promise.all([
      db
        .select({ id: classes.id })
        .from(enrollments)
        .innerJoin(classes, eq(classes.id, enrollments.classId))
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(classes.subjectId, week.subjectId),
            isNull(enrollments.withdrawnAt),
          ),
        )
        .limit(1),
      db
        .select({ enrolledAt: enrollments.enrolledAt })
        .from(enrollments)
        .innerJoin(classes, eq(classes.id, enrollments.classId))
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(classes.subjectId, week.subjectId),
          ),
        )
        .orderBy(asc(enrollments.enrolledAt))
        .limit(1),
      db
        .selectDistinct({
          id: terms.id,
          year: terms.year,
          termNumber: terms.termNumber,
          startDate: terms.startDate,
          endDate: terms.endDate,
        })
        .from(terms)
        .innerJoin(subjectWeeks, eq(subjectWeeks.termId, terms.id))
        .where(eq(subjectWeeks.subjectId, week.subjectId)),
      db
        .select({ termId: studentCurriculumTermGrants.termId })
        .from(studentCurriculumTermGrants)
        .where(
          and(
            eq(studentCurriculumTermGrants.studentId, studentId),
            eq(studentCurriculumTermGrants.subjectId, week.subjectId),
            eq(studentCurriculumTermGrants.termId, week.termId),
          ),
        )
        .limit(1),
    ]);

  if (activeEnrollment.length === 0 || firstEnrollment.length === 0) {
    return false;
  }

  const accessibleTerms = filterAccessibleTerms(
    subjectTermRows,
    melbourneDateKey(firstEnrollment[0].enrolledAt),
    new Set(grant.map((row) => row.termId)),
    melbourneDateKey(today),
  );
  if (!accessibleTerms.some((term) => term.id === week.termId)) return false;

  return (
    week.weekNumber <=
    releasedCurriculumWeek(
      { startDate: week.startDate, endDate: week.endDate },
      week.weekNumber,
      melbourneDateKey(today),
    )
  );
}
