import "server-only";

import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  notifications,
  profiles,
  subjects,
  termReportIssues,
  terms,
} from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { termReportRecipients } from "@/lib/term-report-rules";

/*
 * Issuing term reports to families, and who has had theirs. One issue path
 * for the student profile's Term reports tab and Reports > Term reports, so
 * both notify the same people and record the same "sent".
 */

type TermRow = { id: string; startDate: string; endDate: string };

export type IssueResult = { notified: number };

/**
 * Notify the family that a student's term report is ready, and record it.
 * Recipients are every linked parent, plus the student when they can open
 * their own report (unrestricted). Nobody to notify issues nothing.
 */
export async function issueTermReport(
  studentId: string,
  termId: string,
  issuedById: string,
): Promise<IssueResult> {
  const [[student], [term], parents] = await Promise.all([
    db
      .select({
        id: profiles.id,
        role: profiles.role,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(eq(profiles.id, studentId))
      .limit(1),
    db
      .select({ year: terms.year, termNumber: terms.termNumber })
      .from(terms)
      .where(eq(terms.id, termId))
      .limit(1),
    db
      .select({ parentId: familyLinks.parentId })
      .from(familyLinks)
      .where(eq(familyLinks.studentId, studentId)),
  ]);
  if (!student) throw new Error("Student not found");
  if (!term) throw new Error("Term not found");

  const recipientIds = termReportRecipients(
    student,
    parents.map((p) => p.parentId),
  );
  if (recipientIds.length === 0) return { notified: 0 };

  const href = `/reports/${studentId}/${termId}`;
  const label = `${term.year} Term ${term.termNumber}`;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(notifications).values(
      recipientIds.map((userId) => ({
        userId,
        channel: "in_app" as const,
        title: "Term report ready",
        body: `${label} progress report for ${student.firstName} ${student.lastName}`.trim(),
        href,
      })),
    );
    await tx
      .insert(termReportIssues)
      .values({ studentId, termId, issuedById, issuedAt: now, recipientCount: recipientIds.length })
      .onConflictDoUpdate({
        target: [termReportIssues.studentId, termReportIssues.termId],
        set: { issuedById, issuedAt: now, recipientCount: recipientIds.length },
      });
  });
  return { notified: recipientIds.length };
}

export type TermReportClass = { id: string; label: string };

/** Classes with at least one student enrolled at some point in the term. */
export async function getTermReportClasses(term: TermRow): Promise<TermReportClass[]> {
  const rows = await db
    .selectDistinct({
      id: classes.id,
      name: classes.name,
      subjectName: subjects.name,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(enrollments, eq(enrollments.classId, classes.id))
    .where(inTerm(term))
    .orderBy(asc(subjects.name), asc(classes.name));
  return rows.map((r) => ({ id: r.id, label: classDisplayName(r.subjectName, r.name) }));
}

export type TermReportStudent = {
  id: string;
  name: string;
  /** People a report would notify: linked parents, plus the student if unrestricted. */
  recipients: number;
  issuedAt: Date | null;
};

/** One class's students for the term, with whether their report went out. */
export async function getTermReportRoster(
  term: TermRow,
  classId: string,
): Promise<TermReportStudent[]> {
  const rows = await db
    .selectDistinct({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      role: profiles.role,
      parentIds: sql<string[]>`coalesce((
        select array_agg(fl.parent_id) from ${familyLinks} fl where fl.student_id = ${profiles.id}
      ), '{}')`,
      issuedAt: termReportIssues.issuedAt,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .leftJoin(
      termReportIssues,
      and(eq(termReportIssues.studentId, profiles.id), eq(termReportIssues.termId, term.id)),
    )
    .where(and(eq(enrollments.classId, classId), inTerm(term)))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    recipients: termReportRecipients(r, r.parentIds).length,
    issuedAt: r.issuedAt,
  }));
}

/** When each of a student's term reports was last issued, by term id. */
export async function getStudentReportIssues(studentId: string): Promise<Map<string, Date>> {
  const rows = await db
    .select({ termId: termReportIssues.termId, issuedAt: termReportIssues.issuedAt })
    .from(termReportIssues)
    .where(eq(termReportIssues.studentId, studentId));
  return new Map(rows.map((r) => [r.termId, r.issuedAt]));
}

/** An enrolment that overlapped the term (Melbourne dates). */
function inTerm(term: TermRow) {
  return and(
    lte(sql`(${enrollments.enrolledAt} at time zone 'Australia/Melbourne')::date`, term.endDate),
    or(
      isNull(enrollments.withdrawnAt),
      gte(sql`(${enrollments.withdrawnAt} at time zone 'Australia/Melbourne')::date`, term.startDate),
    ),
  );
}
