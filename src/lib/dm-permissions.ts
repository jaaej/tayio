import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  profiles,
  type UserRole,
} from "@/db/schema";
import { coarseRole, studentTier } from "@/lib/roles";

/**
 * Can user `me` (with role `meRole`) DM user `target` (with role `targetRole`)?
 * Encodes both the role-pair matrix and the relationship clause.
 *
 * Roles may be passed as tiered values (e.g. student_unrestricted); the matrix
 * works on the coarse family. The one tier-sensitive rule: a RESTRICTED student
 * has no DM channel with the admin office (their parent is the admin contact),
 * so restricted-student <-> admin is blocked while unrestricted-student <->
 * admin is allowed.
 */
export async function canDM(
  meId: string,
  meRole: UserRole,
  targetId: string,
  targetRole: UserRole,
): Promise<boolean> {
  if (meId === targetId) return false;
  const meC = coarseRole(meRole);
  const targetC = coarseRole(targetRole);
  if (meC === targetC) return false;

  if (meC === "admin" || targetC === "admin") {
    // Restricted students cannot DM the admin office.
    const studentRole =
      meC === "student" ? meRole : targetC === "student" ? targetRole : null;
    if (studentRole && studentTier(studentRole) === "restricted") return false;
    return true;
  }

  if (
    (meC === "parent" && targetC === "tutor") ||
    (meC === "tutor" && targetC === "parent")
  ) {
    const parentId = meC === "parent" ? meId : targetId;
    const tutorId = meC === "tutor" ? meId : targetId;
    return parentTutorShareClass(parentId, tutorId);
  }

  if (
    (meC === "student" && targetC === "tutor") ||
    (meC === "tutor" && targetC === "student")
  ) {
    const studentId = meC === "student" ? meId : targetId;
    const tutorId = meC === "tutor" ? meId : targetId;
    return studentTutorShareClass(studentId, tutorId);
  }

  return false;
}

async function parentTutorShareClass(
  parentId: string,
  tutorId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: classes.id })
    .from(familyLinks)
    .innerJoin(enrollments, eq(enrollments.studentId, familyLinks.studentId))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(familyLinks.parentId, parentId), eq(classes.tutorId, tutorId)))
    .limit(1);
  return rows.length > 0;
}

async function studentTutorShareClass(
  studentId: string,
  tutorId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: classes.id })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, studentId), eq(classes.tutorId, tutorId)))
    .limit(1);
  return rows.length > 0;
}

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.role ?? null;
}
