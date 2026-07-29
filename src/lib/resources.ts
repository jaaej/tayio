import "server-only";
import { and, desc, eq, ilike, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  resources,
  enrollments,
  classes,
  familyLinks,
  subjects,
  profiles,
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
  // familyLinks.studentId is the child - NOT childId (schema uses parent_id + student_id)
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

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------

export type AdminResourceStatus = "live" | "unpublished" | "removed";
export type AdminResourceFilter = {
  subjectId?: string;
  type?: ResourceType;
  status?: AdminResourceStatus;
};

export type AdminResourceRow = {
  id: string;
  title: string;
  type: ResourceType;
  kind: "file" | "link";
  subjectId: string;
  subjectName: string;
  source: "promoted" | "direct";
  uploaderName: string;
  isPublished: boolean;
  removedAt: Date | null;
  removedReason: string | null;
  createdAt: Date;
};

// Admin-only: every resource across every subject, including unpublished and
// removed rows (unlike listResourcesForSubjects, which hides both). Joins the
// uploader's display name via profiles and the subject name via subjects.
export async function listAllResourcesForAdmin(
  filter: AdminResourceFilter = {},
): Promise<AdminResourceRow[]> {
  const conds = [];
  if (filter.subjectId) conds.push(eq(resources.subjectId, filter.subjectId));
  if (filter.type) conds.push(eq(resources.type, filter.type));
  if (filter.status === "live") {
    conds.push(eq(resources.isPublished, true), isNull(resources.removedAt));
  } else if (filter.status === "unpublished") {
    conds.push(eq(resources.isPublished, false), isNull(resources.removedAt));
  } else if (filter.status === "removed") {
    conds.push(isNotNull(resources.removedAt));
  }

  const rows = await db
    .select({
      id: resources.id,
      title: resources.title,
      type: resources.type,
      kind: resources.kind,
      subjectId: resources.subjectId,
      subjectName: subjects.name,
      sourceAttachmentId: resources.sourceAttachmentId,
      uploaderFirst: profiles.firstName,
      uploaderLast: profiles.lastName,
      isPublished: resources.isPublished,
      removedAt: resources.removedAt,
      removedReason: resources.removedReason,
      createdAt: resources.createdAt,
    })
    .from(resources)
    .innerJoin(subjects, eq(subjects.id, resources.subjectId))
    .innerJoin(profiles, eq(profiles.id, resources.uploadedBy))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(resources.createdAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    kind: r.kind as "file" | "link",
    subjectId: r.subjectId,
    subjectName: r.subjectName,
    source: r.sourceAttachmentId ? ("promoted" as const) : ("direct" as const),
    uploaderName: `${r.uploaderFirst} ${r.uploaderLast}`,
    isPublished: r.isPublished,
    removedAt: r.removedAt,
    removedReason: r.removedReason,
    createdAt: r.createdAt,
  }));
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
