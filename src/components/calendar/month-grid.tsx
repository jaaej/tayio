"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type MonthChip = {
  id: string;
  /** Local calendar date in YYYY-MM-DD form. */
  date: string;
  label: string;
  sublabel?: string;
  /** Stable ordering within one day. Defaults to label when omitted. */
  sortKey?: string;
  /** Caller-supplied classes for the chip surface and text. */
  tone: string;
  href?: string | null;
  /** Lets colour tokens that are data-derived stay out of Tailwind class strings. */
  style?: CSSProperties;
  barStyle?: CSSProperties;
  dimmed?: boolean;
  /** An admin can render a historical chip without making it actionable. */
  interactive?: boolean;
  title?: string;
  ariaLabel?: string;
};

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Shared month grid for calendar consumers. The caller owns what each chip
 * means; this component only owns the date geometry and interaction shell.
 */
export function MonthGrid({
  year,
  month,
  chips,
  shadedDates,
  onChipClick,
}: {
  year: number;
  /** Zero-indexed, matching Date. */
  month: number;
  chips: MonthChip[];
  shadedDates?: Set<string>;
  onChipClick?: (chipId: string) => void;
}) {
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const todayIso = isoLocal(new Date());
  const chipsByDate = new Map<string, MonthChip[]>();

  for (const chip of chips) {
    const list = chipsByDate.get(chip.date) ?? [];
    list.push(chip);
    chipsByDate.set(chip.date, list);
  }
  for (const list of chipsByDate.values()) {
    list.sort((a, b) =>
      (a.sortKey ?? a.label).localeCompare(b.sortKey ?? b.label),
    );
  }

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const iso = isoLocal(date);
    return {
      iso,
      dayNum: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: iso === todayIso,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      chips: chipsByDate.get(iso) ?? [],
    };
  });

  const visibleDays =
    days.slice(35).every((day) => !day.inMonth) ? days.slice(0, 35) : days;

  return (
    <div className="rounded-2xl border border-line bg-surface-2/60 p-1.5">
      <div className="mb-1.5 grid grid-cols-7 gap-0 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-2">
        {DAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "py-2 text-center",
              (index === 5 || index === 6) && "text-muted",
            )}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {visibleDays.map((day) => (
          <div
            key={day.iso}
            className={cn(
              "flex min-h-[140px] flex-col rounded-xl border transition-colors lg:min-h-[160px] xl:min-h-[180px]",
              !day.inMonth
                ? "border-line/40 bg-surface-2/40"
                : day.isToday
                  ? "border-brand-400 bg-surface ring-1 ring-brand-300/40"
                  : shadedDates?.has(day.iso)
                    ? "border-warn/35 bg-warn-bg/60"
                    : day.isWeekend
                      ? "border-line bg-surface-2/40"
                      : "border-line bg-surface",
            )}
          >
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
              {day.isToday ? (
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-500 px-2 text-[14px] font-extrabold leading-none tabular-nums text-white">
                  {day.dayNum}
                </span>
              ) : (
                <span
                  className={cn(
                    "text-[15px] font-bold leading-none tabular-nums",
                    !day.inMonth
                      ? "text-muted-2/60"
                      : day.isWeekend
                        ? "text-muted"
                        : "text-ink",
                  )}
                >
                  {day.dayNum}
                </span>
              )}
              {day.chips.length > 0 && day.inMonth && (
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] tabular-nums text-muted-2">
                  {day.chips.length}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-1 overflow-hidden px-1.5 pb-1.5">
              {day.chips.map((chip) => (
                <GridChip
                  key={chip.id}
                  chip={chip}
                  dimmed={!day.inMonth || chip.dimmed}
                  onClick={onChipClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridChip({
  chip,
  dimmed,
  onClick,
}: {
  chip: MonthChip;
  dimmed: boolean | undefined;
  onClick?: (chipId: string) => void;
}) {
  const className = cn(
    "relative block overflow-hidden rounded-md py-1 pl-2 pr-1.5 leading-tight",
    chip.tone,
    dimmed && "opacity-50",
    (chip.href || (onClick && chip.interactive !== false)) &&
      "transition-transform hover:-translate-y-[1px]",
  );
  const content = (
    <>
      {chip.barStyle && (
        <span
          aria-hidden
          className="absolute bottom-1 left-0 top-1 w-[3px] rounded-full"
          style={chip.barStyle}
        />
      )}
      <div className="text-[10px] font-extrabold tabular-nums">{chip.label}</div>
      {chip.sublabel && (
        <div className="mt-0.5 truncate text-[11px] font-bold">
          {chip.sublabel}
        </div>
      )}
    </>
  );

  if (chip.href) {
    return (
      <Link
        href={chip.href}
        className={className}
        style={chip.style}
        title={chip.title}
        aria-label={chip.ariaLabel}
      >
        {content}
      </Link>
    );
  }
  if (onClick && chip.interactive !== false) {
    return (
      <button
        type="button"
        onClick={() => onClick(chip.id)}
        className={cn(className, "w-full text-left")}
        style={chip.style}
        title={chip.title}
        aria-label={chip.ariaLabel}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={className} style={chip.style} title={chip.title}>
      {content}
    </div>
  );
}
