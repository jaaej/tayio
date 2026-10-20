"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { subjectTone } from "@/lib/subject-tone";
import {
  countLabel,
  fullDayDiffers,
  gridHours,
  placeDay,
  type PlacedEvent,
  type PlacedGroup,
} from "./week-time-grid-layout";

/**
 * Week view on a time axis: hours down the side, one column per day, each
 * lesson placed and sized by its start and end time. The hours fit the
 * week's lessons (Show full day widens them), days without lessons are
 * narrow columns, two lessons at once sit side by side, and three or more
 * at once fold into one card listing them (`placeDay`). Today's column is
 * tinted and carries a live "now" line in Melbourne time, matching how
 * lesson times are stored.
 *
 * Used by the admin classes page (detailed), the admin dashboard and tutor
 * Today.
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
  /** The subject's stored colour (`subjects.color`). */
  subjectColor: string | null;
  /** Secondary line in detailed mode, e.g. the tutor. */
  meta?: string;
  /** Small chip in detailed mode, e.g. "3/8" enrolled. */
  badge?: string;
  href?: string;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Pixels per hour: tall on the classes page, compact on the home pages. */
const HOUR_PX = { detailed: 104, compact: 42 };
const GUTTER_PX = 60;
const NARROW_DAY_PX = 74;
/** Narrowest a day with lessons gets before the grid scrolls sideways. */
const WIDE_DAY_MIN_PX = 150;

function hourLabel(hour: number) {
  const h = hour % 24;
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
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

function eventTooltip(e: TimeGridEvent) {
  return [e.title ?? e.label, `${timeLabel(e.startTime)} to ${timeLabel(e.endTime)}`, e.meta]
    .filter(Boolean)
    .join(" · ");
}

/** Wraps a block in its link when it has one. */
function MaybeLink({
  href,
  label,
  className,
  style,
  children,
}: {
  href?: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        className,
      )}
      style={style}
    >
      {children}
    </Link>
  );
}

