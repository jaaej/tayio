import "server-only";

import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  profiles,
  studentLeave,
  studentTrials,
  subjects,
} from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { freeTrialDirectoryState } from "@/lib/account-schedule-status";
import { melbourneDate } from "@/lib/tutor-cover-rules";

/**
 * Profile header context for one student: their parents (name only, for the
 * header and "Message parent"), the tutor's classes they sit in, and whether
 * they are on leave or on a free trial today. Call only after
 * `assertTutorTeachesStudent` (getStudentProfile runs it).
 */
export async function getStudentHeaderContext(tutorId: string, studentId: string) {
  const today = melbourneDate(new Date());
  const [parents, classRows, [leave], [trial]] = await Promise.all([
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        isPrimaryContact: familyLinks.isPrimaryContact,
      })
      .from(familyLinks)
      .innerJoin(profiles, eq(profiles.id, familyLinks.parentId))
      .where(and(eq(familyLinks.studentId, studentId), eq(profiles.isActive, true)))
      .orderBy(asc(profiles.firstName)),
    db
      .select({ name: classes.name, subjectName: subjects.name })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(classes.tutorId, tutorId),
          sql`${enrollments.withdrawnAt} is null`,
        ),
      )
      .orderBy(asc(subjects.name)),
    db
      .select({ startDate: studentLeave.startDate, endDate: studentLeave.endDate })
      .from(studentLeave)
      .where(
        and(
          eq(studentLeave.studentId, studentId),
          lte(studentLeave.startDate, today),
          gte(studentLeave.endDate, today),
        ),
      )
      .limit(1),
    db
      .select({ startDate: studentTrials.startDate, endDate: studentTrials.endDate })
      .from(studentTrials)
      .where(eq(studentTrials.studentId, studentId))
      .limit(1),
  ]);

  // Primary contact first, so "Message parent" reaches the right person.
  parents.sort((a, b) => Number(b.isPrimaryContact) - Number(a.isPrimaryContact));

  return {
    today,
    parents: parents.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
    })),
    classNames: classRows.map((c) => classDisplayName(c.subjectName, c.name)),
    leave: leave ?? null,
    trial: trial && freeTrialDirectoryState(trial, today) === "current" ? trial : null,
  };
}
