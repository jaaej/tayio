import { Card, CardLabel } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Reports
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Coming in <span className="font-display">Phase 3</span>.
        </h1>
      </header>
      <Card>
        <CardLabel>Planned reports</CardLabel>
        <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm text-ink-soft">
          {[
            "Attendance rate",
            "Homework completion rate",
            "Tutor note completion",
            "Revenue & overdue payments",
            "Class capacity",
            "Student retention / churn risk",
            "Tutor workload",
            "Students at risk",
          ].map((item) => (
            <li key={item} className="py-1.5">
              · {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
