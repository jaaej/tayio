import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTime, startOfMondayWeek } from "@/lib/format";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";

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
  /** Per-student reschedule overlay (optional; defaults to a normal lesson). */
  studentState?:
    | "normal"
    | "moved_out"
    | "makeup_in"
    | "pending_out"
    | "pending_in";
  moveLabel?: string | null;
  /** When set, the chip is a link to reschedule this lesson. */
  rescheduleHref?: string | null;
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

/** Parse ?week=YYYY-MM-DD, snapping any date to its Monday. Defaults to the current week. */
export function parseWeekParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return startOfMondayWeek(d);
  }
  return startOfMondayWeek(new Date());
}

export function weekBounds(weekStart: Date): {
  fromIso: string;
  toIso: string;
} {
  const to = new Date(weekStart);
  to.setDate(weekStart.getDate() + 7);
  return { fromIso: isoLocal(weekStart), toIso: isoLocal(to) };
}

export function MonthCalendar({
  year,
  month,
  lessons,
  homework,
  basePath,
  subjectColorHomework = false,
}: {
  year: number;
  month: number;
  lessons: MonthLesson[];
  homework: MonthHomework[];
  basePath: string;
  /**
   * Colour homework chips by subject accent family (like lesson chips)
   * instead of by status; status moves to the left bar + ring
   * (red = overdue, green = submitted). Used by the subjects page.
   */
  subjectColorHomework?: boolean;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink tabular-nums">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Link
            href={navBase(today)}
            className="text-[11px] uppercase tracking-[0.16em] text-brand-600 hover:text-brand-700 font-bold"
          >
            Today
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={navBase(prev)}
            aria-label="Previous month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-300 hover:text-ink transition-colors"
          >
            ‹
          </Link>
          <Link
            href={navBase(next)}
            aria-label="Next month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-300 hover:text-ink transition-colors"
          >
            ›
          </Link>
        </div>
      </div>

      {/* Calendar grid wrapped in a tinted frame so the cells read as
          a single object on the cornflower page background. */}
      <div className="rounded-2xl border border-line bg-surface-2/60 p-1.5">
        <div className="grid grid-cols-7 gap-0 mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-2 font-bold">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-center py-2",
                (i === 5 || i === 6) && "text-muted",
              )}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {visibleDays.map((d) => (
            <DayCell
              key={d.iso}
              day={d}
              subjectColorHomework={subjectColorHomework}
            />
          ))}
        </div>
      </div>

      <CalendarLegend subjectColorHomework={subjectColorHomework} />
    </div>
  );
}

/**
 * WeekCalendar — single Mon–Sun row using the same day cells, chips, and
 * legend as MonthCalendar, navigable via ?week=YYYY-MM-DD links.
 */
