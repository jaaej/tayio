import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type MonthLesson = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status:
    | "upcoming"
    | "completed"
    | "cancelled"
    | "rescheduled"
    | "makeup"
    | "missed";
  subjectName: string;
  className: string;
};

export type MonthHomework = {
  id: string;
  dueDate: string;
  title: string;
  status:
    | "not_started"
    | "viewed"
    | "submitted"
    | "marked"
    | "returned"
    | "resubmission_requested"
    | "late";
  className: string | null;
};

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function parseMonthParam(value: string | undefined): {
  year: number;
  month: number;
} {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function monthBounds(
  year: number,
  month: number,
): { fromIso: string; toIso: string } {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  return { fromIso: isoLocal(from), toIso: isoLocal(to) };
}

export function MonthCalendar({
  year,
  month,
  lessons,
  homework,
  basePath,
}: {
  year: number;
  month: number;
  lessons: MonthLesson[];
  homework: MonthHomework[];
  basePath: string;
}) {
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay();
  const mondayOffset = (firstDow + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);

  const todayIso = isoLocal(new Date());

  const lessonsByDate = new Map<string, MonthLesson[]>();
  for (const l of lessons) {
    if (!lessonsByDate.has(l.date)) lessonsByDate.set(l.date, []);
    lessonsByDate.get(l.date)!.push(l);
  }
  // Sort each day's lessons by start time
  for (const list of lessonsByDate.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const homeworkByDate = new Map<string, MonthHomework[]>();
  for (const h of homework) {
    if (!homeworkByDate.has(h.dueDate)) homeworkByDate.set(h.dueDate, []);
    homeworkByDate.get(h.dueDate)!.push(h);
  }

  type Day = {
    iso: string;
    dayNum: number;
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    lessons: MonthLesson[];
    homework: MonthHomework[];
  };

  const days: Day[] = [];
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
      lessons: lessonsByDate.get(iso) ?? [],
      homework: homeworkByDate.get(iso) ?? [],
    });
  }

  // Trim trailing all-out-of-month row
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

  const navBase = (m: { year: number; month: number }) =>
    `${basePath}?month=${monthKey(m.year, m.month)}`;

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
          <DayCell key={d.iso} day={d} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-hairline/60 text-[10px] uppercase tracking-[0.14em] text-muted">
        <LegendDot color="bg-brand-600" label="Lesson" />
        <LegendDot color="bg-amber-500" label="Homework due" />
        <LegendDot color="bg-emerald-500" label="Completed" />
        <LegendDot color="bg-rose-500" label="Cancelled" />
      </div>
    </div>
  );
}

function DayCell({
  day,
}: {
  day: {
    iso: string;
    dayNum: number;
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    lessons: MonthLesson[];
    homework: MonthHomework[];
  };
}) {
  const eventCount = day.lessons.length + day.homework.length;
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
        {eventCount > 0 && day.inMonth && (
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted tabular-nums">
            {eventCount}
          </span>
        )}
      </div>

      <div className="px-2 pb-2 flex-1 space-y-1.5">
        {day.lessons.map((l) => (
          <LessonChip key={l.id} lesson={l} dimmed={!day.inMonth} />
        ))}
        {day.homework.map((h) => (
          <HomeworkChip key={h.id} homework={h} dimmed={!day.inMonth} />
        ))}
      </div>
    </div>
  );
}

function LessonChip({
  lesson,
  dimmed,
}: {
  lesson: MonthLesson;
  dimmed: boolean;
}) {
  const tone = lessonTone(lesson.status, lesson.date);
  return (
    <div
      className={cn(
        "relative rounded-lg pl-2.5 pr-2 py-1.5 leading-tight overflow-hidden",
        tone.bg,
        dimmed && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute left-0 top-1 bottom-1 w-[3px] rounded-full", tone.bar)}
      />
      <div
        className={cn("text-[11px] font-semibold tabular-nums", tone.text)}
      >
        {formatTime(lesson.startTime)}
      </div>
      <div className={cn("mt-0.5 text-xs truncate font-medium", tone.text)}>
        {lesson.subjectName}
      </div>
    </div>
  );
}

function HomeworkChip({
  homework: h,
  dimmed,
}: {
  homework: MonthHomework;
  dimmed: boolean;
}) {
  const done = h.status === "submitted" || h.status === "marked";
  return (
    <Link
      href={`/student/homework/${h.id}`}
      className={cn(
        "relative block rounded-lg pl-2.5 pr-2 py-1.5 leading-tight overflow-hidden transition-transform hover:translate-y-[-1px]",
        done ? "bg-emerald-100" : "bg-amber-100",
        dimmed && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 bottom-1 w-[3px] rounded-full",
          done ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      <div
        className={cn(
          "text-[9px] uppercase tracking-[0.14em] font-semibold",
          done ? "text-emerald-700" : "text-amber-800",
        )}
      >
        {done ? "Done" : "Due"}
      </div>
      <div
        className={cn(
          "mt-0.5 text-xs truncate font-medium",
          done ? "text-emerald-800" : "text-amber-900",
        )}
      >
        {h.title}
      </div>
    </Link>
  );
}

function lessonTone(status: MonthLesson["status"], dateIso: string) {
  if (status === "completed") {
    return {
      bg: "bg-emerald-100",
      text: "text-emerald-800",
      bar: "bg-emerald-500",
    };
  }
  if (status === "cancelled" || status === "missed") {
    return {
      bg: "bg-rose-100",
      text: "text-rose-700",
      bar: "bg-rose-500",
    };
  }
  if (status === "rescheduled" || status === "makeup") {
    return {
      bg: "bg-amber-100",
      text: "text-amber-800",
      bar: "bg-amber-500",
    };
  }
  // upcoming — soft past dimming if the date has already gone
  if (dateIso < isoLocal(new Date())) {
    return {
      bg: "bg-brand-100/60",
      text: "text-ink-soft",
      bar: "bg-brand-400",
    };
  }
  return {
    bg: "bg-brand-100",
    text: "text-brand-800",
    bar: "bg-brand-600",
  };
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
