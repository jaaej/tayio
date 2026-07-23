import { asc } from "drizzle-orm";
import { FileText, Link2 as LinkIcon } from "lucide-react";
import { db } from "@/db/client";
import { subjects } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  listAllResourcesForAdmin,
  type AdminResourceFilter,
  type AdminResourceStatus,
} from "@/lib/resources";
import { RESOURCE_TYPES, resourceTypeLabel } from "@/lib/resource-types";
import { Card, Empty, PageHeader, Pill, type PillTone } from "@/components/admin/ui";
import { ResourceFilters } from "./_components/resource-filters";
import { ResourceRowActions } from "./_components/resource-row-actions";

export const dynamic = "force-dynamic";

const TYPE_VALUES = new Set(RESOURCE_TYPES.map((t) => t.value));
const STATUS_VALUES: AdminResourceStatus[] = ["live", "unpublished", "removed"];

const STATUS_LABEL: Record<AdminResourceStatus, string> = {
  live: "Live",
  unpublished: "Unpublished",
  removed: "Removed",
};

const STATUS_TONE: Record<AdminResourceStatus, PillTone> = {
  live: "good",
  unpublished: "warn",
  removed: "bad",
};

function resourceStatus(row: {
  isPublished: boolean;
  removedAt: Date | null;
}): AdminResourceStatus {
  if (row.removedAt) return "removed";
  return row.isPublished ? "live" : "unpublished";
}

type SearchParams = Promise<{
  subjectId?: string;
  type?: string;
  status?: string;
}>;

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const sp = await searchParams;

  const filter: AdminResourceFilter = {};
  if (sp.subjectId) filter.subjectId = sp.subjectId;
  if (sp.type && TYPE_VALUES.has(sp.type as (typeof RESOURCE_TYPES)[number]["value"])) {
    filter.type = sp.type as AdminResourceFilter["type"];
  }
  if (sp.status && STATUS_VALUES.includes(sp.status as AdminResourceStatus)) {
    filter.status = sp.status as AdminResourceStatus;
  }

  const [subjectList, rows] = await Promise.all([
    db.select({ id: subjects.id, name: subjects.name }).from(subjects).orderBy(asc(subjects.name)),
    listAllResourcesForAdmin(filter),
  ]);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="Resource library"
        title="Resource moderation"
        sub="Every resource across every subject, including unpublished and removed items."
        actions={
          <Pill tone="brand">
            {rows.length} {rows.length === 1 ? "resource" : "resources"}
          </Pill>
        }
      />

      <section className="rise" style={{ animationDelay: "60ms" }}>
        <ResourceFilters subjects={subjectList} />
      </section>

      <section className="rise" style={{ animationDelay: "100ms" }}>
        <Card>
          {rows.length === 0 ? (
            <Empty>No resources match this filter.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
                    <th className="text-left px-5 py-2.5">Title</th>
                    <th className="text-left px-5 py-2.5">Subject</th>
                    <th className="text-left px-5 py-2.5">Type</th>
                    <th className="text-left px-5 py-2.5">Source</th>
                    <th className="text-left px-5 py-2.5">Uploader</th>
                    <th className="text-left px-5 py-2.5">Status</th>
                    <th className="text-right px-5 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const status = resourceStatus(r);
                    const Icon = r.kind === "link" ? LinkIcon : FileText;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-line hover:bg-surface-2 transition-colors align-top"
                      >
                        <td className="px-5 py-3 text-[13px]">
                          <div className="flex items-center gap-1.5 font-bold text-ink">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                            {r.title}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[13px] text-ink-soft">
                          {r.subjectName}
                        </td>
                        <td className="px-5 py-3 text-[12px] text-ink-soft">
                          {resourceTypeLabel(r.type)}
                        </td>
                        <td className="px-5 py-3">
                          <Pill tone={r.source === "promoted" ? "info" : "default"}>
                            {r.source}
                          </Pill>
                        </td>
                        <td className="px-5 py-3 text-[13px] text-ink-soft">
                          {r.uploaderName}
                        </td>
                        <td className="px-5 py-3">
                          <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
                          {status === "removed" && r.removedReason && (
                            <div className="mt-1 text-[11px] text-muted max-w-[220px]">
                              “{r.removedReason}”
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <ResourceRowActions id={r.id} status={status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
