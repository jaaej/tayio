import { ClipboardList, Clock, AlertTriangle } from "lucide-react";
import { Card, StatTile, PageHeader, Empty } from "@/components/parent/ui";
import { SubjectPill } from "@/components/data/subject-pill";
import { requireRole } from "@/lib/auth";
import { formatDueDate } from "@/lib/format";
import { HOMEWORK_STATUS_LABEL, HOMEWORK_STATUS_STYLE } from "@/lib/status";
import { getHomework, resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { StatusPill } from "../_components/status-pill";
import { Tabs, type TabItem } from "../_components/tabs";
import { Table, Th, Td, Tr } from "../_components/table";

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
        <PageHeader
          title="Homework"
          sub="Your children's homework and their submission status."
        />
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
  const subjectNames = Array.from(subjectCounts.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  const rows = subjectFilter
    ? allRows.filter(
        (r) => (r.subjectName ?? r.className ?? "Other") === subjectFilter,
      )
    : allRows;

  const total = rows.length;
  const completed = rows.filter(
    (r) =>
      r.status === "submitted" || r.status === "marked" || r.status === "returned",
  ).length;
  const outstanding = rows.filter(
    (r) =>
      r.status === "not_started" ||
      r.status === "viewed" ||
      r.status === "resubmission_requested",
  ).length;
  const late = rows.filter((r) => r.status === "late").length;

  const base = `/parent/homework?child=${selected.id}`;
  const tabs: TabItem[] = [
    { label: "All", href: base, active: !subjectFilter },
    ...subjectNames.map((s) => ({
      label: s,
      href: `${base}&subject=${encodeURIComponent(s)}`,
      active: subjectFilter === s,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${selected.firstName}'s homework`}
        sub="Tasks set by the tutor and their submission status."
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
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "30ms" }}
      >
        <StatTile
          label="Completion"
          value={total > 0 ? `${completed}/${total}` : "-"}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="sky"
          accent
          delta="Submitted or marked"
          deltaTone={total > 0 && completed / total >= 0.9 ? "up" : "flat"}
        />
        <StatTile
          label="Outstanding"
          value={outstanding.toString()}
          icon={<Clock className="h-5 w-5" />}
          tone={outstanding === 0 ? "good" : "warn"}
          accent
          delta="Not yet submitted"
          deltaTone={outstanding === 0 ? "up" : "down"}
        />
        <StatTile
          label="Late"
          value={late.toString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={late === 0 ? "good" : "coral"}
          accent
          delta="Past due date"
          deltaTone={late === 0 ? "up" : "down"}
        />
      </section>

      {subjectNames.length > 0 && (
        <div className="rise overflow-x-auto" style={{ animationDelay: "50ms" }}>
          <Tabs items={tabs} />
        </div>
      )}

      <div className="rise" style={{ animationDelay: "70ms" }}>
        {rows.length === 0 ? (
          <Card>
            <Empty>
              {subjectFilter
                ? `No ${subjectFilter} homework for ${selected.firstName}.`
                : `No homework has been assigned to ${selected.firstName} yet.`}
            </Empty>
          </Card>
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Task</Th>
                  <Th>Subject</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Score</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.homeworkId}>
                    <Td>
                      <div className="font-bold text-ink">{r.title}</div>
                      {r.feedback && (
                        <div className="mt-1 text-xs text-muted line-clamp-1 max-w-md">
                          <span className="font-bold text-ink-soft">Tutor:</span>{" "}
                          {r.feedback}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <SubjectPill
                        name={r.subjectName ?? r.className ?? "Other"}
                      />
                    </Td>
                    <Td className="text-muted whitespace-nowrap">
                      {formatDueDate(r.dueDate)}
                    </Td>
                    <Td>
                      <StatusPill
                        label={HOMEWORK_STATUS_LABEL[r.status] ?? r.status}
                        className={HOMEWORK_STATUS_STYLE[r.status]}
                      />
                    </Td>
                    <Td className="text-right tabular-nums font-extrabold text-ink">
                      {r.score !== null ? r.score : "-"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
