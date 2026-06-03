import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/status-badge";
import { ScoreBadge } from "@/components/data/score-badge";
import { StatTile } from "@/components/data/stat-tile";
import { SubjectCard } from "@/components/data/subject-card";
import { requireRole } from "@/lib/auth";
import { formatDueDate } from "@/lib/format";
import {
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "@/lib/status";
import { getHomework, resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { SectionHeader } from "../_components/section-header";
import { PageHeader } from "../_components/page-header";
import Link from "next/link";

type SearchParams = Promise<{ child?: string; subject?: string }>;

export default async function ParentHomeworkPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested, subject: subjectFilter } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  if (!selected) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Homework" title="Homework" />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const allRows = await getHomework(selected.id);

  const subjectCounts = new Map<string, number>();
  for (const r of allRows) {
    const name = r.subjectName ?? r.className ?? "Other";
    subjectCounts.set(name, (subjectCounts.get(name) ?? 0) + 1);
  }
  const subjectList = Array.from(subjectCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = subjectFilter
    ? allRows.filter(
        (r) => (r.subjectName ?? r.className ?? "Other") === subjectFilter,
      )
    : allRows;

  const total = rows.length;
  const completed = rows.filter(
    (r) => r.status === "submitted" || r.status === "marked" || r.status === "returned",
  ).length;
  const outstanding = rows.filter(
    (r) =>
      r.status === "not_started" ||
      r.status === "viewed" ||
      r.status === "resubmission_requested",
  ).length;
  const late = rows.filter((r) => r.status === "late").length;

  const baseQs = new URLSearchParams();
  if (selected.id) baseQs.set("child", selected.id);
  const clearHref = `/parent/homework?${baseQs.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Homework"
        title={`${selected.firstName}'s homework`}
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/homework"
          />
        </div>
      )}

      <section
        className="grid grid-cols-2 lg:grid-cols-3 gap-4 rise"
        style={{ animationDelay: "30ms" }}
      >
        <StatTile
          label="Completion"
          value={total > 0 ? `${completed} / ${total}` : "—"}
          accent={
            total === 0
              ? "muted"
              : completed / total >= 0.9
                ? "success"
                : completed / total >= 0.6
                  ? "brand"
                  : "warn"
          }
        />
        <StatTile
          label="Outstanding"
          value={outstanding.toString()}
          accent={outstanding === 0 ? "success" : "warn"}
        />
        <StatTile
          label="Late"
          value={late.toString()}
          accent={late === 0 ? "success" : "warn"}
        />
      </section>

      {subjectList.length > 0 && (
        <section
          className="rise"
          style={{ animationDelay: "60ms" }}
          aria-label="Filter by subject"
        >
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted mb-3">
            Filter by Subject
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {subjectList.map((s) => {
              const qs = new URLSearchParams(baseQs);
              qs.set("subject", s.name);
              const active = subjectFilter === s.name;
              return (
                <SubjectCard
                  key={s.name}
                  href={`/parent/homework?${qs.toString()}`}
                  subject={s.name}
                  meta={`${s.count} item${s.count === 1 ? "" : "s"}`}
                  badge={active ? { label: "Showing", tone: "success" } : undefined}
                />
              );
            })}
          </div>
          {subjectFilter && (
            <div className="mt-3">
              <Link
                href={clearHref}
                className="text-xs text-brand-700 hover:underline"
              >
                ← Show all subjects
              </Link>
            </div>
          )}
        </section>
      )}

      <div className="rise" style={{ animationDelay: "80ms" }}>
        {rows.length === 0 ? (
          <Card>
            <p className="text-ink-soft">
              {subjectFilter
                ? `No ${subjectFilter} homework for ${selected.firstName}.`
                : `No homework has been assigned to ${selected.firstName} yet.`}
            </p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title={subjectFilter ? `${subjectFilter} Homework` : "All Homework"}
              right={`${rows.length} item${rows.length === 1 ? "" : "s"}`}
            />
            <div className="divide-y divide-hairline/60">
              {rows.map((r) => (
                <div key={r.homeworkId} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                        {r.subjectName ?? r.className ?? "Homework"}
                      </div>
                      <h3 className="mt-1 text-lg text-ink truncate">{r.title}</h3>
                      <div className="mt-1.5 text-xs text-muted">
                        Due {formatDueDate(r.dueDate)}
                        {r.submittedAt
                          ? ` · Submitted ${formatDueDate(r.submittedAt)}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge
                        label={HOMEWORK_STATUS_LABEL[r.status] ?? r.status}
                        className={HOMEWORK_STATUS_STYLE[r.status]}
                      />
                      {r.score !== null ? <ScoreBadge score={r.score} /> : null}
                    </div>
                  </div>
                  {r.feedback ? (
                    <div className="mt-4 border-t border-hairline/60 pt-3 text-sm text-ink-soft">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-muted mr-2">
                        Tutor
                      </span>
                      {r.feedback}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
