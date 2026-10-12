import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { Download, ExternalLink } from "lucide-react";
import { Empty, GlassPanel, PageHeader, SubjectDot } from "@/components/admin/ui";
import { ResourceTypeChip } from "@/components/resources/resource-type-chip";
import { db } from "@/db/client";
import { subjects, subjectTopics, type Resource } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateShort } from "@/lib/format";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { httpHref } from "@/lib/safe-url";
import { listResourcesForSubjects, taughtSubjectIds } from "@/lib/resources";
import { formatBytes, resourceFormatLabel } from "@/lib/resource-format";
import { signResourceAttachment } from "@/lib/resources-storage";
import { cn } from "@/lib/utils";
import {
  AddResourceProvider,
  AddResourceButton,
  AddToSubjectButton,
} from "./_components/add-resource-panel";
import { ResourceSearch } from "./_components/resource-search";
import { ShareToggle } from "./_components/share-toggle";

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

  const subjectList = [...subjectRows].sort((a, b) => a.name.localeCompare(b.name));
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
      label: s.name,
      count: bySubject.get(s.id)?.length ?? 0,
    })),
  ];

  const panelSubjects = subjectList.map((s) => ({
    id: s.id,
    name: s.name,
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
                  <SubjectDot subject={subject.name} />
                  {subject.name}
                </span>
              }
              meta={`${resources.length} ${resources.length === 1 ? "item" : "items"}`}
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

async function ResourceRow({
  resource: r,
  topicName,
}: {
  resource: Resource;
  topicName: string | null;
}) {
  const href =
    r.kind === "link"
      ? httpHref(r.externalUrl)
      : r.storageBucket && r.storagePath
        ? await signResourceAttachment(r.storageBucket, r.storagePath)
        : null;

  const meta = [
    resourceFormatLabel(r),
    r.kind === "file" && r.sizeBytes ? formatBytes(r.sizeBytes) : null,
    formatDateShort(melbourneDate(r.createdAt)),
  ].filter(Boolean) as string[];

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-[#F8F9FC] md:grid-cols-[110px_minmax(0,1fr)_170px_140px_44px]">
      <span className="col-span-2 md:col-span-1">
        <ResourceTypeChip type={r.type} />
      </span>
      <span className="col-span-2 flex min-w-0 flex-col md:col-span-1">
        <span className="truncate text-[14px] font-bold text-ink" title={r.title}>
          {r.title}
        </span>
        {topicName && <span className="truncate text-[12px] text-muted">{topicName}</span>}
      </span>
      <span className="col-span-2 text-[12px] text-muted md:col-span-1">{meta.join(" · ")}</span>
      <ShareToggle id={r.id} isShared={r.isPublished} title={r.title} />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={r.kind === "link" ? `Open ${r.title}` : `Download ${r.title}`}
          className="grid h-11 w-11 place-items-center justify-self-end rounded-[10px] border border-line-strong bg-surface text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {r.kind === "link" ? (
            <ExternalLink className="h-[15px] w-[15px]" aria-hidden />
          ) : (
            <Download className="h-[15px] w-[15px]" aria-hidden />
          )}
        </a>
      ) : (
        <span aria-hidden />
      )}
    </li>
  );
}
