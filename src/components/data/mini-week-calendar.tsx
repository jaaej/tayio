import { cn } from "@/lib/utils";

export type CalendarEvent = {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** "HH:MM" or null for all-day events (homework due, workshop) */
  time: string | null;
  /** Short label shown in the cell */
  label: string;
  /** Sub-label (subject, tutor, etc.) */
  meta?: string;
  kind: "lesson" | "homework" | "event";
  /** Optional href to make the chip clickable */
  href?: string;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Convert JS getDay() (0=Sun..6=Sat) to Monday-first index (0=Mon..6=Sun)
const DAY_TO_MONFIRST = [6, 0, 1, 2, 3, 4, 5];

const KIND_STYLES: Record<CalendarEvent["kind"], string> = {
  lesson: "bg-brand-100 text-brand-700 border-brand-200/60",
  homework: "bg-amber-50 text-amber-800 border-amber-200/60",
  event: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
};

const KIND_DOT: Record<CalendarEvent["kind"], string> = {
  lesson: "bg-brand-600",
  homework: "bg-amber-500",
  event: "bg-emerald-500",
};

function startOfMondayWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - DAY_TO_MONFIRST[x.getDay()]);
  return x;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatTimeShort(t: string) {
  const [h, m] = t.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "p" : "a";
  const hr = hour % 12 === 0 ? 12 : hour % 12;
  return m === "00" ? `${hr}${suffix}` : `${hr}:${m}${suffix}`;
}

export function MiniWeekCalendar({
  events,
  weekStart,
}: {
  events: CalendarEvent[];
  weekStart?: Date;
}) {
  const now = new Date();
  const monday = startOfMondayWeek(weekStart ?? now);
  const todayIso = isoDate(now);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      iso: isoDate(d),
      dayNum: d.getDate(),
      label: DAY_LABELS[i],
      isToday: isoDate(d) === todayIso,
    };
  });

  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }
  // Sort each day: timed events first (by time), then all-day
  for (const list of byDate.values()) {
    list.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const dayEvents = byDate.get(d.iso) ?? [];
          const dotKinds = Array.from(
            new Set(dayEvents.map((e) => e.kind)),
          ) as CalendarEvent["kind"][];
          return (
            <div
              key={d.iso}
              className={cn(
                "rounded-xl px-3 py-3 text-center transition-colors",
                d.isToday
                  ? "bg-navy-800 text-white shadow-[0_4px_18px_-8px_rgba(29,41,81,0.4)]"
                  : "bg-brand-50/60 text-ink-soft hover:bg-brand-100",
              )}
            >
              <div
                className={cn(
                  "text-[10px] uppercase tracking-[0.16em]",
                  d.isToday ? "text-white/70" : "text-muted",
                )}
              >
                {d.label}
              </div>
              <div
                className={cn(
                  "mt-1 text-2xl font-medium tabular-nums",
                  d.isToday ? "text-white" : "text-ink",
                )}
              >
                {d.dayNum}
              </div>
              {dotKinds.length > 0 && (
                <div className="mt-1.5 flex items-center justify-center gap-1">
                  {dotKinds.map((k) => (
                    <span
                      key={k}
                      className={cn("h-1.5 w-1.5 rounded-full", KIND_DOT[k])}
                      aria-hidden
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Event list grouped by day */}
      <div className="space-y-2.5 pt-2">
        {days.map((d) => {
          const dayEvents = byDate.get(d.iso) ?? [];
          if (dayEvents.length === 0) return null;
          return (
            <div key={d.iso} className="flex items-start gap-4">
              <div className="w-16 shrink-0 text-[11px] uppercase tracking-[0.14em] text-muted pt-1">
                {d.label} {d.dayNum}
              </div>
              <div className="flex-1 flex flex-wrap gap-2 min-w-0">
                {dayEvents.map((e, i) => (
                  <EventChip key={`${d.iso}-${i}`} event={e} />
                ))}
              </div>
            </div>
          );
        })}
        {Array.from(byDate.values()).every((v) => v.length === 0) && (
          <div className="text-sm text-muted px-1 pt-2">
            Nothing scheduled this week.
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 pt-2 border-t border-hairline/60 text-[10px] uppercase tracking-[0.14em] text-muted">
        <LegendDot color="bg-brand-600" label="Lesson" />
        <LegendDot color="bg-amber-500" label="Homework" />
        <LegendDot color="bg-emerald-500" label="Event" />
      </div>
    </div>
  );
}

function EventChip({ event }: { event: CalendarEvent }) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs leading-tight",
        KIND_STYLES[event.kind],
      )}
    >
      {event.time && (
        <span className="font-medium tabular-nums">
          {formatTimeShort(event.time)}
        </span>
      )}
      <span className="truncate max-w-[160px]">{event.label}</span>
    </span>
  );
  if (event.href) {
    return (
      <a href={event.href} className="hover:opacity-80 transition-opacity">
        {content}
      </a>
    );
  }
  return content;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} aria-hidden />
      {label}
    </span>
  );
}
