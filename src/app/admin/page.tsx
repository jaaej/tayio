import { Card, CardLabel, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  return (
    <div className="space-y-12">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Operations · Term 2 · Week 6
        </div>
        <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
          The <span className="font-display italic">business</span> at a glance.
        </h1>
      </header>

      <section
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 rise"
        style={{ animationDelay: "80ms" }}
      >
        {[
          ["Active students", "184", "+6 this week"],
          ["Classes this week", "47", "92% capacity"],
          ["Overdue invoices", "3", "$1,240 outstanding"],
          ["Notes pending", "11", "From last 7 days"],
        ].map(([label, value, sub]) => (
          <Card key={label}>
            <CardLabel>{label}</CardLabel>
            <CardTitle>{value}</CardTitle>
            <div className="mt-4 text-xs text-muted">{sub}</div>
          </Card>
        ))}
      </section>

      <section className="grid lg:grid-cols-2 gap-5 rise" style={{ animationDelay: "160ms" }}>
        <Card>
          <CardLabel>Needs your attention</CardLabel>
          <div className="mt-4 divide-y divide-hairline">
            {[
              "3 make-up class requests awaiting approval",
              "Mr Lee — 4 lesson notes overdue",
              "2 new parent messages",
              "1 trial booking awaiting confirmation",
            ].map((row) => (
              <div key={row} className="py-3 text-sm text-ink-soft flex items-center justify-between">
                <span>{row}</span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-brand-600">
                  Open →
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardLabel>Revenue · this month</CardLabel>
          <CardTitle>$24,860 AUD</CardTitle>
          <div className="mt-6">
            <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--sun)] rounded-full"
                style={{ width: "68%" }}
              />
            </div>
            <div className="mt-2 text-xs text-muted">68% of $36,500 target</div>
          </div>
        </Card>
      </section>

      <div className="text-xs text-muted">
        Phase 2 · Admin track agent — full implementation lives under{" "}
        <code className="text-ink">src/app/admin</code>
      </div>
    </div>
  );
}
