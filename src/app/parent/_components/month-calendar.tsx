import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import type { MonthLessonRow } from "../_data";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function parseMonthParam(value: string | undefined): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function monthBounds(year: number, month: number): { fromIso: string; toIso: string } {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  return { fromIso: isoLocal(from), toIso: isoLocal(to) };
}

export function MonthCalendar({
  year,
  month,
  lessons,
  basePath,
  childId,
}: {
  year: number;
  month: number;
  lessons: MonthLessonRow[];
  basePath: string;
  childId: string | null;
}) {
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const mondayOffset = (firstDow + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);

  const todayIso = isoLocal(new Date());

  const byDate = new Map<string, MonthLessonRow[]>();
  for (const l of lessons) {
    if (!byDate.has(l.date)) byDate.set(l.date, []);
    byDate.get(l.date)!.push(l);
  }

  const days: {
    iso: string;
    dayNum: number;
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    lessons: MonthLessonRow[];
  }[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = isoLocal(d);
    days.push({
      iso,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: iso === todayIso,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      lessons: byDate.get(iso) ?? [],
    });
  }

  // Trim trailing all-out-of-month row if the month doesn't need 6 rows
  const rowCount = Math.ceil(days.length / 7);
  let usedRows = rowCount;
  if (rowCount === 6) {
    const lastRow = days.slice(35, 42);
    if (lastRow.every((d) => !d.inMonth)) usedRows = 5;
  }
  const visibleDays = days.slice(0, usedRows * 7);

  const prev = navigateMonth(year, month, -1);
  const next = navigateMonth(year, month, 1);
  const today = navigateToday();

  const navBase = (m: { year: number; month: number }) => {
    const params = new URLSearchParams();
    params.set("month", monthKey(m.year, m.month));
    if (childId) params.set("child", childId);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h2 className="text-3xl lg:text-4xl font-medium text-ink tabular-nums">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Link
            href={navBase(today)}
            className="text-[11px] uppercase tracking-[0.16em] text-brand-700 hover:underline"
          >
            Today
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={navBase(prev)}
            aria-label="Previous month"
            className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-hairline/60 bg-card text-xl text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
          >
            ‹
          </Link>
          <Link
            href={navBase(next)}
            aria-label="Next month"
            className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-hairline/60 bg-card text-xl text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {visibleDays.map((d) => (
          <DayCell
            key={d.iso}
            day={d}
            basePath={basePath}
            childId={childId}
            year={year}
            month={month}
          />
        ))}
      </div>

      <div className="flex items-center gap-5 pt-3 border-t border-hairline/60 text-[10px] uppercase tracking-[0.14em] text-muted">
        <LegendDot color="bg-brand-600" label="Lesson" />
        <LegendDot color="bg-amber-500" label="Rescheduled" />
        <LegendDot color="bg-rose-500" label="Cancelled" />
        <LegendDot color="bg-ink-soft/30" label="Past" />
      </div>
    </div>
  );
}

function DayCell({
  day,
  basePath,
  childId,
  year,
  month,
}: {
  day: {
    iso: string;
    dayNum: number;
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    lessons: MonthLessonRow[];
  };
  basePath: string;
  childId: string | null;
  year: number;
  month: number;
}) {
  return (
    <div
      className={cn(
        "min-h-[150px] lg:min-h-[170px] xl:min-h-[190px] rounded-xl border flex flex-col transition-colors",
        day.isToday
          ? "border-navy-800/40 bg-gradient-to-b from-brand-50 to-white shadow-[0_6px_18px_-12px_rgba(29,41,81,0.3)]"
          : day.inMonth
            ? day.isWeekend
              ? "border-hairline/40 bg-brand-50/30"
              : "border-hairline/40 bg-card"
            : "border-hairline/30 bg-card/40",
      )}
    >
      <div
        className={cn(
          "px-3 pt-2.5 pb-1.5 flex items-center justify-between",
          day.isToday
            ? "text-navy-800"
            : day.inMonth
              ? "text-ink"
              : "text-muted/60",
        )}
      >
        <span className="text-lg font-medium tabular-nums leading-none">
          {day.dayNum}
        </span>
        {day.lessons.length > 0 && day.inMonth && (
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
            {day.lessons.length}
          </span>
        )}
      </div>

      <div className="px-2 pb-2 flex-1 space-y-1.5">
        {day.lessons.map((l) => (
          <LessonChip
            key={l.id}
            lesson={l}
            basePath={basePath}
            childId={childId}
            year={year}
            month={month}
            dimmed={!day.inMonth}
          />
        ))}
      </div>
    </div>
  );
}

function LessonChip({
  lesson,
  basePath,
  childId,
  year,
  month,
  dimmed,
}: {
  lesson: MonthLessonRow;
  basePath: string;
  childId: string | null;
  year: number;
  month: number;
  dimmed: boolean;
}) {
  const params = new URLSearchParams();
  params.set("reschedule", lesson.id);
  params.set("month", monthKey(year, month));
  if (childId) params.set("child", childId);
  const href = `${basePath}?${params.toString()}`;

  const tone = toneFor(lesson.status);
  const past = isPast(lesson.date);

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg px-2 py-1.5 leading-tight overflow-hidden transition-transform hover:translate-y-[-1px]",
        past ? "bg-brand-50/60 text-ink-soft" : tone.bg,
        dimmed && "opacity-50",
      )}
    >
      <div
        className={cn(
          "text-[11px] font-semibold tabular-nums",
          past ? "text-ink-soft" : tone.text,
        )}
      >
        {formatTime(lesson.startTime)}
      </div>
      <div
        className={cn(
          "mt-0.5 text-xs truncate font-medium",
          past ? "text-ink-soft" : tone.text,
        )}
      >
        {lesson.subjectName}
      </div>
    </Link>
  );
}

function toneFor(status: MonthLessonRow["status"]): { bg: string; text: string } {
  switch (status) {
    case "rescheduled":
    case "makeup":
      return { bg: "bg-amber-50", text: "text-amber-800" };
    case "cancelled":
    case "missed":
      return { bg: "bg-rose-50", text: "text-rose-700" };
    case "completed":
      return { bg: "bg-emerald-50", text: "text-emerald-800" };
    case "upcoming":
    default:
      return { bg: "bg-brand-50", text: "text-brand-700" };
  }
}

function isPast(dateIso: string): boolean {
  return dateIso < isoLocal(new Date());
}

function navigateMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function navigateToday() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} aria-hidden />
      {label}
    </span>
  );
}
