import { asc, inArray } from "drizzle-orm";
import { Download, ExternalLink } from "lucide-react";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { FilterToolbar, type FilterPill } from "@/components/ui/filter-toolbar";
import { db } from "@/db/client";
import { subjects, subjectTopics, type Resource } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong } from "@/lib/format";
import { httpHref } from "@/lib/safe-url";
import { listResourcesForSubjects, taughtSubjectIds } from "@/lib/resources";
import { resourceTypeLabel } from "@/lib/resource-types";
import { signResourceAttachment } from "@/lib/resources-storage";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import {
  AddResourceProvider,
  AddResourceButton,
  AddToSubjectButton,
} from "./_components/add-resource-panel";
import { ShareToggle } from "./_components/share-toggle";

export const dynamic = "force-dynamic";

export default async function TutorResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; subject?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();

  const user = await requireRole("tutor");
  const subjectIds = await taughtSubjectIds(user.id);

  const subjectRows = subjectIds.length
    ? await db
        .select({ id: subjects.id, name: subjects.name })
        .from(subjects)
        .where(inArray(subjects.id, subjectIds))
    : [];
  // Preserve a stable order regardless of what the DB returns for the IN list.
  const subjectList = subjectIds
    .map((id) => subjectRows.find((s) => s.id === id))
    .filter((s): s is { id: string; name: string } => Boolean(s));

  const topicRows = subjectIds.length
    ? await db
        .select({
          id: subjectTopics.id,
          subjectId: subjectTopics.subjectId,
          name: subjectTopics.name,
        })
        .from(subjectTopics)
        .where(inArray(subjectTopics.subjectId, subjectIds))
        .orderBy(asc(subjectTopics.position))
    : [];
  const topicsBySubject = new Map<string, Array<{ id: string; name: string }>>();
  for (const t of topicRows) {
    if (!topicsBySubject.has(t.subjectId)) topicsBySubject.set(t.subjectId, []);
    topicsBySubject.get(t.subjectId)!.push({ id: t.id, name: t.name });
  }
  const topicNameById = new Map(topicRows.map((t) => [t.id, t.name]));

  if (subjectList.length === 0) {
    return (
      <div className="space-y-5">
        <PageHead eyebrow="Resource library" title="Resources" />
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-ink-soft">
              An admin needs to assign you to a class before you can add
              resources.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Only a subject the tutor actually teaches can be selected, so a stale or
  // hand-edited ?subject= falls back to showing everything.
  const activeSubject = subjectList.some((s) => s.id === sp.subject)
    ? (sp.subject as string)
    : "";
  const shown = activeSubject
    ? subjectList.filter((s) => s.id === activeSubject)
    : subjectList;

  const groups = await Promise.all(
    shown.map(async (subject) => ({
      subject,
      // The tutor's own library shows what they have unshared as well - the
      // student and parent libraries stay published-only.
      resources: await listResourcesForSubjects([subject.id], {
        q: query || undefined,
        includeUnpublished: true,
      }),
    })),
  );

  const filtering = Boolean(query);
  // With a search running, a subject with no hits is noise; with no search it
  // stays put so its "Add to <Subject>" control remains reachable.
  const sections = filtering
    ? groups.filter((g) => g.resources.length > 0)
    : groups;

  const pills: FilterPill[] = [
    { value: "", label: "All subjects" },
    ...subjectList.map((s) => ({ value: s.id, label: s.name })),
  ];

  const panelSubjects = subjectList.map((s) => ({
    id: s.id,
    name: s.name,
    topics: topicsBySubject.get(s.id) ?? [],
  }));

  return (
    <AddResourceProvider subjects={panelSubjects}>
      <div className="space-y-5">
        <PageHead
          eyebrow="Resource library"
          title="Resources"
          actions={<AddResourceButton />}
        />

        {/* The toolbar owns the whole card, so its own bottom rule would sit
            1px above the card border and read as a doubled line. */}
        <Card className="overflow-hidden [&>div]:border-b-0">
          <FilterToolbar
            searchPlaceholder="Search resources"
            pillParam="subject"
            pills={pills}
          />
        </Card>

        {sections.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-6 text-center text-sm text-ink-soft">
                No resources match this search.
              </p>
            </CardBody>
          </Card>
        ) : (
          sections.map(({ subject, resources }) => (
            <section key={subject.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <SubjectTile name={subject.name} />
                <h2 className="m-0 min-w-0 flex-1 text-[17px] font-extrabold tracking-[-0.01em] text-ink">
                  {subject.name}
                </h2>
                <AddToSubjectButton
                  subjectId={subject.id}
                  subjectName={subject.name}
                />
              </div>

              {resources.length === 0 ? (
                <Card>
                  <CardBody>
                    <p className="py-4 text-center text-[13px] text-ink-soft">
                      Nothing in this subject yet.
                    </p>
                  </CardBody>
                </Card>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((r) => (
                    <ResourceCard
                      key={r.id}
                      resource={r}
                      topicName={r.topicId ? (topicNameById.get(r.topicId) ?? null) : null}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>
    </AddResourceProvider>
  );
}

function SubjectTile({ name }: { name: string }) {
  const tokens = getAccentTokens(colorFamilyForSubject(name));
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-extrabold tracking-[0.02em] text-white"
      style={{ background: tokens.title }}
    >
      {subjectInitials(name)}
    </span>
  );
}

async function ResourceCard({
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
    fileFormatLabel(r),
    r.kind === "file" && r.sizeBytes ? formatBytes(r.sizeBytes) : null,
    `Added ${formatDateLong(r.createdAt)}`,
  ].filter(Boolean) as string[];

  return (
    <li className="flex">
      <Card className="flex w-full flex-col">
        <CardBody className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="brand">{resourceTypeLabel(r.type)}</Pill>
            {!r.isPublished && <Pill tone="warn">Not shared</Pill>}
          </div>

          <h3 className="m-0 break-words text-[14px] font-bold leading-snug text-ink">
            {r.title}
          </h3>

          {topicName && (
            <p className="m-0 break-words text-[12px] text-muted">{topicName}</p>
          )}

          <p className="m-0 mt-auto pt-1 text-[11px] text-muted">
            {meta.join(" · ")}
          </p>

          <div className="flex items-stretch gap-2 pt-1">
            <ShareToggle
              id={r.id}
              isShared={r.isPublished}
              title={r.title}
            />
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  r.kind === "link" ? `Open ${r.title}` : `Download ${r.title}`
                }
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              >
                {r.kind === "link" ? (
                  <ExternalLink className="h-4 w-4" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
              </a>
            )}
          </div>
        </CardBody>
      </Card>
    </li>
  );
}

/** Two-letter mark for the subject tile: initials of the first two words, or
 *  the first two letters of a single-word name. */
function subjectInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** The stored extension is the honest answer for an uploaded file; the MIME
 *  subtype covers rows promoted out of curriculum attachments, which carry a
 *  content type but not always a suffixed path. */
function fileFormatLabel(r: Resource): string | null {
  if (r.kind === "link") return "Link";
  const ext = r.storagePath?.split("/").pop()?.split(".").slice(1).pop();
  if (ext && ext.length <= 5) return ext.toUpperCase();
  const subtype = r.contentType?.split("/").pop();
  return subtype ? subtype.toUpperCase() : null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
