import { asc, inArray } from "drizzle-orm";
import { FileText, Link2 as LinkIcon } from "lucide-react";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { db } from "@/db/client";
import { subjects, subjectTopics, type Resource } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { httpHref } from "@/lib/safe-url";
import { listResourcesForSubjects, taughtSubjectIds } from "@/lib/resources";
import { resourceTypeLabel } from "@/lib/resource-types";
import { signResourceAttachment } from "@/lib/resources-storage";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { ResourceForm } from "./_components/resource-form";

export default async function TutorResourcesPage() {
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
        .select({ id: subjectTopics.id, subjectId: subjectTopics.subjectId, name: subjectTopics.name })
        .from(subjectTopics)
        .where(inArray(subjectTopics.subjectId, subjectIds))
        .orderBy(asc(subjectTopics.position))
    : [];
  const topicsBySubject = new Map<string, Array<{ id: string; name: string }>>();
  for (const t of topicRows) {
    if (!topicsBySubject.has(t.subjectId)) topicsBySubject.set(t.subjectId, []);
    topicsBySubject.get(t.subjectId)!.push({ id: t.id, name: t.name });
  }

  const resourcesBySubject = await Promise.all(
    subjectList.map((s) => listResourcesForSubjects([s.id])),
  );

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Resource library"
        title="Resources"
      />

      {subjectList.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-ink-soft text-center py-6">
              An admin needs to assign you to a class before you can add
              resources.
            </div>
          </CardBody>
        </Card>
      ) : (
        subjectList.map((subject, i) => {
          const tokens = getAccentTokens(colorFamilyForSubject(subject.name));
          const initial = subject.name.charAt(0).toUpperCase();
          const topics = topicsBySubject.get(subject.id) ?? [];
          const list = resourcesBySubject[i];

          return (
            <Card key={subject.id} className="overflow-hidden">
              <div
                className="px-4 py-3 flex items-center gap-3 border-b border-line"
                style={{
                  background: `linear-gradient(135deg, ${tokens.bgFrom} 0%, ${tokens.bgTo} 100%)`,
                }}
              >
                <div
                  className="h-9 w-9 rounded-[10px] grid place-items-center text-[14px] font-extrabold shrink-0"
                  style={{ background: tokens.title, color: "#fff" }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[14px] font-extrabold leading-tight truncate"
                    style={{ color: tokens.title }}
                  >
                    {subject.name}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.12em] font-bold"
                    style={{ color: tokens.meta }}
                  >
                    {list.length} resource{list.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <CardBody className="space-y-4">
                <ResourceList resources={list} />
                <ResourceForm subjectId={subject.id} topics={topics} tokens={tokens} />
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}

async function ResourceList({ resources }: { resources: Resource[] }) {
  if (resources.length === 0) {
    return (
      <div className="text-[13px] text-muted italic">
        No resources added for this subject yet.
      </div>
    );
  }
  const rows = await Promise.all(
    resources.map(async (r) => ({
      resource: r,
      href:
        r.kind === "link"
          ? httpHref(r.externalUrl)
          : r.storageBucket && r.storagePath
            ? await signResourceAttachment(r.storageBucket, r.storagePath)
            : null,
    })),
  );

  return (
    <ul className="divide-y divide-line rounded-[12px] border border-line overflow-hidden">
      {rows.map(({ resource: r, href }) => {
        const Icon = r.kind === "link" ? LinkIcon : FileText;
        return (
          <li
            key={r.id}
            className="flex items-center gap-3 px-4 py-2.5 bg-surface"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink truncate">
                {r.title}
              </div>
              <div className="text-[11px] text-muted">
                {resourceTypeLabel(r.type)}
              </div>
            </div>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 hover:text-brand-700"
              >
                View →
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