export function WeekCalendar({
  weekStart,
  lessons,
  homework,
  basePath,
  subjectColorHomework = false,
}: {
  /** Monday of the displayed week (midnight, local). */
  weekStart: Date;
  lessons: MonthLesson[];
  homework: MonthHomework[];
  basePath: string;
  subjectColorHomework?: boolean;
}) {
  const todayIso = isoLocal(new Date());

  const lessonsByDate = new Map<string, MonthLesson[]>();
  for (const l of lessons) {
    if (!lessonsByDate.has(l.date)) lessonsByDate.set(l.date, []);
    lessonsByDate.get(l.date)!.push(l);
  }
  for (const list of lessonsByDate.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  const homeworkByDate = new Map<string, MonthHomework[]>();
  for (const h of homework) {
    if (!homeworkByDate.has(h.dueDate)) homeworkByDate.set(h.dueDate, []);
    homeworkByDate.get(h.dueDate)!.push(h);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const iso = isoLocal(d);
    return {
      iso,
      dayNum: d.getDate(),
      inMonth: true,
      isToday: iso === todayIso,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      lessons: lessonsByDate.get(iso) ?? [],
      homework: homeworkByDate.get(iso) ?? [],
    };
  });

  const prev = new Date(weekStart);
  prev.setDate(weekStart.getDate() - 7);
  const next = new Date(weekStart);
  next.setDate(weekStart.getDate() + 7);
  const nav = (d: Date) => `${basePath}?week=${isoLocal(d)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink tabular-nums">
            {weekRangeLabel(weekStart)}
          </h2>
          <Link
            href={nav(startOfMondayWeek(new Date()))}
            className="text-[11px] uppercase tracking-[0.16em] text-brand-600 hover:text-brand-700 font-bold"
          >
            Today
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={nav(prev)}
            aria-label="Previous week"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-300 hover:text-ink transition-colors"
          >
            ‹
          </Link>
          <Link
            href={nav(next)}
            aria-label="Next week"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink-soft hover:border-brand-300 hover:text-ink transition-colors"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2/60 p-1.5">
        <div className="grid grid-cols-7 gap-0 mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-2 font-bold">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-center py-2",
                (i === 5 || i === 6) && "text-muted",
              )}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => (
            <DayCell
              key={d.iso}
              day={d}
              subjectColorHomework={subjectColorHomework}
            />
          ))}
        </div>
      </div>

      <CalendarLegend subjectColorHomework={subjectColorHomework} />
    </div>
  );
}

function weekRangeLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear && start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  }
  const part = (d: Date, withYear: boolean) =>
    `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}${withYear ? ` ${d.getFullYear()}` : ""}`;
  return `${part(start, !sameYear)} – ${part(end, true)}`;
}

function CalendarLegend({
  subjectColorHomework,
}: {
  subjectColorHomework: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[10px] uppercase tracking-[0.14em] text-muted font-bold">
      {subjectColorHomework ? (
        <>
          <LegendDot color="bg-bad" label="Overdue" />
          <LegendDot color="bg-good" label="Submitted" />
          <span className="normal-case tracking-normal text-muted-2">
            Chips coloured by subject
          </span>
        </>
      ) : (
        <>
          <LegendDot color="bg-brand-500" label="Lesson" />
          <LegendDot color="bg-amber-500" label="Homework due" />
          <LegendDot color="bg-good" label="Done" />
          <LegendDot color="bg-bad" label="Cancelled" />
        </>
      )}
    </div>
  );
}

function DayCell({
  day,
  subjectColorHomework,
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
  subjectColorHomework: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-[140px] lg:min-h-[160px] xl:min-h-[180px] rounded-xl border flex flex-col transition-colors",
        !day.inMonth
          ? "border-line/40 bg-surface-2/40"
          : day.isToday
            ? "border-brand-400 bg-surface ring-1 ring-brand-300/40"
            : day.isWeekend
              ? "border-line bg-surface-2/40"
              : "border-line bg-surface",
      )}
    >
      <div className="px-2.5 pt-2 pb-1.5 flex items-center justify-between">
        {day.isToday ? (
          <span className="inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-full bg-brand-500 text-white text-[14px] font-extrabold tabular-nums leading-none">
            {day.dayNum}
          </span>
        ) : (
          <span
            className={cn(
              "text-[15px] font-bold tabular-nums leading-none",
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
        {(day.lessons.length + day.homework.length) > 0 && day.inMonth && (
          <span className="text-[10px] uppercase tracking-[0.1em] text-muted-2 tabular-nums font-bold">
            {day.lessons.length + day.homework.length}
          </span>
        )}
      </div>

      <div className="px-1.5 pb-1.5 flex-1 space-y-1 overflow-hidden">
        {day.lessons.map((l) => (
          <LessonChip key={l.id} lesson={l} dimmed={!day.inMonth} />
        ))}
        {day.homework.map((h) =>
          subjectColorHomework ? (
            <SubjectHomeworkChip key={h.id} homework={h} dimmed={!day.inMonth} />
          ) : (
            <HomeworkChip key={h.id} homework={h} dimmed={!day.inMonth} />
          ),
        )}
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
  const moved = lesson.studentState === "moved_out";
  const makeup = lesson.studentState === "makeup_in";
  const pending =
    lesson.studentState === "pending_in" || lesson.studentState === "pending_out";
  const tone =
    moved || makeup || pending
      ? { bg: "var(--warn-bg)", text: "var(--warn)", bar: "var(--warn)" }
      : lessonTone(lesson.status, lesson.date, lesson.subjectName);

  const inner = (
    <>
      <span
        aria-hidden
        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
        style={{ backgroundColor: tone.bar }}
      />
      <div
        className={cn(
          "text-[10px] font-extrabold tabular-nums",
          moved && "line-through opacity-70",
        )}
      >
        {formatTime(lesson.startTime)}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[11px] truncate font-bold",
          moved && "line-through opacity-70",
        )}
      >
        {lesson.subjectName}
      </div>
      {lesson.moveLabel && (
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide truncate opacity-90">
          {lesson.moveLabel}
        </div>
      )}
    </>
  );

  const base = cn(
    "relative rounded-md pl-2 pr-1.5 py-1 leading-tight overflow-hidden",
    dimmed && "opacity-50",
  );
  const style = { backgroundColor: tone.bg, color: tone.text };

  if (lesson.rescheduleHref) {
    return (
      <Link
        href={lesson.rescheduleHref}
        className={cn(base, "transition-transform hover:-translate-y-[1px]")}
        style={style}
        title="Reschedule this lesson"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className={base} style={style}>
      {inner}
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
        "relative block rounded-md pl-2 pr-1.5 py-1 leading-tight overflow-hidden transition-transform hover:-translate-y-[1px]",
        done ? "bg-good-bg" : "bg-warn-bg",
        dimmed && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 bottom-1 w-[3px] rounded-full",
          done ? "bg-good" : "bg-warn",
        )}
      />
      <div
        className={cn(
          "text-[11px] truncate font-bold",
          done ? "text-good" : "text-warn",
        )}
      >
        {h.title}
      </div>
    </Link>
  );
}

/**
 * Homework chip coloured by subject (same accent treatment as LessonChip).
 * Status is carried by the left bar + ring rather than the fill:
 * red bar + ring = overdue, green bar + dimmed = submitted/marked.
 */
function SubjectHomeworkChip({
  homework: h,
  dimmed,
}: {
  homework: MonthHomework;
  dimmed: boolean;
}) {
  const subject = h.className ?? "Homework";
  const t = getAccentTokens(colorFamilyForSubject(subject));
  const done = h.status === "submitted" || h.status === "marked";
  const overdue =
    !done && (h.status === "late" || h.dueDate < isoLocal(new Date()));
  const stateLabel = overdue ? ", overdue" : done ? ", submitted" : "";
  return (
    <Link
      href={`/student/homework/${h.id}`}
      title={`${h.title} — ${subject}`}
      aria-label={`${h.title} — ${subject}, due ${h.dueDate}${stateLabel}`}
      className={cn(
        "relative block rounded-md pl-2 pr-1.5 py-1 leading-tight overflow-hidden transition-transform hover:-translate-y-[1px]",
        overdue && "ring-1 ring-inset ring-bad/60",
        (dimmed || done) && "opacity-50",
      )}
      style={{
        backgroundColor: done ? t.bgTo : t.pillBg,
        color: t.pillText,
      }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 bottom-1 w-[3px] rounded-full",
          overdue && "bg-bad",
          done && "bg-good",
        )}
        style={overdue || done ? undefined : { backgroundColor: t.arrow }}
      />
      <div className="text-[11px] truncate font-bold">{h.title}</div>
    </Link>
  );
}

function lessonTone(
  status: MonthLesson["status"],
  dateIso: string,
  subjectName: string,
) {
  if (status === "cancelled" || status === "missed") {
    return { bg: "var(--bad-bg)", text: "var(--bad)", bar: "var(--bad)" };
  }
  if (status === "rescheduled" || status === "makeup") {
    return { bg: "var(--warn-bg)", text: "var(--warn)", bar: "var(--warn)" };
  }
  const t = getAccentTokens(colorFamilyForSubject(subjectName));
  if (dateIso < isoLocal(new Date())) {
    return { bg: t.bgTo, text: t.meta, bar: t.arrow };
  }
  return { bg: t.pillBg, text: t.pillText, bar: t.arrow };
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
