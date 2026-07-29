import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import type { MonthLessonRow } from "../_data";
import type { AvailableSlot } from "../_lib/availability";

export type CalendarMode = "view" | "pick-lesson" | "pick-slot";

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
  mode = "view",
  availableSlots = [],
  selectedLessonId = null,
}: {
  year: number;
  month: number;
  lessons: MonthLessonRow[];
  basePath: string;
  childId: string | null;
  mode?: CalendarMode;
  availableSlots?: AvailableSlot[];
  selectedLessonId?: string | null;
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

  const slotsByDate = new Map<string, AvailableSlot[]>();
  for (const s of availableSlots) {
    if (!slotsByDate.has(s.date)) slotsByDate.set(s.date, []);
    slotsByDate.get(s.date)!.push(s);
  }

  const days: {
    iso: string;
    dayNum: number;
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    lessons: MonthLessonRow[];
    slots: AvailableSlot[];
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
      slots: slotsByDate.get(iso) ?? [],
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
    if (mode === "pick-lesson") params.set("reschedule", "pick");
    if (mode === "pick-slot" && selectedLessonId) {
      params.set("reschedule", selectedLessonId);
    }
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-[-0.02em] text-ink tabular-nums">
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
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
          >
            ‹
          </Link>
          <Link
            href={navBase(next)}
            aria-label="Next month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
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
            mode={mode}
            selectedLessonId={selectedLessonId}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-5 pt-3 border-t border-line text-[10px] uppercase tracking-[0.14em] text-muted">
        <LegendDot color="bg-brand-600" label="Lesson" />
        <LegendDot color="bg-amber-500" label="Rescheduled" />
        <LegendDot color="bg-rose-500" label="Cancelled" />
        {mode === "pick-slot" && (
          <LegendDot color="bg-emerald-500" label="Available - click to move" />
        )}
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
  mode,
  selectedLessonId,
}: {
  day: {
    iso: string;
    dayNum: number;
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    lessons: MonthLessonRow[];
    slots: AvailableSlot[];
  };
  basePath: string;
  childId: string | null;
  year: number;
  month: number;
  mode: CalendarMode;
  selectedLessonId: string | null;
}) {
  return (
    <div
      className={cn(
        "min-h-[140px] lg:min-h-[156px] xl:min-h-[172px] rounded-xl border flex flex-col transition-colors",
        day.isToday
          ? "border-brand-500/50 bg-gradient-to-b from-brand-50 to-white shadow-[0_6px_18px_-12px_rgba(31,40,90,0.3)]"
          : day.inMonth
            ? day.isWeekend
              ? "border-line/70 bg-brand-50/30"
              : "border-line/70 bg-surface"
            : "border-line/50 bg-surface/40",
      )}
    >
      <div
        className={cn(
          "px-2.5 pt-1.5 pb-1 flex items-center justify-between",
          day.isToday
            ? "text-brand-700"
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

      <div className="px-1.5 pb-1.5 flex-1 space-y-1">
        {day.lessons.map((l) => (
          <LessonChip
            key={l.id}
            lesson={l}
            basePath={basePath}
            childId={childId}
            year={year}
            month={month}
            dimmed={!day.inMonth || (mode === "pick-slot" && l.id !== selectedLessonId)}
            mode={mode}
            isSelected={l.id === selectedLessonId}
          />
        ))}
        {mode === "pick-slot" &&
          day.inMonth &&
          day.slots.map((s, i) => (
            <SlotChip key={`${s.tutorId}-${s.startTime}-${i}`} slot={s} />
          ))}
      </div>
    </div>
  );
}

function SlotChip({ slot }: { slot: AvailableSlot }) {
  const value = `${slot.date}|${slot.startTime}|${slot.endTime}|${slot.tutorId}`;
  return (
    <button
      type="submit"
      name="slot"
      value={value}
      className="block w-full text-left rounded-md px-1.5 py-1 leading-tight overflow-hidden transition-all bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 hover:border-emerald-400 hover:-translate-y-[1px] cursor-pointer"
    >
      <div className="text-[11px] font-semibold tabular-nums text-emerald-800">
        {formatTime(slot.startTime)}
      </div>
      <div className="mt-0.5 text-xs truncate font-medium text-emerald-900">
        {slot.tutorName}
        {slot.isOriginalTutor && (
          <span className="ml-1 text-[10px] font-normal opacity-70">·same</span>
        )}
      </div>
    </button>
  );
}

function LessonChip({
  lesson,
  basePath,
  childId,
  year,
  month,
  dimmed,
  mode,
  isSelected,
}: {
  lesson: MonthLessonRow;
  basePath: string;
  childId: string | null;
  year: number;
  month: number;
  dimmed: boolean;
  mode: CalendarMode;
  isSelected: boolean;
}) {
  // Reschedule pages live only under /parent/classes, but this calendar renders
  // on many parent routes (dashboard, attendance, …) with different basePaths -
  // so the reschedule link is absolute, not basePath-relative.
  const href = `/parent/classes/reschedule/${lesson.id}${
    childId ? `?childId=${childId}` : ""
  }`;

  const tone = toneFor(lesson.status, lesson.subjectName);
  const past = isPast(lesson.date);

  // Past lessons can't be rescheduled (the page guards them), so don't link them.
  const interactive = mode !== "pick-slot" && !past;
  const baseClass = cn(
    "block rounded-md px-1.5 py-1 leading-tight overflow-hidden transition-transform",
    interactive && "hover:translate-y-[-1px]",
    dimmed && "opacity-40",
    isSelected && "ring-2 ring-brand-500 ring-offset-1",
  );
  const style = past
    ? { backgroundColor: "rgba(214,222,244,0.4)", color: "var(--ink-soft)" }
    : { backgroundColor: tone.bg, color: tone.text };

  if (!interactive) {
    return (
      <div className={baseClass} style={style} aria-disabled>
        <ChipInner lesson={lesson} />
      </div>
    );
  }

  return (
    <Link href={href} className={baseClass} style={style}>
      <ChipInner lesson={lesson} />
    </Link>
  );
}

function ChipInner({ lesson }: { lesson: MonthLessonRow }) {
  return (
    <>
      <div className="text-[11px] font-bold tabular-nums">
        {formatTime(lesson.startTime)}
      </div>
      <div className="mt-0.5 text-xs truncate font-semibold">
        {lesson.subjectName}
      </div>
    </>
  );
}

function toneFor(
  status: MonthLessonRow["status"],
  subjectName: string,
): { bg: string; text: string } {
  // Special statuses keep their semantic colour (cancelled = red, rescheduled = amber, etc.)
  switch (status) {
    case "rescheduled":
    case "makeup":
      return { bg: "#fde68a", text: "#78350f" };
    case "cancelled":
    case "missed":
      return { bg: "#fecdd3", text: "#881337" };
    default: {
      const t = getAccentTokens(colorFamilyForSubject(subjectName));
      return { bg: t.pillBg, text: t.pillText };
    }
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
