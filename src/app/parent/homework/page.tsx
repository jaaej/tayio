import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/status-badge";
import { ScoreBadge } from "@/components/data/score-badge";
import { StatTile } from "@/components/data/stat-tile";
import { requireRole } from "@/lib/auth";
import { formatDueDate } from "@/lib/format";
import {
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "@/lib/status";
import { getHomework, resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { SectionHeader } from "../_components/section-header";

type SearchParams = Promise<{ child?: string }>;

export default async function ParentHomeworkPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const rows = await getHomework(selected.id);

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

  return (
    <div className="space-y-6">
      <Header subtitle={selected.firstName} />

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
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Completion"
          value={total > 0 ? `${completed} / ${total}` : "—"}
          sub={
            total > 0
              ? `${Math.round((completed / total) * 100)}% complete`
              : "No homework assigned"
          }
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
          sub={outstanding === 0 ? "All caught up" : "Awaiting submission"}
          accent={outstanding === 0 ? "success" : "warn"}
        />
        <StatTile
          label="Late"
          value={late.toString()}
          sub={late === 0 ? "Never late" : "Submitted after due"}
          accent={late === 0 ? "success" : "warn"}
        />
      </section>

      <div className="rise" style={{ animationDelay: "80ms" }}>
        {rows.length === 0 ? (
          <Card>
            <p className="text-ink-soft">
              No homework has been assigned to {selected.firstName} yet.
            </p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <SectionHeader title="All homework" />
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

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rise">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600" />
        Homework
      </div>
      <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
        {subtitle ? `${subtitle}'s homework` : "Homework"}
      </h1>
    </header>
  );
}