function EventBlock({
  placed,
  top,
  height,
  detailed,
}: {
  placed: PlacedEvent<TimeGridEvent>;
  top: number;
  height: number;
  detailed: boolean;
}) {
  const e = placed.event;
  const tone = subjectTone(e.subject ?? e.label, e.subjectColor);
  const width = 100 / placed.lanes;
  return (
    <div
      className="absolute px-1"
      style={{ top: top + 2, height, left: `${placed.lane * width}%`, width: `${width}%` }}
      title={eventTooltip(e)}
    >
      <MaybeLink
        href={e.href}
        label={eventTooltip(e)}
        className="flex h-full flex-col overflow-hidden rounded-[10px] px-2 py-1.5 transition-shadow duration-150 hover:shadow-[0_6px_16px_-10px_rgba(60,62,150,0.5)]"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {detailed ? (
          <>
            {/* Two lessons side by side leave each about 75px on a busy
                week, so lines wrap rather than cut off mid-word. */}
            <div className="line-clamp-3 text-[12px] font-extrabold leading-[1.25]">{e.label}</div>
            {height >= 44 && (
              <div className="mt-0.5 text-[11px] font-semibold tabular-nums leading-tight">
                {timeLabel(e.startTime)} – {timeLabel(e.endTime)}
              </div>
            )}
            {e.meta && height >= 62 && (
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-tight opacity-85">{e.meta}</div>
            )}
            {e.badge && height >= 96 && (
              <span className="mt-auto inline-flex self-start rounded-[6px] bg-white/75 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums">
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
      </MaybeLink>
    </div>
  );
}

/** Three or more lessons at once: one card with a row per lesson. */
function GroupCard({
  group,
  top,
  maxHeight,
  noun,
}: {
  group: PlacedGroup<TimeGridEvent>;
  top: number;
  maxHeight: number;
  noun: string;
}) {
  const startLabel = timeLabel(group.events[0].startTime);
  return (
    <div className="absolute inset-x-0 px-1" style={{ top: top + 2 }}>
      <div
        className="flex flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-[12px] border border-line bg-white/80 p-1.5 shadow-[0_6px_18px_-14px_rgba(60,62,150,0.45)]"
        style={{ maxHeight }}
      >
        <p className="px-1 pb-1 pt-0.5 text-[11px] font-extrabold tabular-nums text-ink">
          {startLabel} · {countLabel(group.events.length, noun)}
        </p>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {group.events.map((e, i) => {
            const tone = subjectTone(e.subject ?? e.label, e.subjectColor);
            const time = timeLabel(e.startTime);
            // Lessons starting later than the card's time get one small
            // time label above them, so the rows keep room for names.
            const newTime = i > 0 && time !== timeLabel(group.events[i - 1].startTime);
            return (
              <li key={e.id} title={eventTooltip(e)}>
                {newTime && (
                  <p className="px-1 pb-0.5 pt-1 text-[10px] font-extrabold tabular-nums text-muted">
                    {time}
                  </p>
                )}
                <MaybeLink
                  href={e.href}
                  label={eventTooltip(e)}
                  className="flex min-h-[26px] items-center gap-2 rounded-[7px] px-2 py-1 transition-[filter] duration-150 hover:brightness-[0.97]"
                  style={{ backgroundColor: tone.bg, color: tone.fg }}
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold leading-tight">
                    {e.label}
                  </span>
                  {e.badge && (
                    <span className="shrink-0 text-[12px] font-extrabold tabular-nums">{e.badge}</span>
                  )}
                </MaybeLink>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function WeekTimeGrid({
  events,
  weekStart,
  todayIso,
  detailed = false,
  noun = "class",
}: {
  events: TimeGridEvent[];
  /** What one event is called in the day and card counts, singular. */
  noun?: string;
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
  const [fullDay, setFullDay] = useState(false);
  useEffect(() => {
    setNow(melbourneNow());
    const timer = window.setInterval(() => setNow(melbourneNow()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hourPx = detailed ? HOUR_PX.detailed : HOUR_PX.compact;
  const byDay = new Map<string, TimeGridEvent[]>();
  for (const e of events) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }
  const days = DAY_LABELS.map((label, i) => {
    const iso = addDays(weekStart, i);
    const count = byDay.get(iso)?.length ?? 0;
    return { iso, label, dayNum: Number(iso.slice(8)), isToday: iso === todayIso, count };
  });
  // Narrow the days without lessons, unless the whole week is empty.
  const narrowEmpty = events.length > 0;
  const columns = days
    .map((d) => (narrowEmpty && d.count === 0 ? `${NARROW_DAY_PX}px` : "minmax(0,1fr)"))
    .join(" ");
  const gridTemplateColumns = `${GUTTER_PX}px ${columns}`;
  const wideDays = days.filter((d) => !narrowEmpty || d.count > 0).length;
  const minWidth = GUTTER_PX + wideDays * WIDE_DAY_MIN_PX + (7 - wideDays) * NARROW_DAY_PX;

  const { start: startHour, end: endHour } = gridHours(events, fullDay);
  const canToggle = fullDayDiffers(events);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const bodyHeight = (endHour - startHour) * hourPx;
  const toPx = (minutes: number) => ((minutes - startHour * 60) / 60) * hourPx;

  const nowTop =
    now && now.minutes >= startHour * 60 && now.minutes <= endHour * 60 ? toPx(now.minutes) : null;

  return (
    <div>
      <div className="overflow-x-auto overscroll-x-contain">
        <div style={{ minWidth }}>
          {/* Day header */}
          <div className="grid border-b border-line" style={{ gridTemplateColumns }}>
            <div />
            {days.map((d) => (
              <div
                key={d.iso}
                className={cn(
                  "flex min-w-0 items-center gap-2 border-l border-line px-2.5 pb-2.5 pt-3",
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
                {d.count > 0 && (
                  <span className="ml-auto truncate text-[11px] font-semibold tabular-nums text-muted">
                    {countLabel(d.count, noun)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="grid" style={{ gridTemplateColumns }}>
            {/* Hour gutter */}
            <div className="relative" style={{ height: bodyHeight }}>
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-2.5 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold tabular-nums text-muted"
                  // Keep the first and last labels inside the grid's edges.
                  style={{ top: Math.min(Math.max(i * hourPx, 9), bodyHeight - 9) }}
                >
                  {hourLabel(h)}
                </span>
              ))}
            </div>

            {days.map((d) => (
              <div
                key={d.iso}
                className={cn("relative min-w-0 border-l border-line", d.isToday && "bg-brand-50/70")}
                style={{
                  height: bodyHeight,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${hourPx}px)`,
                }}
              >
                {placeDay(byDay.get(d.iso) ?? []).map((p) => {
                  const top = toPx(p.start);
                  if (p.kind === "group") {
                    const limit = p.nextStart === null ? bodyHeight : toPx(p.nextStart);
                    return (
                      <GroupCard
                        key={p.events.map((e) => e.id).join("+")}
                        group={p}
                        top={top}
                        maxHeight={Math.max(limit - top - 6, 60)}
                        noun={noun}
                      />
                    );
                  }
                  const height = Math.max(((p.end - p.start) / 60) * hourPx - 4, 30);
                  return (
                    <EventBlock
                      key={p.event.id}
                      placed={p}
                      top={top}
                      height={height}
                      detailed={detailed}
                    />
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

      {canToggle && (
        <div className="flex justify-end border-t border-line px-[18px] py-2.5">
          <button
            type="button"
            aria-pressed={fullDay}
            onClick={() => setFullDay((v) => !v)}
            className="inline-flex h-9 items-center rounded-[10px] border border-line bg-white px-3 text-[13px] font-bold text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {fullDay ? "Fit to classes" : "Show full day"}
          </button>
        </div>
      )}
    </div>
  );
}
