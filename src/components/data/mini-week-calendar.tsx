import { cn } from "@/lib/utils";

export type CalendarEvent = {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** "HH:MM" — lessons. null = all-day (homework due, event) */
  time: string | null;
  /** End time for lessons, optional */
  endTime?: string | null;
  /** Short label shown in the block */
  label: string;
  /** Sub-label (tutor, class, etc.) */
  meta?: string;
  kind: "lesson" | "homework" | "event";
  /** Optional href to make the chip clickable */
  href?: string;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_TO_MONFIRST = [6, 0, 1, 2, 3, 4, 5];

const KIND_BG: Record<CalendarEvent["kind"], string> = {
  lesson: "bg-brand-50",
  homework: "bg-amber-50",
  event: "bg-emerald-50",
};
const KIND_BAR: Record<CalendarEvent["kind"], string> = {
  lesson: "bg-brand-600",
  homework: "bg-amber-500",
  event: "bg-emerald-500",
};
const KIND_LABEL: Record<CalendarEvent["kind"], string> = {
  lesson: "text-brand-700",
  homework: "text-amber-800",
  event: "text-emerald-800",
};
const KIND_META: Record<CalendarEvent["kind"], string> = {
  lesson: "text-brand-600/80",
  homework: "text-amber-700/80",
  event: "text-emerald-700/80",
};
const KIND_TAG: Record<CalendarEvent["kind"], string> = {
  lesson: "",
  homework: "Due",
  event: "Event",
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

function formatTime12(t: string) {
  const [h, m] = t.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "pm" : "am";
  const hr = hour % 12 === 0 ? 12 : hour % 12;
  return `${hr}:${m}${suffix}`;
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
      isWeekend: i >= 5,
    };
  });

  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }
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
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const dayEvents = byDate.get(d.iso) ?? [];
          return (
            <div
              key={d.iso}
              className={cn(
                "rounded-xl overflow-hidden flex flex-col min-h-[210px] border transition-colors",
                d.isToday
                  ? "border-navy-800/30 bg-gradient-to-b from-brand-50 to-white shadow-[0_6px_20px_-14px_rgba(29,41,81,0.28)]"
                  : d.isWeekend
                    ? "border-hairline/40 bg-brand-50/40"
                    : "border-hairline/40 bg-card",
              )}
            >
              {/* Day header */}
              <div
                className={cn(
                  "px-2 py-2 border-b text-center",
                  d.isToday
                    ? "bg-navy-800 text-white border-navy-800"
                    : "bg-white border-hairline/40",
                )}
              >
                <div
                  className={cn(
                    "text-[9px] uppercase tracking-[0.18em]",
                    d.isToday ? "text-white/70" : "text-muted",
                  )}
                >
                  {d.label}
                </div>
                <div
                  className={cn(
                    "text-lg font-medium tabular-nums leading-none mt-0.5",
                    d.isToday ? "text-white" : "text-ink",
                  )}
                >
                  {d.dayNum}
                </div>
              </div>

              {/* Event lane */}
              <div className="flex-1 p-1.5 space-y-1">
                {dayEvents.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-muted/60 italic">
                    —
                  </div>
                ) : (
                  dayEvents.map((e, i) => (
                    <TimeBlock key={`${d.iso}-${i}`} event={e} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-5 pt-2 border-t border-hairline/60 text-[10px] uppercase tracking-[0.14em] text-muted">
        <LegendDot color="bg-brand-600" label="Lesson" />
        <LegendDot color="bg-amber-500" label="Homework" />
        <LegendDot color="bg-emerald-500" label="Event" />
      </div>
    </div>
  );
}

function TimeBlock({ event }: { event: CalendarEvent }) {
  const inner = (
    <div
      className={cn(
        "relative rounded-md pl-2.5 pr-1.5 py-1.5 overflow-hidden",
        KIND_BG[event.kind],
        "hover:translate-y-[-1px] transition-transform",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1 bottom-1 w-[2px] rounded-full",
          KIND_BAR[event.kind],
        )}
        aria-hidden
      />
      <div
        className={cn(
          "text-[10px] font-semibold tabular-nums leading-tight",
          KIND_LABEL[event.kind],
        )}
      >
        {event.time ? (
          formatTime12(event.time)
        ) : (
          <span className="text-[9px] uppercase tracking-[0.16em] font-medium">
            {KIND_TAG[event.kind]}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[10px] font-medium leading-tight line-clamp-2",
          KIND_LABEL[event.kind],
        )}
      >
        {event.label}
      </div>
    </div>
  );
  return event.href ? (
    <a href={event.href} className="block hover:no-underline">
      {inner}
    </a>
  ) : (
    inner
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} aria-hidden />
      {label}
    </span>
  );
}
