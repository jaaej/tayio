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

/**
 * Can user `me` (with role `meRole`) DM user `target` (with role `targetRole`)?
 * Encodes both the role-pair matrix and the relationship clause.
 */
export async function canDM(
  meId: string,
  meRole: UserRole,
  targetId: string,
  targetRole: UserRole,
): Promise<boolean> {
  if (meId === targetId) return false;
  if (meRole === targetRole) return false;

  if (meRole === "admin" || targetRole === "admin") return true;

  if (
    (meRole === "parent" && targetRole === "tutor") ||
    (meRole === "tutor" && targetRole === "parent")
  ) {
    const parentId = meRole === "parent" ? meId : targetId;
    const tutorId = meRole === "tutor" ? meId : targetId;
    return parentTutorShareClass(parentId, tutorId);
  }

  if (
    (meRole === "student" && targetRole === "tutor") ||
    (meRole === "tutor" && targetRole === "student")
  ) {
    const studentId = meRole === "student" ? meId : targetId;
    const tutorId = meRole === "tutor" ? meId : targetId;
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
