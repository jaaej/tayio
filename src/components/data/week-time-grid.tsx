"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { subjectTone } from "@/lib/subject-tone";

/**
 * Week view on a time axis: hours down the side, one column per day, each
 * lesson placed and sized by its start and end time. Overlapping lessons in a
 * day share the column side by side. Today's column is tinted and carries a
 * live "now" line in Melbourne time, matching how lesson times are stored.
 *
 * Used by the admin dashboard, the admin classes page and tutor Today; the
 * student and parent portals still use MiniWeekCalendar until they move to
 * the glass redesign.
 */
export type TimeGridEvent = {
  id: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** HH:MM or HH:MM:SS */
  startTime: string;
  endTime: string;
  label: string;
  /** Full name for the tooltip and screen readers; defaults to label. */
  title?: string;
  /** Used for the subject colour; defaults to label. */
  subject?: string;
  /** Secondary line in detailed mode, e.g. the tutor. */
  meta?: string;
  /** Small chip in detailed mode, e.g. "3/8" enrolled. */
  badge?: string;
  href?: string;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_PX = 42;

function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? "pm" : "am";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

function timeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr} ${suffix}` : `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function melbourneNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

type Placed = TimeGridEvent & { start: number; end: number; lane: number; lanes: number };

/** Greedy lane assignment within clusters of overlapping events. */
function placeDay(events: TimeGridEvent[]): Placed[] {
  const sorted = events
    .map((e) => ({ ...e, start: minutes(e.startTime), end: minutes(e.endTime) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((e) => e.lane + 1));
    for (const e of cluster) e.lanes = lanes;
    placed.push(...cluster);
    cluster = [];
  };
  for (const e of sorted) {
    if (cluster.length > 0 && e.start >= clusterEnd) flush();
    const taken = new Set(
      cluster.filter((c) => c.end > e.start).map((c) => c.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane++;
    cluster.push({ ...e, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, e.end);
  }
  if (cluster.length > 0) flush();
  return placed;
}

export function WeekTimeGrid({
  events,
  weekStart,
  todayIso,
  detailed = false,
}: {
  events: TimeGridEvent[];
  /** Show the time range, meta line, and badge where the block has room. */
  detailed?: boolean;
  /** Monday, ISO date */
  weekStart: string;
  /** Melbourne date from the server, so the first render matches. */
  todayIso: string;
}) {
  // The now line only renders after mount: server and client clocks differ,
  // and a position baked into the HTML would be stale by hydration.
  const [now, setNow] = useState<{ date: string; minutes: number } | null>(null);
  useEffect(() => {
    setNow(melbourneNow());
    const timer = window.setInterval(() => setNow(melbourneNow()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const days = DAY_LABELS.map((label, i) => {
    const iso = addDays(weekStart, i);
    return { iso, label, dayNum: Number(iso.slice(8)), isToday: iso === todayIso };
  });

  // 8 am to 9 pm by default, widened to fit any earlier or later lesson.
  const earliest = Math.min(8 * 60, ...events.map((e) => minutes(e.startTime)));
  const latest = Math.max(21 * 60, ...events.map((e) => minutes(e.endTime)));
  const startHour = Math.floor(earliest / 60);
  const endHour = Math.ceil(latest / 60);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const bodyHeight = (endHour - startHour) * HOUR_PX;

  const byDay = new Map<string, TimeGridEvent[]>();
  for (const e of events) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }

  const nowTop =
    now && now.minutes >= startHour * 60 && now.minutes <= endHour * 60
      ? ((now.minutes - startHour * 60) / 60) * HOUR_PX
      : null;

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="min-w-[820px]">
        {/* Day header */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-line">
          <div />
          {days.map((d) => (
            <div
              key={d.iso}
              className={cn(
                "flex items-center gap-2 border-l border-line px-2.5 pb-2.5 pt-3",
                d.isToday && "bg-brand-50/70",
              )}
            >
              <span
                className={cn(
                  "text-[12px] font-extrabold tracking-[0.04em]",
                  d.isToday ? "text-ink" : "text-muted",
                )}
              >
                {d.label}
              </span>
              <span
                className={cn(
                  "grid h-[26px] min-w-[26px] place-items-center rounded-full px-1 text-[14px] font-extrabold tabular-nums",
                  d.isToday ? "bg-ink text-white" : "text-ink",
                )}
                aria-current={d.isToday ? "date" : undefined}
              >
                {d.dayNum}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
          {/* Hour gutter */}
          <div className="relative" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <span
                key={h}
                className="absolute right-2.5 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold tabular-nums text-muted"
                // Keep the first and last labels inside the grid's edges.
                style={{ top: Math.min(Math.max(i * HOUR_PX, 9), bodyHeight - 9) }}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>

          {days.map((d) => (
            <div
              key={d.iso}
              className={cn("relative border-l border-line", d.isToday && "bg-brand-50/70")}
              style={{
                height: bodyHeight,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${HOUR_PX}px)`,
              }}
            >
              {placeDay(byDay.get(d.iso) ?? []).map((e) => {
                const tone = subjectTone(e.subject ?? e.label);
                const top = ((e.start - startHour * 60) / 60) * HOUR_PX;
                const height = Math.max(((e.end - e.start) / 60) * HOUR_PX - 4, 30);
                const width = 100 / e.lanes;
                const block = (
                  <div
                    className="h-full overflow-hidden rounded-[9px] px-2 py-[5px] transition-shadow hover:shadow-[0_6px_16px_-10px_rgba(60,62,150,0.5)]"
                    style={{ backgroundColor: tone.bg, color: tone.fg }}
                  >
                    {detailed ? (
                      <>
                        <div className="line-clamp-2 text-[11px] font-extrabold leading-tight">
                          {e.label}
                        </div>
                        {height >= 40 && (
                          <div className="mt-0.5 truncate text-[10px] font-semibold tabular-nums leading-tight">
                            {timeLabel(e.startTime)} – {timeLabel(e.endTime)}
                          </div>
                        )}
                        {e.meta && height >= 54 && (
                          <div className="truncate text-[10px] leading-tight opacity-80">
                            {e.meta}
                          </div>
                        )}
                        {e.badge && height >= 70 && (
                          <span className="mt-1 inline-flex rounded-[6px] bg-white/70 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums">
                            {e.badge}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] font-extrabold tabular-nums leading-tight">
                          {timeLabel(e.startTime)}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 text-[12px] font-bold leading-[1.2]",
                            // Under ~45 minutes there is room for one line only.
                            height < 46 ? "line-clamp-1" : "line-clamp-2",
                          )}
                        >
                          {e.label}
                        </div>
                      </>
                    )}
                  </div>
                );
                return (
                  <div
                    key={e.id}
                    className="absolute px-1"
                    style={{
                      top: top + 2,
                      height,
                      left: `${e.lane * width}%`,
                      width: `${width}%`,
                    }}
                    title={`${e.title ?? e.label} · ${timeLabel(e.startTime)} to ${timeLabel(e.endTime)}`}
                  >
                    {e.href ? (
                      <Link href={e.href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-[8px]">
                        {block}
                      </Link>
                    ) : (
                      block
                    )}
                  </div>
                );
              })}

              {d.isToday && now?.date === d.iso && nowTop !== null && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-[#E5484D]"
                  style={{ top: nowTop }}
                >
                  <span className="absolute -left-1 -top-[4px] h-2.5 w-2.5 rounded-full bg-[#E5484D]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
