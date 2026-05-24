import { Card, CardLabel, CardTitle } from "@/components/ui/card";

export default function StudentDashboard() {
  return (
    <div className="space-y-12">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Tuesday · Term 2
        </div>
        <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
          Welcome back, <span className="font-display italic">Sarah</span>.
        </h1>
        <p className="mt-4 text-ink-soft max-w-xl">
          Three things to look at today.
        </p>
      </header>

      <section className="grid lg:grid-cols-3 gap-5 rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardLabel>Next class</CardLabel>
          <CardTitle>Year 9 Maths</CardTitle>
          <div className="mt-6 space-y-1 text-sm text-ink-soft">
            <div>Saturday · 10:00am</div>
            <div>with Mr Lee</div>
            <div>Room 3 · Mount Waverley</div>
          </div>
        </Card>
        <Card>
          <CardLabel>Homework due</CardLabel>
          <CardTitle>Algebra Worksheet 3</CardTitle>
          <div className="mt-6 text-sm text-ink-soft">
            Due Friday · linear equations
          </div>
        </Card>
        <Card>
          <CardLabel>Current focus</CardLabel>
          <CardTitle>Linear equations</CardTitle>
          <div className="mt-6">
            <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-600 rounded-full"
                style={{ width: "72%" }}
              />
            </div>
            <div className="mt-2 text-xs text-muted">72% topic mastery</div>
          </div>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "160ms" }}>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-4">
          This week
        </div>
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-hairline">
            {[
              ["Mon", "—", "No class scheduled"],
              ["Tue", "4:00 pm", "Year 9 English with Ms Park"],
              ["Wed", "—", "Quiz 2 due"],
              ["Sat", "10:00 am", "Year 9 Maths with Mr Lee"],
            ].map(([day, time, label]) => (
              <div key={day} className="flex items-baseline gap-6 px-6 py-4">
                <div className="w-12 text-[11px] uppercase tracking-[0.18em] text-muted">
                  {day}
                </div>
                <div className="w-20 text-sm text-ink">{time}</div>
                <div className="text-sm text-ink-soft">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div className="text-xs text-muted">
        Phase 2 · Student track agent — full implementation lives under{" "}
        <code className="text-ink">src/app/student</code>
      </div>
    </div>
  );
}
