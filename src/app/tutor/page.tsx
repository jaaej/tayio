import { Card, CardLabel, CardTitle } from "@/components/ui/card";

export default function TutorDashboard() {
  return (
    <div className="space-y-12">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Today · 24 May
        </div>
        <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
          Three classes <span className="font-display italic">to teach</span>.
        </h1>
      </header>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-hairline">
            {[
              ["10:00", "11:30", "Year 9 Maths", "4 students · Room 3"],
              ["12:00", "13:00", "VCE Methods", "1:1 · Online"],
              ["15:00", "16:30", "Year 11 Physics", "3 students · Room 1"],
            ].map(([start, end, name, meta]) => (
              <div
                key={start}
                className="flex items-baseline gap-8 px-6 py-5 hover:bg-brand-50 transition-colors"
              >
                <div className="w-24 text-sm tabular-nums text-ink">
                  {start} – {end}
                </div>
                <div className="flex-1">
                  <div className="text-base text-ink">{name}</div>
                  <div className="text-xs text-muted mt-1">{meta}</div>
                </div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-brand-600">
                  Open →
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid lg:grid-cols-3 gap-5 rise" style={{ animationDelay: "160ms" }}>
        <Card>
          <CardLabel>To mark</CardLabel>
          <CardTitle>5 submissions</CardTitle>
          <div className="mt-4 text-xs text-muted">From Year 9 Maths · Worksheet 2</div>
        </Card>
        <Card>
          <CardLabel>Notes pending</CardLabel>
          <CardTitle>2 lessons</CardTitle>
          <div className="mt-4 text-xs text-muted">From last week</div>
        </Card>
        <Card>
          <CardLabel>Messages</CardLabel>
          <CardTitle>1 from parent</CardTitle>
          <div className="mt-4 text-xs text-muted">Re: Sarah's homework</div>
        </Card>
      </section>

      <div className="text-xs text-muted">
        Phase 2 · Tutor track agent — full implementation lives under{" "}
        <code className="text-ink">src/app/tutor</code>
      </div>
    </div>
  );
}
