import "server-only";

import { eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  profiles,
  subjects,
  type UserRole,
} from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import type { AnnouncementTargetRules } from "@/lib/announcement-rules";

export type ResolvedAnnouncementRecipient = {
  id: string;
  email: string;
  role: UserRole;
};

/**
 * Resolve a durable recipient snapshot. Values within one filter group are OR;
 * separate groups are AND. Academic filters constrain student enrolments and
 * tutor assignments. Parents are resolved through matching children, so no
 * unrelated family receives a class/subject/year announcement.
 */
export async function resolveAnnouncementRecipients(
  rules: AnnouncementTargetRules,
): Promise<ResolvedAnnouncementRecipient[]> {
  const [people, classRows, enrollmentRows, linkRows] = await Promise.all([
    db
      .select({
        id: profiles.id,
        email: profiles.email,
        role: profiles.role,
        yearLevel: profiles.yearLevel,
      })
      .from(profiles)
      .where(eq(profiles.isActive, true)),
    db
      .select({
        id: classes.id,
        subjectId: classes.subjectId,
        tutorId: classes.tutorId,
        subjectYearLevel: subjects.yearLevel,
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId)),
    db
      .select({
        classId: enrollments.classId,
        studentId: enrollments.studentId,
      })
      .from(enrollments)
      .where(isNull(enrollments.withdrawnAt)),
    db
      .select({
        parentId: familyLinks.parentId,
        studentId: familyLinks.studentId,
      })
      .from(familyLinks),
  ]);

  const roleSet = new Set(rules.roles);
  const classFilter = new Set(rules.classIds);
  const subjectFilter = new Set(rules.subjectIds);
  const tutorFilter = new Set(rules.tutorIds);
  const yearFilter = new Set(rules.yearLevels.map(normalizeYear));
  const hasClassScope =
    classFilter.size > 0 || subjectFilter.size > 0 || tutorFilter.size > 0;
  const hasAcademicScope = hasClassScope || yearFilter.size > 0;

  const qualifyingClasses = new Set(
    classRows
      .filter(
        (row) =>
          (classFilter.size === 0 || classFilter.has(row.id)) &&
          (subjectFilter.size === 0 || subjectFilter.has(row.subjectId)) &&
          (tutorFilter.size === 0 || tutorFilter.has(row.tutorId)) &&
          (yearFilter.size === 0 ||
            (row.subjectYearLevel &&
              yearFilter.has(normalizeYear(row.subjectYearLevel)))),
      )
      .map((row) => row.id),
  );

  const activeStudentIds = new Set(
    people
      .filter((person) => coarseRole(person.role) === "student")
      .map((person) => person.id),
  );
  const matchingStudentIds = new Set<string>();
  for (const person of people) {
    if (coarseRole(person.role) !== "student") continue;
    const matchesYear =
      yearFilter.size === 0 ||
      (person.yearLevel && yearFilter.has(normalizeYear(person.yearLevel)));
    const matchesClass =
      !hasClassScope ||
      enrollmentRows.some(
        (row) =>
          row.studentId === person.id && qualifyingClasses.has(row.classId),
      );
    if (matchesYear && matchesClass) matchingStudentIds.add(person.id);
  }

  const matchingTutorIds = new Set(
    hasAcademicScope
      ? classRows
          .filter((row) => qualifyingClasses.has(row.id))
          .map((row) => row.tutorId)
      : people
          .filter((person) => coarseRole(person.role) === "tutor")
          .map((person) => person.id),
  );
  const matchingParentIds = new Set(
    hasAcademicScope
      ? linkRows
          .filter(
            (row) =>
              activeStudentIds.has(row.studentId) &&
              matchingStudentIds.has(row.studentId),
          )
          .map((row) => row.parentId)
      : people
          .filter((person) => coarseRole(person.role) === "parent")
          .map((person) => person.id),
  );

  const recipientIds = new Set<string>();
  for (const person of people) {
    const role = coarseRole(person.role);
    if (!roleSet.has(role)) continue;
    if (role === "student" && !matchingStudentIds.has(person.id)) continue;
    if (role === "tutor" && !matchingTutorIds.has(person.id)) continue;
    if (role === "parent" && !matchingParentIds.has(person.id)) continue;
    recipientIds.add(person.id);
  }

  if (rules.includeLinkedParents) {
    const matchingParents = new Set(
      linkRows
        .filter((row) => matchingStudentIds.has(row.studentId))
        .map((row) => row.parentId),
    );
    for (const person of people) {
      if (
        coarseRole(person.role) === "parent" &&
        matchingParents.has(person.id)
      ) {
        recipientIds.add(person.id);
      }
    }
  }

  return people
    .filter((person) => recipientIds.has(person.id))
    .map(({ id, email, role }) => ({ id, email, role }));
}

function normalizeYear(value: string) {
  return value.trim().toLowerCase().replace(/^yr\s+/, "year ");
}
