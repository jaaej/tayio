import "server-only";
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  resources,
  enrollments,
  classes,
  familyLinks,
  type Resource,
  resourceTypeEnum,
} from "@/db/schema";

type ResourceType = (typeof resourceTypeEnum.enumValues)[number];
export type ResourceFilter = { type?: ResourceType; topicId?: string; q?: string };

export async function enrolledSubjectIds(studentId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ subjectId: classes.subjectId })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)));
  return rows.map((r) => r.subjectId);
}

export async function childSubjectIds(parentId: string): Promise<string[]> {
  // familyLinks.studentId is the child — NOT childId (schema uses parent_id + student_id)
  const kids = await db
    .select({ studentId: familyLinks.studentId })
    .from(familyLinks)
    .where(eq(familyLinks.parentId, parentId));
  const ids = new Set<string>();
  for (const { studentId } of kids) {
    for (const s of await enrolledSubjectIds(studentId)) ids.add(s);
  }
  return [...ids];
}

export async function taughtSubjectIds(tutorId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ subjectId: classes.subjectId })
    .from(classes)
    .where(eq(classes.tutorId, tutorId));
  return rows.map((r) => r.subjectId);
}

export async function listResourcesForSubjects(
  subjectIds: string[],
  filter: ResourceFilter = {},
): Promise<Resource[]> {
  if (subjectIds.length === 0) return [];
  const conds = [
    inArray(resources.subjectId, subjectIds),
    eq(resources.isPublished, true),
    isNull(resources.removedAt),
  ];
  if (filter.type) conds.push(eq(resources.type, filter.type));
  if (filter.topicId) conds.push(eq(resources.topicId, filter.topicId));
  if (filter.q) conds.push(ilike(resources.title, `%${filter.q}%`));
  return db
    .select()
    .from(resources)
    .where(and(...conds))
    .orderBy(desc(resources.createdAt));
}

export async function getResourceForViewer(
  id: string,
  allowedSubjectIds: string[],
): Promise<Resource | null> {
  if (allowedSubjectIds.length === 0) return null;
  const [row] = await db
    .select()
    .from(resources)
    .where(
      and(
        eq(resources.id, id),
        inArray(resources.subjectId, allowedSubjectIds),
        eq(resources.isPublished, true),
        isNull(resources.removedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}
