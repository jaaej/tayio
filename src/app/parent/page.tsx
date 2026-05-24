import { Card, CardLabel, CardTitle } from "@/components/ui/card";

export default function ParentDashboard() {
  return (
    <div className="space-y-12">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Family overview
        </div>
        <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
          How <span className="font-display italic">Sarah</span> is going.
        </h1>
      </header>

      <section className="grid lg:grid-cols-4 gap-5 rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardLabel>Attendance</CardLabel>
          <CardTitle>92%</CardTitle>
          <div className="mt-4 text-xs text-muted">Last 8 weeks</div>
        </Card>
        <Card>
          <CardLabel>Homework</CardLabel>
          <CardTitle>11 / 12</CardTitle>
          <div className="mt-4 text-xs text-muted">Completed on time</div>
        </Card>
        <Card>
          <CardLabel>Next lesson</CardLabel>
          <CardTitle>Saturday 10am</CardTitle>
          <div className="mt-4 text-xs text-muted">Year 9 Maths · Mr Lee</div>
        </Card>
        <Card>
          <CardLabel>Balance</CardLabel>
          <CardTitle>$0.00</CardTitle>
          <div className="mt-4 text-xs text-muted">All paid up</div>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "160ms" }}>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-4">
          Latest from Mr Lee
        </div>
        <Card>
          <p className="font-display italic text-2xl text-ink leading-snug">
            "Today we covered linear equations. Sarah understood the basic steps
            well but needs more practice with negative numbers. I've assigned a
            worksheet to strengthen this before next lesson."
          </p>
          <div className="mt-6 text-xs text-muted">
            Posted 2 hours ago · Year 9 Maths
          </div>
        </Card>
      </section>

      <div className="text-xs text-muted">
        Phase 2 · Parent track agent — full implementation lives under{" "}
        <code className="text-ink">src/app/parent</code>
      </div>
    </div>
  );
}
