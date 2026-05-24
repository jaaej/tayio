import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { StatusBadge } from "../_components/badge";
import {
  formatDueDate,
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "../_lib/format";
import { getStudentHomework, type HomeworkRow } from "../_lib/queries";

const OPEN_STATUSES = new Set(["not_started", "viewed", "resubmission_requested"]);
const DONE_STATUSES = new Set(["submitted", "marked", "returned"]);

export default async function HomeworkListPage() {
  const user = await requireRole("student");
  const rows = await getStudentHomework(user.id);

  const open: HomeworkRow[] = [];
  const overdue: HomeworkRow[] = [];
  const done: HomeworkRow[] = [];
  const now = new Date();

  for (const r of rows) {
    if (r.status === "late") {
      overdue.push(r);
    } else if (OPEN_STATUSES.has(r.status)) {
      if (r.dueDate < now) overdue.push(r);
      else open.push(r);
    } else if (DONE_STATUSES.has(r.status)) {
      done.push(r);
    } else {
      open.push(r);
    }
  }

  return (
    <div className="space-y-10">
      <header className="rise">
        <CardLabel>Homework</CardLabel>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Your homework
        </h1>
        <p className="mt-3 text-ink-soft max-w-xl">
          Open tasks first, then anything overdue, then completed work.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No homework assigned yet.
          </div>
        </Card>
      ) : (
        <div className="space-y-10">
          <Section title="Open" items={open} emptyLabel="Nothing open." />
          <Section title="Overdue" items={overdue} emptyLabel="No overdue items." tone="warn" />
          <Section title="Completed" items={done} emptyLabel="No completed work yet." />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: HomeworkRow[];
  emptyLabel: string;
  tone?: "warn";
}) {
  return (
    <section className="rise">
      <div className="flex items-baseline justify-between mb-3">
        <div
          className={
            tone === "warn"
              ? "text-[11px] uppercase tracking-[0.2em] text-amber-800"
              : "text-[11px] uppercase tracking-[0.2em] text-muted"
          }
        >
          {title}
        </div>
        <div className="text-xs text-muted">{items.length}</div>
      </div>
      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? (
          <div className="px-6 py-6 text-sm text-ink-soft">{emptyLabel}</div>
        ) : (
          <ul className="divide-y divide-hairline">
            {items.map((hw) => (
              <li key={hw.homeworkId}>
                <Link
                  href={`/student/homework/${hw.homeworkId}`}
                  className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:gap-6 px-6 py-4 items-baseline hover:bg-brand-50/60 transition-colors"
                >
                  <div>
                    <div className="text-sm text-ink">{hw.title}</div>
                    <div className="text-xs text-ink-soft">
                      {hw.className ?? "Independent task"}
                    </div>
                  </div>
                  <div className="text-xs text-ink-soft md:text-right">
                    Due {formatDueDate(hw.dueDate)}
                  </div>
                  <div className="md:justify-self-end">
                    <StatusBadge
                      label={HOMEWORK_STATUS_LABEL[hw.status] ?? hw.status}
                      className={HOMEWORK_STATUS_STYLE[hw.status]}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
