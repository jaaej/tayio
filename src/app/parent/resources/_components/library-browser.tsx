import { asc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { subjects, subjectTopics } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { childSubjectIds, listResourcesForSubjects } from "@/lib/resources";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { openResourceForParent } from "@/app/_actions/resources";
import {
  LibraryBrowserClient,
  type LibrarySubjectGroup,
  type LibraryTopicOption,
} from "@/components/resources/library-browser-client";

/**
 * Server-loaded resource library for the logged-in parent, scoped to the
 * union of all their children's actively-enrolled subjects (via
 * `childSubjectIds`). Mirrors the student `LibraryBrowser` - same subject
 * grouping and read-only filter UI - but resources aggregate across every
 * child at once rather than a single student, since resources are
 * subject-scoped (not per-child) and the subject grouping already makes the
 * origin clear without a child switcher.
 */
export async function ParentLibraryBrowser({ parentId }: { parentId: string }) {
  const subjectIds = await childSubjectIds(parentId);

  if (subjectIds.length === 0) {
    return (
      <Card>
        <div className="py-6 text-sm text-ink-soft">
          No resources yet - your children aren't enrolled in any subjects.
        </div>
      </Card>
    );
  }

  const subjectRows = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(inArray(subjects.id, subjectIds));
  // Preserve a stable order regardless of what the DB returns for the IN list.
  const subjectList = subjectIds
    .map((id) => subjectRows.find((s) => s.id === id))
    .filter((s): s is { id: string; name: string } => Boolean(s));

  const topicRows = await db
    .select({
      id: subjectTopics.id,
      subjectId: subjectTopics.subjectId,
      name: subjectTopics.name,
    })
    .from(subjectTopics)
    .where(inArray(subjectTopics.subjectId, subjectIds))
    .orderBy(asc(subjectTopics.position));
  const topicById = new Map(topicRows.map((t) => [t.id, t]));

  const resourcesBySubject = await Promise.all(
    subjectList.map((s) => listResourcesForSubjects([s.id])),
  );

  const groups: LibrarySubjectGroup[] = subjectList.map((s, i) => ({
    subjectId: s.id,
    subjectName: s.name,
    tokens: getAccentTokens(colorFamilyForSubject(s.name)),
    resources: resourcesBySubject[i].map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      kind: r.kind,
      topicId: r.topicId,
      topicName: r.topicId ? (topicById.get(r.topicId)?.name ?? null) : null,
    })),
  }));

  const topicOptions: LibraryTopicOption[] = topicRows
    .map((t) => {
      const subject = subjectList.find((s) => s.id === t.subjectId);
      return subject ? { id: t.id, name: t.name, subjectName: subject.name } : null;
    })
    .filter((t): t is LibraryTopicOption => Boolean(t));

  return (
    <LibraryBrowserClient
      groups={groups}
      topicOptions={topicOptions}
      openAction={openResourceForParent}
    />
  );
}
