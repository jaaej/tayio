import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { subjects, subjectTopics } from "@/db/schema";
import { listResourcesForSubjects } from "@/lib/resources";
import { resourceMeta } from "@/lib/resource-meta";

export type ResourceLibraryItem = {
  id: string;
  title: string;
  type: string;
  kind: "file" | "link";
  topicId: string | null;
  topicName: string | null;
  /** "PDF · 8 Oct": format and the day it was added. */
  meta: string;
};

export type ResourceLibrarySubject = {
  subjectId: string;
  subjectName: string;
  resources: ResourceLibraryItem[];
};

export type ResourceLibraryTopic = { id: string; name: string; subjectName: string };

/**
 * The read-only resource library for a set of subjects the caller has already
 * authorised (`enrolledSubjectIds` for a student, `childSubjectIds` for a
 * parent): each subject in the given order with its published resources, plus
 * the topics used by the topic filter. Rows carry only client-safe fields;
 * files are opened through the role's `openResource*` action, never a raw path.
 */
export async function loadResourceLibrary(subjectIds: string[]): Promise<{
  subjects: ResourceLibrarySubject[];
  topics: ResourceLibraryTopic[];
}> {
  if (subjectIds.length === 0) return { subjects: [], topics: [] };

  const [subjectRows, topicRows, resourceRows] = await Promise.all([
    db
      .select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .where(inArray(subjects.id, subjectIds)),
    db
      .select({
        id: subjectTopics.id,
        subjectId: subjectTopics.subjectId,
        name: subjectTopics.name,
      })
      .from(subjectTopics)
      .where(inArray(subjectTopics.subjectId, subjectIds))
      .orderBy(asc(subjectTopics.position)),
    listResourcesForSubjects(subjectIds),
  ]);

  // Preserve the caller's order regardless of what the DB returns for the IN list.
  const subjectList = subjectIds
    .map((id) => subjectRows.find((s) => s.id === id))
    .filter((s): s is { id: string; name: string } => Boolean(s));
  const topicById = new Map(topicRows.map((t) => [t.id, t]));

  return {
    subjects: subjectList.map((s) => ({
      subjectId: s.id,
      subjectName: s.name,
      // listResourcesForSubjects is newest first; filtering keeps that order.
      resources: resourceRows
        .filter((r) => r.subjectId === s.id)
        .map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          kind: r.kind,
          topicId: r.topicId,
          topicName: r.topicId ? (topicById.get(r.topicId)?.name ?? null) : null,
          meta: resourceMeta(r),
        })),
    })),
    topics: topicRows.flatMap((t) => {
      const subject = subjectList.find((s) => s.id === t.subjectId);
      return subject ? [{ id: t.id, name: t.name, subjectName: subject.name }] : [];
    }),
  };
}
