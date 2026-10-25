import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { Empty, GlassPanel, PageHeader, SubjectDot } from "@/components/admin/ui";
import { db } from "@/db/client";
import { subjects, subjectTopics, type Resource } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { httpHref } from "@/lib/safe-url";
import { listResourcesForSubjects, taughtSubjectIds } from "@/lib/resources";
import { resourceMeta } from "@/lib/resource-meta";
import { cn } from "@/lib/utils";
import {
  AddResourceProvider,
  AddResourceButton,
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
  searchParams: Promise<{ q?: string; subject?: string }>;
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

  // Only a subject the tutor actually teaches can be selected, so a stale or
  // hand-edited ?subject= falls back to showing everything.
  const activeSubject = subjectList.some((s) => s.id === sp.subject) ? sp.subject! : "";
  const shown = activeSubject
    ? subjectList.filter((s) => s.id === activeSubject)
    : subjectList;
  // With a search running, a subject with no hits is noise; with no search it
  // stays put so its "Add to <Subject>" control remains reachable.
  const sections = (query ? shown.filter((s) => bySubject.has(s.id)) : shown).map(
    (subject) => ({ subject, resources: bySubject.get(subject.id) ?? [] }),
  );

  const chipHref = (subjectId: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (subjectId) params.set("subject", subjectId);
    const qs = params.toString();
    return qs ? `/tutor/resources?${qs}` : "/tutor/resources";
  };
  const chips = [
    { id: "", label: "All subjects", count: allResources.length },
    ...subjectList.map((s) => ({
      id: s.id,
      label: s.label,
      count: bySubject.get(s.id)?.length ?? 0,
    })),
  ];

  const panelSubjects = subjectList.map((s) => ({
    id: s.id,
    name: s.label,
    topics: topicsBySubject.get(s.id) ?? [],
  }));

  return (
    <AddResourceProvider subjects={panelSubjects}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Resources"
          sub={SUB}
          actions={
            <>
              <ResourceSearch />
              <AddResourceButton />
            </>
          }
        />

        {subjectList.length > 1 && (
          <nav aria-label="Filter by subject" className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const active = chip.id === activeSubject;
              return (
                <Link
                  key={chip.id || "all"}
                  href={chipHref(chip.id)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-white/95 bg-white/70 text-ink hover:bg-white",
                  )}
                >
                  {chip.label}
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      active ? "text-white/75" : "text-ink-soft",
                    )}
                  >
                    {chip.count}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}

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
