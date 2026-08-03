import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { and, asc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { Card } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { db } from "@/db/client";
import {
  classes,
  lessons,
  subjects,
  tutorAvailability,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireTutor } from "../_data";
import { getWeeklyRules } from "../_lib/availability";
import {
  toggleAvailabilityRule,
  toggleDateOverride,
  toggleDayIsolation,
} from "../_actions";

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

export default async function TutorTimetablePage({
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

  const [lessonRows, rules, dateOverrideRows] = await Promise.all([
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
    // All date-specific override rows for this tutor in the visible month
    // range. Two flavors live here:
    //   1. Isolation sentinel: 00:00:00–23:59:59, isAvailable=false →
    //      detaches the date from recurring weekly rules.
    //   2. Hourly date override: isAvailable=true, e.g. 15:00–16:00 →
    //      adds an isolated-day-only slot.
    db
      .select({
        date: tutorAvailability.date,
        startTime: tutorAvailability.startTime,
        endTime: tutorAvailability.endTime,
        isAvailable: tutorAvailability.isAvailable,
      })
      .from(tutorAvailability)
      .where(
        and(
          eq(tutorAvailability.tutorId, tutor.id),
          isNotNull(tutorAvailability.date),
        ),
      ),
  ]);
  const isolatedDates = new Set<string>();
  // Map<dateIso, Set<hour>> of positive date overrides - used when the day
  // is isolated to drive its independent hour pills.
  const dateOverrideHours = new Map<string, Set<number>>();
  for (const r of dateOverrideRows) {
    if (!r.date) continue;
    if (
      !r.isAvailable &&
      r.startTime === "00:00:00" &&
      r.endTime === "23:59:59"
    ) {
      isolatedDates.add(r.date);
    } else if (r.isAvailable) {
      const h = parseInt(r.startTime.slice(0, 2), 10);
      if (!dateOverrideHours.has(r.date))
        dateOverrideHours.set(r.date, new Set());
      dateOverrideHours.get(r.date)!.add(h);
    }
  }

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
    weekday: number;
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    isIsolated: boolean;
    isPast: boolean;
    dateOverrideHours: Set<number>;
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
      isIsolated: isolatedDates.has(iso),
      isPast: iso < todayIso,
      dateOverrideHours: dateOverrideHours.get(iso) ?? new Set(),
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
  const editToggleHref = `/tutor/timetable?m=${monthKey(year, month)}${editParam}`;
  const navHref = (mt: { year: number; month: number }) =>
    `/tutor/timetable?m=${monthKey(mt.year, mt.month)}${isEdit ? "&edit=avail" : ""}`;

  const lessonCount = lessonRows.length;
  const availCount = rules.length;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Timetable"
        title={`${MONTH_NAMES[month]} ${year}`}
        sub={`${lessonCount} lesson${lessonCount === 1 ? "" : "s"} this month · ${availCount} weekly availability slot${availCount === 1 ? "" : "s"}`}
        actions={
          <Link
            href={editToggleHref}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors",
              isEdit
                ? "bg-good text-white hover:opacity-90"
                : "bg-brand-600 text-white hover:bg-brand-700",
            )}
          >
            {isEdit ? "Done editing" : "Manage availability"}
          </Link>
        }
      />

      {isEdit && (
        <div className="rounded-[12px] border border-good/40 bg-good-bg px-3.5 py-2.5 text-[12px] text-good leading-snug">
          <strong className="font-extrabold">Edit mode.</strong> Click any empty
          hour pill to mark yourself available that weekday <em>every</em>{" "}
          week. Click a green pill to remove it. To make one specific date
          differ from your weekly rules (e.g. only 3pm available on week 3
          Tuesday), click the small <span className="text-grape">·</span>{" "}
          button in that day's corner to <em>isolate</em> it, then its pills
          edit that date only. Amber pills are existing lessons (read-only).
          Availability is visible to admins for parent reschedule + class
          assignment.
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-line">
          <Link
            href={`/tutor/timetable${isEdit ? "?edit=avail" : ""}`}
            className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 hover:text-brand-700"
          >
            Today
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              href={navHref(prev)}
              aria-label="Previous month"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-muted hover:border-brand-300 hover:text-ink transition-colors"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={navHref(next)}
              aria-label="Next month"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-muted hover:border-brand-300 hover:text-ink transition-colors"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-7 gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted font-bold">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center py-1.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {visibleDays.map((d) => (
              <DayCell
                key={d.iso}
                day={d}
                isEdit={isEdit}
                availByCell={availByCell}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-3 border-t border-line text-[10px] uppercase tracking-[0.12em] text-muted font-bold">
            <Legend
              color="bg-sun-100 border border-sun-300"
              label="Teaching"
            />
            <Legend
              color="bg-grape-bg border border-grape/50"
              label="Isolated day"
            />
            {isEdit && (
              <>
                <Legend
                  color="bg-good-bg border border-good/50"
                  label="Available (weekly)"
                />
                <Legend
                  color="bg-grape-bg border border-grape/50"
                  label="Available (this day only)"
                />
                <Legend
                  color="bg-surface border border-line"
                  label="Empty - click to add"
                />
              </>
            )}
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
  isIsolated: boolean;
  isPast: boolean;
  dateOverrideHours: Set<number>;
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
  const lessonHours = new Map<
    number,
    { className: string; subjectName: string }
  >();
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

  const canToggleIsolation = day.inMonth && !day.isPast;

  return (
    <div
      className={cn(
        "rounded-xl border p-1.5 flex flex-col gap-1.5",
        isEdit ? "min-h-[260px]" : "min-h-[150px]",
        day.isIsolated
          ? "bg-grape-bg border-grape/50"
          : day.isToday
            ? "bg-surface border-brand-400 ring-1 ring-brand-300/40"
            : day.inMonth
              ? "bg-surface border-line"
              : "bg-surface-2 border-line",
      )}
    >
      <div className="flex items-center justify-between gap-1 px-0.5">
        {day.isToday ? (
          <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-brand-500 text-white text-[12px] font-extrabold tabular-nums leading-none">
            {day.dayNum}
          </span>
        ) : (
          <span
            className={cn(
              "text-[13px] tabular-nums font-bold leading-none",
              day.inMonth ? "text-ink" : "text-muted-2",
              day.isIsolated && "text-grape",
            )}
          >
            {day.dayNum}
          </span>
        )}
        {canToggleIsolation && (
          <form action={toggleDayIsolation} className="contents">
            <input type="hidden" name="date" value={day.iso} />
            <button
              type="submit"
              className={cn(
                "h-4 w-4 rounded-[4px] border flex items-center justify-center text-[9px] font-bold leading-none transition-colors",
                day.isIsolated
                  ? "bg-grape border-grape text-white hover:opacity-90"
                  : "bg-surface border-line text-muted-2 hover:border-grape hover:text-grape",
              )}
              title={
                day.isIsolated
                  ? "Re-link to weekly rules (this day's custom slots will be cleared)"
                  : "Isolate this day - edit its slots independently of the weekly rules"
              }
              aria-pressed={day.isIsolated}
              aria-label={
                day.isIsolated
                  ? `Re-link ${day.iso} to weekly rules`
                  : `Isolate ${day.iso} from weekly rules`
              }
            >
              {day.isIsolated ? "✕" : "·"}
            </button>
          </form>
        )}
      </div>
      {day.isIsolated && (
        <div className="px-0.5 text-[9px] uppercase tracking-[0.1em] font-extrabold text-grape">
          Isolated
        </div>
      )}

      {day.lessons.length > 0 && (
        <div className="space-y-1">
          {day.lessons.slice(0, 2).map((l) => (
            <Link
              key={l.id}
              href={`/tutor/lessons/${l.id}`}
              className="block rounded-[6px] px-1.5 py-0.5 text-[10px] leading-tight bg-sun-100 hover:bg-sun-200 transition-colors border border-sun-300"
              title={`${l.className} · ${formatTime(l.startTime)}-${formatTime(l.endTime)}`}
            >
              <div className="font-bold text-sun-ink truncate">
                {l.subjectName}
              </div>
              <div className="text-sun-ink/80 tabular-nums">
                {formatTime(l.startTime)}
              </div>
            </Link>
          ))}
          {day.lessons.length > 2 && (
            <div className="text-[10px] text-muted px-0.5">
              +{day.lessons.length - 2} more
            </div>
          )}
        </div>
      )}

      {isEdit && (
      <div className="mt-auto pt-1 border-t border-line">
        <div className="grid grid-cols-3 gap-0.5">
          {HOURS.map((h) => {
            const isLesson = lessonHours.has(h);
            // Isolated day → state + writes go through date-specific
            // overrides (toggleDateOverride). Normal day → recurring
            // weekly rules (toggleAvailabilityRule).
            const isAvail = day.isIsolated
              ? day.dateOverrideHours.has(h)
              : availByCell.has(`${day.weekday}-${h}`);
            const label = hourLabel(h);
            const baseClasses =
              "h-6 rounded text-[10px] font-bold tabular-nums flex items-center justify-center transition-colors";
            const availTone = day.isIsolated
              ? "bg-grape-bg text-grape border border-grape/50"
              : "bg-good-bg text-good border border-good/50";
            const tone = isLesson
              ? "bg-sun-100 text-sun-ink border border-sun-300"
              : isAvail
                ? availTone
                : "bg-surface text-muted-2 border border-line";
            const title = isLesson
              ? `${formatTime(hh(h))} - ${lessonHours.get(h)!.subjectName}`
              : isAvail
                ? `${formatTime(hh(h))} - available${day.isIsolated ? " (this day only)" : ""} (click to remove)`
                : `${formatTime(hh(h))} - empty (click to add${day.isIsolated ? " - this day only" : ""})`;

            if (!isLesson) {
              if (day.isIsolated) {
                return (
                  <form
                    key={h}
                    action={toggleDateOverride}
                    className="contents"
                  >
                    <input type="hidden" name="date" value={day.iso} />
                    <input type="hidden" name="startTime" value={hh(h)} />
                    <input type="hidden" name="endTime" value={hh(h + 1)} />
                    <input type="hidden" name="setUnavailable" value="0" />
                    <button
                      type="submit"
                      className={cn(
                        baseClasses,
                        tone,
                        "cursor-pointer hover:border-grape",
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
                      "cursor-pointer hover:border-brand-300",
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
              <div key={h} className={cn(baseClasses, tone)} title={title}>
                {label}
              </div>
            );
          })}
        </div>
      </div>
      )}
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
