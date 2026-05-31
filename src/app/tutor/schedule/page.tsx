import Link from "next/link";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import { classes, lessons, subjects } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireTutor } from "../_data";
import { getWeeklyRules } from "../_lib/availability";
import { toggleAvailabilityRule } from "../_actions";

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
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}
function hh(n: number): string {
  return `${String(n).padStart(2, "0")}:00`;
}
function parseMonthParam(value: string | undefined): {
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
function navigate(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

type SearchParams = Promise<{ m?: string; edit?: string }>;

export default async function TutorSchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("tutor");
  const tutor = await requireTutor();
  const { m, edit } = await searchParams;
  const { year, month } = parseMonthParam(m);
  const isEdit = edit === "avail";

  const fromIso = isoLocal(new Date(year, month, 1));
  const toIso = isoLocal(new Date(year, month + 1, 1));

  const [lessonRows, rules] = await Promise.all([
    db
      .select({
        id: lessons.id,
        date: lessons.date,
        startTime: lessons.startTime,
        endTime: lessons.endTime,
        className: classes.name,
        subjectName: subjects.name,
      })
      .from(lessons)
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(
          eq(lessons.tutorId, tutor.id),
          gte(lessons.date, fromIso),
          lt(lessons.date, toIso),
        ),
      )
      .orderBy(asc(lessons.date), asc(lessons.startTime)),
    getWeeklyRules(tutor.id),
  ]);

  // Build month grid (Mon-first weeks).
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay();
  const mondayOffset = (firstDow + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const todayIso = isoLocal(new Date());

  const lessonsByDate = new Map<string, typeof lessonRows>();
  for (const l of lessonRows) {
    if (!lessonsByDate.has(l.date)) lessonsByDate.set(l.date, []);
    lessonsByDate.get(l.date)!.push(l);
  }

  // Index availability by `weekday-hour`.
  const availByCell = new Set<string>();
  for (const r of rules) {
    const startH = parseInt(r.startTime.slice(0, 2), 10);
    const endH = parseInt(r.endTime.slice(0, 2), 10);
    for (let h = startH; h < endH; h++) {
      availByCell.add(`${r.weekday}-${h}`);
    }
  }

  type Day = {
    iso: string;
    dayNum: number;
    weekday: number; // 0=Sun..6=Sat (JS Date.getDay)
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    lessons: typeof lessonRows;
  };
  const days: Day[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = isoLocal(d);
    days.push({
      iso,
      dayNum: d.getDate(),
      weekday: d.getDay(),
      inMonth: d.getMonth() === month,
      isToday: iso === todayIso,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      lessons: lessonsByDate.get(iso) ?? [],
    });
  }
  let usedRows = 6;
  while (
    usedRows > 4 &&
    days.slice((usedRows - 1) * 7, usedRows * 7).every((d) => !d.inMonth)
  )
    usedRows--;
  const visibleDays = days.slice(0, usedRows * 7);

  const prev = navigate(year, month, -1);
  const next = navigate(year, month, 1);
  const editParam = isEdit ? "" : "&edit=avail";
  const editToggleHref = `/tutor/schedule?m=${monthKey(year, month)}${editParam}`;
  const navHref = (mt: { year: number; month: number }) =>
    `/tutor/schedule?m=${monthKey(mt.year, mt.month)}${isEdit ? "&edit=avail" : ""}`;

  return (
    <div className="space-y-6">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Schedule
        </div>
        <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          {MONTH_NAMES[month]} {year}
        </h1>
      </header>

      <Card
        className="p-0 overflow-hidden rise"
        style={{ animationDelay: "60ms" }}
      >
        {/* Coloured tab header */}
        <div className="px-6 py-4 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between gap-3">
          <div className="text-xl font-medium text-ink">
            {MONTH_NAMES[month]} {year}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={editToggleHref}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isEdit
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-card text-ink border border-hairline/60 hover:border-brand-400 hover:bg-brand-50",
              )}
            >
              {isEdit ? "Done editing" : "Manage availability"}
            </Link>
          </div>
        </div>

        {isEdit && (
          <div className="px-6 py-3 border-b border-hairline/60 bg-emerald-50 text-sm text-emerald-900">
            Edit mode — click any empty hour dot to mark yourself available
            that weekday every week. Click a green dot to remove it. Amber dots
            are existing lessons (read-only).
          </div>
        )}

        <div className="px-5 py-4 flex items-center justify-between bg-card">
          <Link
            href={`/tutor/schedule${isEdit ? "?edit=avail" : ""}`}
            className="text-[11px] uppercase tracking-[0.16em] text-brand-700 hover:underline"
          >
            Today
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              href={navHref(prev)}
              aria-label="Previous month"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-hairline/60 bg-card text-lg text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
            >
              ‹
            </Link>
            <Link
              href={navHref(next)}
              aria-label="Next month"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-hairline/60 bg-card text-lg text-ink-soft hover:border-brand-400 hover:text-ink transition-colors"
            >
              ›
            </Link>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-b from-brand-50/30 to-transparent space-y-3">
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
                isEdit={isEdit}
                availByCell={availByCell}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-3 border-t border-hairline/60 text-[10px] uppercase tracking-[0.14em] text-muted">
            <Legend
              color="bg-amber-200 border border-amber-300"
              label="Teaching"
            />
            <Legend
              color="bg-emerald-200 border border-emerald-400"
              label="Available"
            />
            <Legend
              color="bg-brand-50 border border-hairline/40"
              label={isEdit ? "Empty — click to add" : "Empty"}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

type DayShape = {
  iso: string;
  dayNum: number;
  weekday: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  lessons: Array<{
    id: string;
    startTime: string;
    endTime: string;
    className: string;
    subjectName: string;
  }>;
};

function hourLabel(h: number): string {
  const suffix = h >= 12 ? "p" : "a";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}

function DayCell({
  day,
  isEdit,
  availByCell,
}: {
  day: DayShape;
  isEdit: boolean;
  availByCell: Set<string>;
}) {
  // Lesson hours occupied (for any hour in [startH, endH))
  const lessonHours = new Map<number, { className: string; subjectName: string }>();
  for (const l of day.lessons) {
    const startH = parseInt(l.startTime.slice(0, 2), 10);
    const endH = parseInt(l.endTime.slice(0, 2), 10);
    for (let h = startH; h < endH; h++) {
      lessonHours.set(h, {
        className: l.className,
        subjectName: l.subjectName,
      });
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-2 flex flex-col gap-2",
        isEdit ? "min-h-[280px]" : "min-h-[160px]",
        day.inMonth
          ? "bg-card border-hairline/50"
          : "bg-brand-50/20 border-hairline/30",
        day.isWeekend && day.inMonth && "bg-brand-50/30",
        day.isToday && "border-navy-800/40 ring-2 ring-brand-300 ring-offset-0",
      )}
    >
      <div
        className={cn(
          "text-xs tabular-nums font-semibold px-1",
          day.inMonth ? "text-ink" : "text-muted/60",
          day.isToday && "text-brand-700",
        )}
      >
        {day.dayNum}
      </div>

      {/* Lesson chips (compact summary at top) */}
      {day.lessons.length > 0 && (
        <div className="space-y-1">
          {day.lessons.slice(0, 2).map((l) => (
            <Link
              key={l.id}
              href={`/tutor/lessons/${l.id}`}
              className="block rounded-md px-2 py-1 text-[10px] leading-tight bg-amber-100 hover:bg-amber-200 transition-colors border border-amber-200"
              title={`${l.className} · ${formatTime(l.startTime)}-${formatTime(l.endTime)}`}
            >
              <div className="font-medium text-amber-900 truncate">
                {l.subjectName}
              </div>
              <div className="text-amber-800/80 tabular-nums">
                {formatTime(l.startTime)}
              </div>
            </Link>
          ))}
          {day.lessons.length > 2 && (
            <div className="text-[10px] text-muted px-1">
              +{day.lessons.length - 2} more
            </div>
          )}
        </div>
      )}

      {/* Timeslot grid — labeled hour pills, 3 columns */}
      <div className="mt-auto pt-1.5 border-t border-hairline/40">
        <div className="grid grid-cols-3 gap-1">
          {HOURS.map((h) => {
            const isLesson = lessonHours.has(h);
            const isAvail = availByCell.has(`${day.weekday}-${h}`);
            const label = hourLabel(h);
            const baseClasses =
              "h-7 rounded text-[10px] font-medium tabular-nums flex items-center justify-center transition-colors";
            const tone = isLesson
              ? "bg-amber-200 text-amber-900 border border-amber-300"
              : isAvail
                ? "bg-emerald-200 text-emerald-900 border border-emerald-400"
                : "bg-brand-50/40 text-muted border border-hairline/40";
            const title = isLesson
              ? `${formatTime(hh(h))} — ${lessonHours.get(h)!.subjectName}`
              : isAvail
                ? `${formatTime(hh(h))} — available${isEdit ? " (click to remove)" : ""}`
                : `${formatTime(hh(h))} — empty${isEdit ? " (click to add)" : ""}`;

            if (isEdit && !isLesson) {
              return (
                <form
                  key={h}
                  action={toggleAvailabilityRule}
                  className="contents"
                >
                  <input type="hidden" name="weekday" value={day.weekday} />
                  <input type="hidden" name="startTime" value={hh(h)} />
                  <input type="hidden" name="endTime" value={hh(h + 1)} />
                  <button
                    type="submit"
                    className={cn(
                      baseClasses,
                      tone,
                      "cursor-pointer",
                      isAvail
                        ? "hover:bg-emerald-300"
                        : "hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-800",
                    )}
                    title={title}
                    aria-label={title}
                  >
                    {label}
                  </button>
                </form>
              );
            }
            return (
              <div
                key={h}
                className={cn(baseClasses, tone)}
                title={title}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", color)} aria-hidden />
      {label}
    </span>
  );
}
