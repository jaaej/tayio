import { Card } from "@/components/ui/card";
import { requireTutor } from "../_data";

export default async function TutorAvailabilityPage() {
  await requireTutor();
  return (
    <div className="space-y-6">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Availability
        </div>
        <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
          Coming in a later phase
        </h1>
      </header>

      <Card>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
          P2 — later version
        </div>
        <p className="mt-3 text-sm text-ink-soft max-w-2xl leading-relaxed">
          Availability, leave requests, and timesheets are scheduled for a
          later phase per the Tutor PRD. For now, your assigned classes live in{" "}
          <span className="text-ink">Classes</span> and your day-to-day in{" "}
          <span className="text-ink">Today</span>.
        </p>
      </Card>
    </div>
  );
}
