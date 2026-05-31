import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LessonRow } from "../_lib/queries";
import { formatTime, formatWeekday, LESSON_STATUS_LABEL } from "../_lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;
const PX_PER_HOUR = 44;

const STATUS_BLOCK_STYLE: Record<string, string> = {
  upcoming: "bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100/90 text-white border-brand-600",
  completed: "bg-brand-100 text-navy-800 border-brand-300",
  cancelled: "bg-rose-100 text-rose-900 border-rose-300 line-through",
  missed: "bg-amber-100 text-amber-900 border-amber-300",
  rescheduled: "bg-amber-100 text-amber-900 border-amber-300",
  makeup: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

function minutesFromMidnight(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay();
  out.setDate(out.getDate() - ((day + 6) % 7));
  return out;
}

export function WeekCalendar({
  lessons,
  weekStart,
}: {
  lessons: LessonRow[];
  weekStart?: Date;
}) {
  const monday = startOfWeek(weekStart ?? new Date());
  const days: { date: Date; iso: string; lessons: LessonRow[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * DAY_MS);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: d,
      iso,
      lessons: lessons.filter((l) => l.date === iso),
    });
  }

  // Auto-fit the hour range to the data, with sensible defaults.
  let firstHour = 8;
  let lastHour = 19;
  for (const l of lessons) {
    const start = Math.floor(minutesFromMidnight(l.startTime) / 60);
    const end = Math.ceil(minutesFromMidnight(l.endTime) / 60);
    if (start < firstHour) firstHour = start;
    if (end > lastHour) lastHour = end;
  }
  firstHour = Math.max(0, firstHour);
  lastHour = Math.min(24, lastHour);
  const totalHours = lastHour - firstHour;
  const gridHeight = totalHours * PX_PER_HOUR;
  const hourLabels = Array.from({ length: totalHours + 1 }, (_, i) => firstHour + i);

  const todayIso = new Date(new Date().setHours(0, 0, 0, 0))
    .toISOString()
    .slice(0, 10);

  return (
    <div className="flex">
      {/* hour gutter */}
      <div
        className="w-12 shrink-0 pr-2 text-right"
        style={{ paddingTop: 28 }}
      >
        {hourLabels.slice(0, -1).map((h) => (
          <div
            key={h}
            className="text-[10px] uppercase tracking-wider text-muted"
            style={{ height: PX_PER_HOUR, lineHeight: "12px" }}
          >
            {formatHourLabel(h)}
          </div>
        ))}
      </div>

      {/* 7 day columns */}
      <div className="flex-1 grid grid-cols-7 gap-px bg-hairline/60 border border-hairline/60 rounded-xl overflow-hidden">
        {days.map((day) => {
          const isToday = day.iso === todayIso;
          return (
            <div key={day.iso} className="bg-card flex flex-col">
              <div
                className={cn(
                  "h-7 flex items-baseline justify-center gap-1.5 text-[10px] uppercase tracking-[0.18em]",
                  isToday ? "text-navy-800 font-medium" : "text-muted",
                )}
              >
                <span>{formatWeekday(day.iso, "short")}</span>
                <span className={isToday ? "text-brand-700" : "text-ink-soft"}>
                  {day.date.getDate()}
                </span>
              </div>
              <div className="relative" style={{ height: gridHeight }}>
                {/* hourly gridlines */}
                {Array.from({ length: totalHours }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-hairline/40"
                    style={{ top: i * PX_PER_HOUR }}
                  />
                ))}
                {/* lesson blocks */}
                {day.lessons.map((l) => {
                  const startMin = minutesFromMidnight(l.startTime);
                  const endMin = minutesFromMidnight(l.endTime);
                  const top = ((startMin - firstHour * 60) / 60) * PX_PER_HOUR;
                  const height = Math.max(
                    24,
                    ((endMin - startMin) / 60) * PX_PER_HOUR - 2,
                  );
                  return (
                    <Link
                      key={l.id}
                      href={`/student/resources/${l.id}`}
                      className={cn(
                        "absolute left-1 right-1 rounded-md border px-2 py-1 text-[11px] leading-tight overflow-hidden hover:shadow-md transition-shadow",
                        STATUS_BLOCK_STYLE[l.status] ?? STATUS_BLOCK_STYLE.upcoming,
                      )}
                      style={{ top, height }}
                      title={`${l.subjectName} · ${formatTime(l.startTime)}–${formatTime(l.endTime)} · ${LESSON_STATUS_LABEL[l.status] ?? l.status}`}
                    >
                      <div className="font-medium truncate">{l.subjectName}</div>
                      <div className="opacity-80 truncate">
                        {formatTime(l.startTime)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatHourLabel(h: number) {
  const suffix = h >= 12 ? "p" : "a";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}
