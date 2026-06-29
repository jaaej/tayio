import {
  BarChart3,
  CalendarCheck,
  CheckSquare,
  DollarSign,
} from "lucide-react";
import { Card, CardHead, Pill, StatTile, PageHeader } from "@/components/admin/ui";

const PLANNED_REPORTS = [
  "Attendance rate",
  "Homework completion rate",
  "Tutor note completion",
  "Revenue & overdue payments",
  "Class capacity",
  "Student retention / churn risk",
  "Tutor workload",
  "Students at risk",
];

export default function ReportsPage() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="Reports"
        title="Reports"
        sub="Operational reporting lands in Phase 3 — the metrics below are the planned dashboard."
        actions={<Pill tone="info">Coming in Phase 3</Pill>}
      />

      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise opacity-60"
        style={{ animationDelay: "40ms" }}
        aria-hidden
      >
        <StatTile
          label="Attendance rate"
          value="—"
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="brand"
          accent
        />
        <StatTile
          label="Homework completion"
          value="—"
          icon={<CheckSquare className="h-5 w-5" />}
          tone="sky"
          accent
        />
        <StatTile
          label="Revenue"
          value="—"
          icon={<DollarSign className="h-5 w-5" />}
          tone="mint"
          accent
        />
        <StatTile
          label="Class capacity"
          value="—"
          icon={<BarChart3 className="h-5 w-5" />}
          tone="grape"
          accent
        />
      </section>

      <Card className="rise">
        <CardHead
          title="Planned reports"
          action={<Pill tone="default">{PLANNED_REPORTS.length} planned</Pill>}
        />
        <div className="divide-y divide-line">
          {PLANNED_REPORTS.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0"
                aria-hidden
              />
              <div className="text-[13px] text-ink-soft">{item}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
