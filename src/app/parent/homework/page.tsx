import { ClipboardList, Clock, AlertTriangle } from "lucide-react";
import { Card, StatTile, PageHeader, Empty } from "@/components/parent/ui";
import { SubjectPill } from "@/components/data/subject-pill";
import { requireRole } from "@/lib/auth";
import { formatDueDate, formatScore } from "@/lib/format";
import { HOMEWORK_STATUS_LABEL, HOMEWORK_STATUS_STYLE } from "@/lib/status";
import { getHomework, resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { StatusPill } from "../_components/status-pill";
import { Tabs, type TabItem } from "../_components/tabs";
import { Table, Th, Td, Tr } from "../_components/table";
import { distinctSubjects } from "@/lib/subject-label";

type SearchParams = Promise<{ child?: string; subject?: string }>;

/** The tab for homework outside a class. */
const OTHER = "other";

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
        />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const allRows = await getHomework(selected.id);

  // One tab per subject, by id: two subjects can share a name, and then their
  // labels add the year level. Homework outside a class sits under "Other".
  const subjectTabs = [
    ...distinctSubjects(
      allRows.flatMap((r) =>
        r.subjectId && r.subjectName
          ? [{ id: r.subjectId, name: r.subjectName, yearLevel: r.subjectYearLevel }]
          : [],
      ),
    ),
    ...(allRows.some((r) => !r.subjectId) ? [{ id: OTHER, label: "Other" }] : []),
  ];
  const activeTab = subjectTabs.find((t) => t.id === subjectFilter) ?? null;

  const rows = activeTab
    ? allRows.filter((r) => (r.subjectId ?? OTHER) === activeTab.id)
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
    { label: "All", href: base, active: !activeTab },
    ...subjectTabs.map((t) => ({
      label: t.label,
      href: `${base}&subject=${encodeURIComponent(t.id)}`,
      active: activeTab?.id === t.id,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${selected.firstName}'s homework`}
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            students={children}
            selectedId={selected.id}
            basePath="/parent/homework"
          />
        </div>
      )}

      <section
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 rise"
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

      {subjectTabs.length > 0 && (
        <div className="rise overflow-x-auto" style={{ animationDelay: "50ms" }}>
          <Tabs items={tabs} />
        </div>
      )}

      <div className="rise" style={{ animationDelay: "70ms" }}>
        {rows.length === 0 ? (
          <Card>
            <Empty>
              {activeTab
                ? `No ${activeTab.label} homework for ${selected.firstName}.`
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
                        color={r.subjectName ? r.subjectColor : null}
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
                      {r.score !== null ? formatScore(r.score) : "-"}
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
