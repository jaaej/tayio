import { FileText, Link2 as LinkIcon } from "lucide-react";
import { db } from "@/db/client";
import { subjects } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  listAllResourcesForAdmin,
  type AdminResourceFilter,
  type AdminResourceStatus,
} from "@/lib/resources";
import { RESOURCE_TYPES } from "@/lib/resource-types";
import { ResourceTypeChip } from "@/components/resources/resource-type-chip";
import Link from "next/link";
import {
  Empty,
  GlassPanel,
  PageHeader,
  Pill,
  SubjectDot,
  type PillTone,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { UrlLabelledSelect } from "@/components/admin/ui/labelled-select";
import { ResourceRowActions } from "./_components/resource-row-actions";
import { AdminResourceTitle } from "./_components/resource-title";
import { httpHref } from "@/lib/safe-url";
import { distinctSubjects } from "@/lib/subject-label";

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

const STATUS_DOT: Record<AdminResourceStatus, string> = {
  live: "bg-[#16A34A]",
  unpublished: "bg-[#E8890C]",
  removed: "bg-[#D92D20]",
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

  // Status is applied in memory so the header counts reflect the subject and
  // type filters without a second query.
  const filter: AdminResourceFilter = {};
  if (sp.subjectId) filter.subjectId = sp.subjectId;
  if (sp.type && TYPE_VALUES.has(sp.type as (typeof RESOURCE_TYPES)[number]["value"])) {
    filter.type = sp.type as AdminResourceFilter["type"];
  }
  const statusFilter =
    sp.status && STATUS_VALUES.includes(sp.status as AdminResourceStatus)
      ? (sp.status as AdminResourceStatus)
      : null;

  const [subjectList, allRows] = await Promise.all([
    db
      .select({ id: subjects.id, name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .then(distinctSubjects),
    listAllResourcesForAdmin(filter),
  ]);
  const withStatus = allRows.map((row) => ({ ...row, status: resourceStatus(row) }));
  const counts = Object.fromEntries(
    STATUS_VALUES.map((status) => [
      status,
      withStatus.filter((row) => row.status === status).length,
    ]),
  ) as Record<AdminResourceStatus, number>;
  const rows = statusFilter
    ? withStatus.filter((row) => row.status === statusFilter)
    : withStatus;

  function statusHref(status: AdminResourceStatus) {
    const params = new URLSearchParams();
    if (sp.subjectId) params.set("subjectId", sp.subjectId);
    if (filter.type) params.set("type", filter.type);
    if (statusFilter !== status) params.set("status", status);
    const qs = params.toString();
    return qs ? `/admin/resources?${qs}` : "/admin/resources";
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Resource moderation"
        actions={
          <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
            {STATUS_VALUES.map((status) => {
              const active = statusFilter === status;
              return (
                <Link
                  key={status}
                  href={statusHref(status)}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex h-[34px] items-center gap-2 rounded-[11px] px-3 text-[13px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                    active ? "bg-ink text-white" : "bg-surface text-ink hover:bg-surface-2",
                  )}
                >
                  <span aria-hidden className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
                  {counts[status]} {STATUS_LABEL[status].toLowerCase()}
                </Link>
              );
            })}
          </nav>
        }
      />

      <GlassPanel
        title="Library"
        titleId="library-heading"
        action={
          <>
            <UrlLabelledSelect
              label="Subject"
              param="subjectId"
              options={[
                { value: "", label: "All subjects" },
                ...subjectList.map((s) => ({ value: s.id, label: s.label })),
              ]}
            />
            <UrlLabelledSelect
              label="Type"
              param="type"
              options={[
                { value: "", label: "All types" },
                ...RESOURCE_TYPES.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />
          </>
        }
        bodyClassName="overflow-x-auto"
      >
        {rows.length === 0 ? (
          <Empty>No resources match this filter.</Empty>
        ) : (
          <table className="w-full min-w-[880px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th scope="col" className="px-4 py-3 font-extrabold">Title</th>
                <th scope="col" className="px-2.5 py-3 font-extrabold">Subject</th>
                <th scope="col" className="px-2.5 py-3 font-extrabold">Type</th>
                <th scope="col" className="px-2.5 py-3 font-extrabold">Uploaded by</th>
                <th scope="col" className="px-2.5 py-3 font-extrabold">Status</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const Icon = r.kind === "link" ? LinkIcon : FileText;
                return (
                  <tr
                    key={r.id}
                    className="border-t border-line align-middle transition-colors hover:bg-[#F8F9FC]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-surface-3 text-ink-soft">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <AdminResourceTitle
                            resource={{
                              id: r.id,
                              title: r.title,
                              kind: r.kind,
                              href: r.kind === "link" ? httpHref(r.externalUrl) : null,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-3 text-ink">
                      <span className="inline-flex items-center gap-2">
                        <SubjectDot subject={r.subjectName} color={r.subjectColor} />
                        {r.subjectName}
                      </span>
                    </td>
                    <td className="px-2.5 py-3">
                      <ResourceTypeChip type={r.type} />
                    </td>
                    <td className="px-2.5 py-3 text-ink-soft">{r.uploaderName}</td>
                    <td className="px-2.5 py-3">
                      <div className="flex flex-col items-start gap-[3px]">
                        <Pill tone={STATUS_TONE[r.status]} dot>
                          {STATUS_LABEL[r.status]}
                        </Pill>
                        {r.status === "removed" && r.removedReason ? (
                          <span className="max-w-[220px] text-[12px] text-muted">
                            {r.removedReason}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ResourceRowActions id={r.id} status={r.status} title={r.title} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </GlassPanel>
    </div>
  );
}
