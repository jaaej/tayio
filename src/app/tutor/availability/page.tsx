import { Card, CardLabel } from "@/components/ui/card";
import { requireTutor } from "../_data";

export default async function TutorAvailabilityPage() {
  await requireTutor();
  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Availability
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Coming in a later{" "}
          <span className="">phase</span>
        </h1>
      </header>

      <Card>
        <CardLabel>P2 — later version</CardLabel>
        <p className="mt-3 text-sm text-ink-soft max-w-2xl">
          Availability, leave requests, and timesheets are scheduled for a
          later phase per the Tutor PRD. For now, your assigned classes live in{" "}
          <span className="text-ink">Classes</span> and your day-to-day in{" "}
          <span className="text-ink">Today</span>.
        </p>
      </Card>
    </div>
  );
}
