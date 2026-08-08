import Link from "next/link";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { ScoreBadge } from "@/components/data/score-badge";
import { StatTile } from "@/components/data/stat-tile";
import { StatusBadge } from "@/components/data/status-badge";
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

export default async function HomeworkListPage() {
  const user = await requireRole("student");
  const rows = await getStudentHomework(user.id);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(startOfToday);
  weekFromNow.setDate(startOfToday.getDate() + 7);

  // Bucket
  const overdue: HomeworkRow[] = [];
  const openSoon: HomeworkRow[] = []; // due within 7 days
  const openLater: HomeworkRow[] = []; // due beyond 7 days
  const submitted: HomeworkRow[] = [];
  const marked: HomeworkRow[] = [];

  for (const r of rows) {
    if (r.status === "marked" || r.status === "returned") {
      marked.push(r);
      continue;
    }
    if (r.status === "submitted") {
      submitted.push(r);
      continue;
    }
    if (r.status === "late") {
      overdue.push(r);
      continue;
    }
    if (OPEN_STATUSES.has(r.status)) {
      if (r.dueDate < startOfToday) overdue.push(r);
      else if (r.dueDate < weekFromNow) openSoon.push(r);
      else openLater.push(r);
      continue;
    }
    // any other status - treat as open
    openSoon.push(r);
  }

  // Sort each bucket
  overdue.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  openSoon.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  openLater.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  submitted.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  marked.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

  const total = rows.length;
  const done = submitted.length + marked.length;
  const openCount = overdue.length + openSoon.length + openLater.length;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Homework"
        title="Your homework"
      />

      {/* Stat strip */}
      <section
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" } as React.CSSProperties}
      >
        <StatTile
          label="Open"
          value={openCount.toString()}
          accent={overdue.length > 0 ? "warn" : openCount > 0 ? "brand" : "muted"}
          sub={overdue.length > 0 ? `${overdue.length} overdue` : undefined}
        />
        <StatTile
          label="Due this week"
          value={openSoon.length.toString()}
          accent={openSoon.length > 0 ? "brand" : "muted"}
        />
        <StatTile
          label="Marked this term"
          value={marked.length.toString()}
          accent={marked.length > 0 ? "success" : "muted"}
        />
      </section>

      {total === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted">
              No homework assigned yet.
            </div>
          </CardBody>
        </Card>
      ) : (
        <div
          className="space-y-5 rise"
          style={{ animationDelay: "100ms" } as React.CSSProperties}
        >
          <Card>
            <CardBody>
              <Section
                title="Overdue"
                tone="warn"
                items={overdue}
                today={startOfToday}
                emptyLabel="Nothing overdue - nice."
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-8">
              <Section
                title="Due This Week"
                items={openSoon}
                today={startOfToday}
                emptyLabel="Nothing due this week."
              />
              <Section
                title="Submitted"
                tone="muted"
                items={submitted}
                today={startOfToday}
                emptyLabel="No submissions yet."
              />
              <MarkedSection items={marked} />
            </CardBody>
          </Card>
          {openLater.length > 0 && (
            <Card>
              <CardBody>
                <Section
                  title="Coming Up"
                  items={openLater}
                  today={startOfToday}
                  emptyLabel="Nothing coming up."
                />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function MarkedSection({ items }: { items: HomeworkRow[] }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 px-1">
        <div className="text-[11px] uppercase tracking-[0.2em] text-ink-soft font-medium">
          Marked
        </div>
        <div className="text-xs text-muted tabular-nums">{items.length}</div>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-ink-soft px-1">Nothing marked yet.</div>
      ) : (
        <MarkedList items={items} />
      )}
    </section>
  );
}

function Section({
  title,
  items,
  today,
  emptyLabel,
  tone,
  showScore,
}: {
  title: string;
  items: HomeworkRow[];
  today: Date;
  emptyLabel: string;
  tone?: "warn" | "muted";
  showScore?: boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 px-1">
        <div
          className={
            tone === "warn"
              ? "text-[11px] uppercase tracking-[0.2em] text-amber-800 font-medium"
              : tone === "muted"
                ? "text-[11px] uppercase tracking-[0.2em] text-muted"
                : "text-[11px] uppercase tracking-[0.2em] text-ink-soft font-medium"
          }
        >
          {title}
        </div>
        <div className="text-xs text-muted tabular-nums">{items.length}</div>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-ink-soft px-1">{emptyLabel}</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((h) => (
            <HomeworkCard
              key={h.homeworkId}
              hw={h}
              today={today}
              muted={tone === "muted"}
              showScore={showScore}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HomeworkCard({
  hw,
  today,
  muted,
  showScore,
}: {
  hw: HomeworkRow;
  today: Date;
  muted?: boolean;
  showScore?: boolean;
}) {
  // Subject family from class name (we don't get subject name in HomeworkRow,
  // but className typically encodes the subject - "Year 11 Chemistry" etc.)
  const family = colorFamilyForSubject(hw.className ?? hw.title);
  const tokens = getAccentTokens(family);

  const isOpen =
    hw.status === "not_started" ||
    hw.status === "viewed" ||
    hw.status === "resubmission_requested" ||
    hw.status === "late";

  const due = hw.dueDate;
  const daysUntil = Math.round(
    (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  return (
    <Link
      href={`/student/homework/${hw.homeworkId}`}
      className="group relative block rounded-2xl border p-5 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-18px_rgba(29,41,81,0.32)]"
      style={
        muted
          ? {
              background: "#ffffff",
              borderColor: "rgba(29,41,81,0.1)",
            }
          : {
              // Layer the tint over solid white so cards stay readable against the periwinkle field
              background: `linear-gradient(140deg, ${tokens.bgFrom} 0%, ${tokens.bgTo} 100%), #ffffff`,
              borderColor: tokens.ring,
            }
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] uppercase tracking-[0.16em] font-semibold truncate"
            style={{ color: muted ? "rgba(29,41,81,0.5)" : tokens.meta }}
          >
            {hw.className ?? "Independent task"}
          </div>
          <div
            className="mt-1 text-lg font-semibold leading-tight tracking-tight line-clamp-2"
            style={{ color: muted ? "var(--ink)" : tokens.title }}
          >
            {hw.title}
          </div>
        </div>
        {showScore && hw.score && (
          <ScoreBadge score={hw.score} />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <DueDateLabel daysUntil={daysUntil} due={due} isOpen={isOpen} />
        <StatusBadge
          label={HOMEWORK_STATUS_LABEL[hw.status] ?? hw.status}
          className={HOMEWORK_STATUS_STYLE[hw.status]}
        />
      </div>

      {isOpen && (
        <div
          className="mt-5 pt-4 border-t flex items-center justify-between text-xs"
          style={{
            borderColor: muted ? "rgba(29,41,81,0.08)" : tokens.ring,
            color: muted ? "rgba(29,41,81,0.6)" : tokens.meta,
          }}
        >
          <span className="uppercase tracking-[0.16em] font-medium">
            Open and submit
          </span>
          <span
            className="text-base transition-transform group-hover:translate-x-0.5"
            style={{ color: muted ? "var(--brand-700)" : tokens.arrow }}
          >
            →
          </span>
        </div>
      )}
    </Link>
  );
}

function DueDateLabel({
  daysUntil,
  due,
  isOpen,
}: {
  daysUntil: number;
  due: Date;
  isOpen: boolean;
}) {
  let label: string;
  let toneClass: string;

  if (!isOpen) {
    // Past or completed - just show the date softly
    label = `Due ${formatDueDate(due)}`;
    toneClass = "text-ink-soft";
  } else if (daysUntil < 0) {
    const overdueDays = -daysUntil;
    label =
      overdueDays === 1 ? "OVERDUE BY 1 DAY" : `OVERDUE BY ${overdueDays} DAYS`;
    toneClass = "text-rose-700 font-semibold";
  } else if (daysUntil === 0) {
    label = "DUE TODAY";
    toneClass = "text-rose-700 font-semibold";
  } else if (daysUntil === 1) {
    label = "DUE TOMORROW";
    toneClass = "text-amber-800 font-semibold";
  } else if (daysUntil <= 7) {
    label = `Due in ${daysUntil} days`;
    toneClass = "text-amber-800 font-medium";
  } else {
    label = `Due ${formatDueDate(due)}`;
    toneClass = "text-ink-soft";
  }

  return (
    <span
      className={`text-[11px] uppercase tracking-[0.14em] tabular-nums ${toneClass}`}
    >
      {label}
    </span>
  );
}
