import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { getTutorClasses, requireTutor } from "../_data";
import { getWeeklyRules } from "../_lib/availability";
import { toggleAvailabilityRule } from "../_actions";

const WEEKDAYS = [
  { idx: 1, short: "Mon", long: "Monday" },
  { idx: 2, short: "Tue", long: "Tuesday" },
  { idx: 3, short: "Wed", long: "Wednesday" },
  { idx: 4, short: "Thu", long: "Thursday" },
  { idx: 5, short: "Fri", long: "Friday" },
  { idx: 6, short: "Sat", long: "Saturday" },
  { idx: 0, short: "Sun", long: "Sunday" },
];

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20

function hh(n: number): string {
  return `${String(n).padStart(2, "0")}:00`;
}

export default async function TutorTimetablePage() {
  await requireRole("tutor");
  const tutor = await requireTutor();

  const [rules, taughtClasses] = await Promise.all([
    getWeeklyRules(tutor.id),
    getTutorClasses(tutor.id),
  ]);

  // Index rules + classes by `${weekday}-${hour}`
  const ruleByCell = new Map<string, { startTime: string; endTime: string }>();
  for (const r of rules) {
    // Mark every hour that the rule covers
    const startH = parseInt(r.startTime.slice(0, 2), 10);
    const endH = parseInt(r.endTime.slice(0, 2), 10);
    for (let h = startH; h < endH; h++) {
      ruleByCell.set(`${r.weekday}-${h}`, {
        startTime: r.startTime,
        endTime: r.endTime,
      });
    }
  }

  type ClassCell = { name: string; subjectName: string };
  const classByCell = new Map<string, ClassCell>();
  for (const c of taughtClasses) {
    if (c.weekday === null || !c.startTime || !c.endTime) continue;
    const startH = parseInt(c.startTime.slice(0, 2), 10);
    const endH = parseInt(c.endTime.slice(0, 2), 10);
    for (let h = startH; h < endH; h++) {
      classByCell.set(`${c.weekday}-${h}`, {
        name: c.name,
        subjectName: c.subjectName,
      });
    }
  }

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <header className="rise">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
          {dateLabel}
        </div>
        <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Timetable
        </h1>
        <p className="mt-2 text-sm text-ink-soft max-w-2xl leading-relaxed">
          Click an empty cell to mark yourself available that weekday every
          week. Click a green cell to remove it. Classes you teach are shown
          in amber and can't be edited from here.
        </p>
      </header>

      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "60ms" }}>
        <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between gap-3">
          <div className="text-xl font-medium text-ink">Weekly Availability</div>
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            {rules.length > 0
              ? `${rules.length} slot${rules.length === 1 ? "" : "s"}`
              : "Nothing set"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[820px] p-5">
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-1.5">
              <div />
              {WEEKDAYS.map((d) => (
                <div
                  key={d.idx}
                  className="text-center py-2 text-[11px] uppercase tracking-[0.18em] text-muted"
                >
                  {d.short}
                </div>
              ))}

              {HOURS.map((h) => (
                <HourRow
                  key={h}
                  hour={h}
                  ruleByCell={ruleByCell}
                  classByCell={classByCell}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center gap-5 pt-4 border-t border-hairline/60 text-[10px] uppercase tracking-[0.14em] text-muted">
              <Legend color="bg-emerald-200/80 border border-emerald-400/70" label="Available" />
              <Legend color="bg-amber-100 border border-amber-300" label="Teaching" />
              <Legend color="bg-card border border-hairline/60" label="Click to add" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function HourRow({
  hour,
  ruleByCell,
  classByCell,
}: {
  hour: number;
  ruleByCell: Map<string, { startTime: string; endTime: string }>;
  classByCell: Map<string, { name: string; subjectName: string }>;
}) {
  return (
    <>
      <div className="text-[11px] tabular-nums text-muted text-right pr-2 pt-2">
        {formatTime(hh(hour))}
      </div>
      {WEEKDAYS.map((d) => {
        const key = `${d.idx}-${hour}`;
        const cls = classByCell.get(key);
        const rule = ruleByCell.get(key);
        if (cls) {
          return (
            <div
              key={key}
              className="h-14 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] text-amber-900 leading-tight overflow-hidden"
              title={`${cls.name} · ${cls.subjectName}`}
            >
              <div className="font-medium truncate">{cls.subjectName}</div>
              <div className="text-[10px] truncate text-amber-800/80">
                {cls.name}
              </div>
            </div>
          );
        }
        return (
          <AvailabilityCell
            key={key}
            weekday={d.idx}
            hour={hour}
            isAvailable={Boolean(rule)}
          />
        );
      })}
    </>
  );
}

function AvailabilityCell({
  weekday,
  hour,
  isAvailable,
}: {
  weekday: number;
  hour: number;
  isAvailable: boolean;
}) {
  const startTime = hh(hour);
  const endTime = hh(hour + 1);
  return (
    <form action={toggleAvailabilityRule}>
      <input type="hidden" name="weekday" value={weekday} />
      <input type="hidden" name="startTime" value={startTime} />
      <input type="hidden" name="endTime" value={endTime} />
      <button
        type="submit"
        className={
          "h-14 w-full rounded-md border transition-colors text-[11px] tabular-nums " +
          (isAvailable
            ? "bg-emerald-200/80 border-emerald-400/70 text-emerald-900 hover:bg-emerald-200"
            : "bg-card border-hairline/60 text-muted/60 hover:border-brand-400 hover:bg-brand-50/40")
        }
        aria-pressed={isAvailable}
        aria-label={
          isAvailable
            ? `Remove availability ${startTime}–${endTime}`
            : `Mark available ${startTime}–${endTime}`
        }
      >
        {isAvailable ? "✓" : ""}
      </button>
    </form>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={"h-3 w-3 rounded-sm " + color} aria-hidden />
      {label}
    </span>
  );
}
