import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardList } from "lucide-react";
import { Card, CardBody, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { StatTile } from "@/components/student/kpi";
import { StatusBadge } from "@/components/data/status-badge";
import { FilterToolbar, type FilterPill } from "@/components/ui/filter-toolbar";
import { requireRole } from "@/lib/auth";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
import { formatDueDate } from "@/lib/format";
import {
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "@/lib/status";
import { MarkedList } from "../_components/marked-list";
import { getStudentHomework, type HomeworkRow } from "../_lib/queries";

const OPEN_STATUSES = new Set([
  "not_started",
  "viewed",
  "resubmission_requested",
]);

type Bucket =
  | "overdue"
  | "due-this-week"
  | "coming-up"
  | "submitted"
  | "marked";

/** Queue order: the most urgent work leads, the finished work trails. */
const QUEUE_ORDER: Bucket[] = [
  "overdue",
  "due-this-week",
  "coming-up",
  "submitted",
];

const PILLS: FilterPill[] = [
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "due-this-week", label: "Due this week" },
  { value: "submitted", label: "Submitted" },
  { value: "coming-up", label: "Coming up" },
];

function bucketOf(r: HomeworkRow, startOfToday: Date, weekFromNow: Date): Bucket {
  if (r.status === "marked" || r.status === "returned") return "marked";
  if (r.status === "submitted") return "submitted";
  if (r.status === "late") return "overdue";
  if (OPEN_STATUSES.has(r.status)) {
    if (r.dueDate < startOfToday) return "overdue";
    if (r.dueDate < weekFromNow) return "due-this-week";
    return "coming-up";
  }
  // any other status - treat as open
  return "due-this-week";
}

function matches(r: HomeworkRow, query: string): boolean {
  if (!query) return true;
  return (
    r.title.toLowerCase().includes(query) ||
    (r.className ?? "").toLowerCase().includes(query)
  );
}

export default async function HomeworkListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const activeView = PILLS.some((p) => p.value && p.value === sp.view)
    ? (sp.view as Bucket)
    : "";

  const user = await requireRole("student");
  const rows = await getStudentHomework(user.id);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(startOfToday);
  weekFromNow.setDate(startOfToday.getDate() + 7);

  const bucketed = rows.map((row) => ({
    row,
    bucket: bucketOf(row, startOfToday, weekFromNow),
  }));

  const countOf = (b: Bucket) =>
    bucketed.filter((e) => e.bucket === b).length;
  const overdueCount = countOf("overdue");
  const dueThisWeekCount = countOf("due-this-week");
  const markedCount = countOf("marked");
  const openCount = overdueCount + dueThisWeekCount + countOf("coming-up");

  // One list, priority-ordered, so the work that matters now leads. Within a
  // bucket the open work reads soonest-first and the finished work newest-first.
  const queue = bucketed
    .filter((e) => e.bucket !== "marked")
    .sort((a, b) => {
      const byBucket =
        QUEUE_ORDER.indexOf(a.bucket) - QUEUE_ORDER.indexOf(b.bucket);
      if (byBucket !== 0) return byBucket;
      return a.bucket === "submitted"
        ? b.row.dueDate.getTime() - a.row.dueDate.getTime()
        : a.row.dueDate.getTime() - b.row.dueDate.getTime();
    })
    .filter((e) => !activeView || e.bucket === activeView)
    .filter((e) => matches(e.row, query));

  // Marked work is a reading surface, not a queue: its rows expand in place to
  // show the tutor's feedback. It answers to the search box, but a pill picks a
  // slice of the active queue, so it steps aside while one is on.
  const marked = bucketed
    .filter((e) => e.bucket === "marked")
    .map((e) => e.row)
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())
    .filter((r) => matches(r, query));

  return (
    <div className="space-y-5">
      <PageHead eyebrow="Homework" title="Your homework" />

      <section
        className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 rise"
        style={{ animationDelay: "40ms" } as React.CSSProperties}
      >
        <StatTile
          label="Open"
          value={openCount}
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          tone={overdueCount > 0 ? "warn" : "brand"}
          accent
          sub={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
          subTone={overdueCount > 0 ? "down" : "flat"}
        />
        <StatTile
          label="Due this week"
          value={dueThisWeekCount}
          icon={<CalendarClock className="h-5 w-5" aria-hidden />}
          tone="sky"
          accent
        />
        <StatTile
          label="Marked this term"
          value={markedCount}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
          tone="good"
          accent
        />
      </section>

      {rows.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted">No homework assigned yet.</div>
          </CardBody>
        </Card>
      ) : (
        <div
          className="space-y-5 rise"
          style={{ animationDelay: "100ms" } as React.CSSProperties}
        >
          <Card className="overflow-hidden">
            {/* Search and the queue slices live at the top of the table's own
                card: they are the table's controls, not a separate surface to
                look in. */}
            <FilterToolbar
              searchPlaceholder="Search homework"
              pillParam="view"
              pills={PILLS}
            />
            {/* The table always renders under the toolbar - hiding it on an
                empty result would strip away the only controls that can undo
                the filter. */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-2">
                    <Th>Homework</Th>
                    <Th>Class</Th>
                    <Th>Due</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <p className="py-6 text-center text-sm text-ink-soft">
                          No homework matches these filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    queue.map(({ row, bucket }) => (
                      <tr
                        key={row.homeworkId}
                        className="border-b border-line transition-colors hover:bg-surface-2"
                      >
                        <Td>
                          {/* Bounded so a long title truncates instead of
                              pushing due date and status off the far edge; the
                              full value stays reachable as a tooltip. */}
                          <Link
                            href={`/student/homework/${row.homeworkId}`}
                            className="inline-flex min-h-9 max-w-[260px] items-center rounded-[6px] font-bold text-ink transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                          >
                            <span className="truncate" title={row.title}>
                              {row.title}
                            </span>
                          </Link>
                        </Td>
                        <Td>
                          {row.className ? (
                            <ClassPill name={row.className} />
                          ) : (
                            <span className="text-muted">Independent task</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap">
                          <DueCell
                            due={row.dueDate}
                            today={startOfToday}
                            bucket={bucket}
                          />
                        </Td>
                        <Td>
                          <StatusBadge
                            label={
                              HOMEWORK_STATUS_LABEL[row.status] ?? row.status
                            }
                            className={HOMEWORK_STATUS_STYLE[row.status]}
                          />
                        </Td>
                        <Td className="text-right">
                          <Link
                            href={`/student/homework/${row.homeworkId}`}
                            aria-label={`Open ${row.title}`}
                            className="inline-flex min-h-9 items-center rounded-[8px] px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-600 transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                          >
                            Open →
                          </Link>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {!activeView && marked.length > 0 && (
            <Card>
              <CardHead title="Marked" />
              <CardBody>
                <MarkedList items={marked} />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3 align-middle text-[13px] text-ink ${className}`}>
      {children}
    </td>
  );
}

function ClassPill({ name }: { name: string }) {
  const tokens = getAccentTokens(colorFamilyForSubject(name));
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-bold leading-none whitespace-nowrap"
      style={{ background: tokens.pillBg, color: tokens.pillText }}
    >
      {name}
    </span>
  );
}

/**
 * The date always shows; urgency is spelled out underneath it so "overdue" and
 * "due today" survive being read at a glance without relying on colour alone.
 */
function DueCell({
  due,
  today,
  bucket,
}: {
  due: Date;
  today: Date;
  bucket: Bucket;
}) {
  const days = Math.round(
    (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  let note: string | null = null;
  let noteClass = "";
  if (bucket === "overdue") {
    noteClass = "text-bad";
    note =
      days >= 0
        ? "Overdue"
        : days === -1
          ? "Overdue by 1 day"
          : `Overdue by ${-days} days`;
  } else if (bucket === "due-this-week") {
    if (days <= 0) {
      note = "Due today";
      noteClass = "text-bad";
    } else if (days === 1) {
      note = "Due tomorrow";
      noteClass = "text-warn";
    } else {
      note = `In ${days} days`;
      noteClass = "text-warn";
    }
  }

  return (
    <span className="block">
      <span className="block tabular-nums">{formatDueDate(due)}</span>
      {note && (
        <span className={`mt-0.5 block text-[11px] font-bold ${noteClass}`}>
          {note}
        </span>
      )}
    </span>
  );
}
