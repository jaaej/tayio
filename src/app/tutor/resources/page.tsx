import { asc, inArray } from "drizzle-orm";
import { Empty, GlassPanel, PageHeader, SubjectDot } from "@/components/admin/ui";
import { db } from "@/db/client";
import { subjects, subjectTopics, type Resource } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { httpHref } from "@/lib/safe-url";
import { listResourcesForSubjects, taughtSubjectIds } from "@/lib/resources";
import { resourceMeta } from "@/lib/resource-meta";
import {
  AddResourceProvider,
  AddToSubjectButton,
} from "./_components/add-resource-panel";
import { ResourceSearch } from "./_components/resource-search";
import { TutorResourceRow } from "./_components/resource-row";
import { distinctSubjects } from "@/lib/subject-label";

export const dynamic = "force-dynamic";

const SUB = "Share items with students when they are ready.";

export default async function TutorResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();

  const user = await requireRole("tutor");
  const subjectIds = await taughtSubjectIds(user.id);

  const [subjectRows, topicRows, allResources] = subjectIds.length
    ? await Promise.all([
        db
          .select({
            id: subjects.id,
            name: subjects.name,
            yearLevel: subjects.yearLevel,
            color: subjects.color,
          })
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
        // The tutor's own library shows what they have unshared as well - the
        // student and parent libraries stay published-only.
        listResourcesForSubjects(subjectIds, {
          q: query || undefined,
          includeUnpublished: true,
        }),
      ])
    : [[], [], []];

  if (subjectRows.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Resources" />
        <GlassPanel>
          <Empty>An admin needs to assign you to a class before you can add resources.</Empty>
        </GlassPanel>
      </div>
    );
  }

  // Names can repeat; where two do, the label adds the year level.
  const subjectList = distinctSubjects(subjectRows);
  const topicsBySubject = new Map<string, Array<{ id: string; name: string }>>();
  for (const t of topicRows) {
    if (!topicsBySubject.has(t.subjectId)) topicsBySubject.set(t.subjectId, []);
    topicsBySubject.get(t.subjectId)!.push({ id: t.id, name: t.name });
  }
  const topicNameById = new Map(topicRows.map((t) => [t.id, t.name]));

  const bySubject = new Map<string, Resource[]>();
  for (const r of allResources) {
    const list = bySubject.get(r.subjectId) ?? [];
    list.push(r);
    bySubject.set(r.subjectId, list);
  }

  // With a search running, a subject with no hits is noise; with no search it
  // stays put so its + control remains reachable.
  const sections = (query ? subjectList.filter((s) => bySubject.has(s.id)) : subjectList).map(
    (subject) => ({ subject, resources: bySubject.get(subject.id) ?? [] }),
  );

  const panelSubjects = subjectList.map((s) => ({
    id: s.id,
    name: s.label,
    topics: topicsBySubject.get(s.id) ?? [],
  }));

  return (
    <AddResourceProvider subjects={panelSubjects}>
      <div className="flex flex-col gap-5">
        <PageHeader title="Resources" sub={SUB} actions={<ResourceSearch />} />

        {sections.length === 0 ? (
          <GlassPanel>
            <Empty>No resources match this search.</Empty>
          </GlassPanel>
        ) : (
          sections.map(({ subject, resources }) => (
            <GlassPanel
              key={subject.id}
              titleId={`subject-${subject.id}`}
              title={
                <span className="inline-flex items-center gap-2.5">
                  <SubjectDot subject={subject.name} color={subject.color} />
                  {subject.name}
                </span>
              }
              meta={`${resources.length} ${resources.length === 1 ? "resource" : "resources"}`}
              action={<AddToSubjectButton subjectId={subject.id} subjectName={subject.name} />}
            >
              {resources.length === 0 ? (
                <Empty>Nothing in this subject yet.</Empty>
              ) : (
                <ul className="divide-y divide-line">
                  {resources.map((r) => (
                    <ResourceRow
                      key={r.id}
                      resource={r}
                      topicName={r.topicId ? (topicNameById.get(r.topicId) ?? null) : null}
                    />
                  ))}
                </ul>
              )}
            </GlassPanel>
          ))
        )}
      </div>
    </AddResourceProvider>
  );
}

function ResourceRow({
  resource: r,
  topicName,
}: {
  resource: Resource;
  topicName: string | null;
}) {
  return (
    <TutorResourceRow
      resource={{
        id: r.id,
        title: r.title,
        kind: r.kind,
        href: r.kind === "link" ? httpHref(r.externalUrl) : null,
      }}
      type={r.type}
      topicName={topicName}
      meta={resourceMeta(r)}
      isShared={r.isPublished}
    />
  );
}
