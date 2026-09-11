import Link from "next/link";
import { ChevronLeft, ChevronRight, Handshake } from "lucide-react";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { Card } from "@/components/student/card";
import { PageHead, SectionHead } from "@/components/student/page-head";
import { db } from "@/db/client";
import { classes, lessons, subjects } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { getTutorAbsenceLessonOptions } from "@/lib/tutor-cover";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";
import { AbsenceLeavePanel } from "../cover/_components/cover-controls";
import {
  getWeeklyRules,
  type WeeklyRule,
} from "../_lib/availability";
import {
  AvailabilityControls,
  type WeeklyAvailabilityWindow,
} from "./_components/availability-controls";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
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

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function parseMonthParam(value: string | undefined): {
  year: number;
  month: number;
} {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (month >= 1 && month <= 12) return { year, month: month - 1 };
  }
  const [year, month] = melbourneDate().split("-").map(Number);
  return { year, month: month - 1 };
}

function navigate(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function mergeWeeklyRules(rules: WeeklyRule[]): WeeklyAvailabilityWindow[] {
  const sorted = [...rules].sort(
    (a, b) =>
      (a.weekday === 0 ? 7 : a.weekday) -
        (b.weekday === 0 ? 7 : b.weekday) ||
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime),
  );
  const merged: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    ruleIds: string[];
  }> = [];

  for (const rule of sorted) {
    const current = merged.at(-1);
    if (
      current &&
      current.weekday === rule.weekday &&
      rule.startTime <= current.endTime
    ) {
      if (rule.endTime > current.endTime) current.endTime = rule.endTime;
      current.ruleIds.push(rule.id);
    } else {
      merged.push({
        weekday: rule.weekday,
        startTime: rule.startTime,
        endTime: rule.endTime,
        ruleIds: [rule.id],
      });
    }
  }

  return merged.map((window) => ({
    weekday: window.weekday,
    dayLabel: DAY_NAMES[window.weekday],
    timeLabel: `${formatTime(window.startTime)}–${formatTime(window.endTime)}`,
    ruleIds: window.ruleIds,
  }));
}

type SearchParams = Promise<{ m?: string; panel?: string }>;

export default async function TutorTimetablePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tutor = await requireRole("tutor");
  const { m, panel } = await searchParams;
  const { year, month } = parseMonthParam(m);

  const fromIso = isoLocal(new Date(year, month, 1));
  const toIso = isoLocal(new Date(year, month + 1, 1));
  const todayIso = melbourneDate();

  const [lessonRows, rules, absenceLessons] = await Promise.all([
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
    getTutorAbsenceLessonOptions(tutor.id),
  ]);

  const weeklyWindows = mergeWeeklyRules(rules);
  const lessonOptions = absenceLessons.map((lesson) => ({
    id: lesson.id,
    label:
      `${formatDateLong(lesson.date)} · ${formatTime(lesson.startTime)} · ` +
      classDisplayName(lesson.subjectName, lesson.className),
  }));

  const lessonsByDate = new Map<string, typeof lessonRows>();
  for (const lesson of lessonRows) {
    const list = lessonsByDate.get(lesson.date) ?? [];
    list.push(lesson);
    lessonsByDate.set(lesson.date, list);
  }

  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const days: DayShape[] = [];
  for (let index = 0; index < 42; index++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const iso = isoLocal(date);
    days.push({
      iso,
      dayNum: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: iso === todayIso,
      lessons: lessonsByDate.get(iso) ?? [],
    });
  }
  let usedRows = 6;
  while (
    usedRows > 4 &&
    days
      .slice((usedRows - 1) * 7, usedRows * 7)
      .every((day) => !day.inMonth)
  ) {
    usedRows -= 1;
  }
  const visibleDays = days.slice(0, usedRows * 7);
  const previousMonth = navigate(year, month, -1);
  const nextMonth = navigate(year, month, 1);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Schedule"
        title="Schedule & availability"
        sub="Review your timetable, set recurring teaching hours, or report time away."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AvailabilityControls weeklyWindows={weeklyWindows} />
            <AbsenceLeavePanel
              lessons={lessonOptions}
              initialOpen={panel === "leave"}
            />
            <Link
              href="/tutor/cover"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[12px] font-bold text-ink hover:border-brand-400 hover:text-brand-700"
            >
              <Handshake className="h-4 w-4" aria-hidden />
              Open cover board
            </Link>
          </div>
        }
      />

      <section aria-labelledby="calendar-heading">
        <SectionHead
          title={<span id="calendar-heading">Your monthly timetable</span>}
        />
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-[15px] font-extrabold text-ink">
                {MONTH_NAMES[month]} {year}
              </h2>
              <Link
                href="/tutor/timetable#calendar-heading"
                className="mt-0.5 inline-block text-[11px] font-bold text-brand-600 hover:text-brand-700"
              >
                Return to this month
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              <MonthButton
                month={previousMonth}
                label="Previous month"
                direction="left"
              />
              <MonthButton
                month={nextMonth}
                label="Next month"
                direction="right"
              />
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[720px] space-y-1.5">
                <div className="grid grid-cols-7 gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  {DAY_LABELS.map((day) => (
                    <div key={day} className="py-1.5 text-center">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {visibleDays.map((day) => (
                    <DayCell key={day.iso} day={day} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5 border-t border-line pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              <Legend color="bg-brand-500" label="Teaching" />
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

type DayShape = {
  iso: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  lessons: Array<{
    id: string;
    startTime: string;
    endTime: string;
    className: string;
    subjectName: string;
  }>;
};

function DayCell({ day }: { day: DayShape }) {
  return (
    <div
      className={cn(
        "min-h-[150px] rounded-xl border p-1.5",
        day.isToday
          ? "border-brand-400 bg-surface ring-1 ring-brand-300/40"
          : day.inMonth
            ? "border-line bg-surface"
            : "border-line bg-surface-2",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1 px-0.5">
        {day.isToday ? (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[12px] font-extrabold leading-none text-white">
            {day.dayNum}
          </span>
        ) : (
          <span
            className={cn(
              "text-[13px] font-bold leading-none",
              day.inMonth ? "text-ink" : "text-muted-2",
            )}
          >
            {day.dayNum}
          </span>
        )}
      </div>

      {day.lessons.length > 0 && (
        <div className="mt-2 space-y-1">
          {day.lessons.slice(0, 3).map((lesson) => {
            const tokens = getAccentTokens(
              colorFamilyForSubject(lesson.subjectName),
            );
            return (
              <Link
                key={lesson.id}
                href={`/tutor/lessons/${lesson.id}`}
                className="relative block overflow-hidden rounded-md py-1 pl-2 pr-1.5 text-[10px] leading-tight transition-transform hover:-translate-y-[1px]"
                style={{
                  backgroundColor: tokens.pillBg,
                  color: tokens.pillText,
                }}
                title={`${classDisplayName(lesson.subjectName, lesson.className)} · ${formatTime(lesson.startTime)}–${formatTime(lesson.endTime)}`}
              >
                <span
                  aria-hidden
                  className="absolute bottom-1 left-0 top-1 w-[3px] rounded-full"
                  style={{ backgroundColor: tokens.arrow }}
                />
                <div className="truncate font-bold">{lesson.subjectName}</div>
                <div className="tabular-nums opacity-80">
                  {formatTime(lesson.startTime)}
                </div>
              </Link>
            );
          })}
          {day.lessons.length > 3 && (
            <div className="px-0.5 text-[10px] text-muted">
              +{day.lessons.length - 3} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MonthButton({
  month,
  label,
  direction,
}: {
  month: { year: number; month: number };
  label: string;
  direction: "left" | "right";
}) {
  return (
    <Link
      href={`/tutor/timetable?m=${monthKey(month.year, month.month)}#calendar-heading`}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-brand-300 hover:text-ink"
    >
      {direction === "left" ? (
        <ChevronLeft className="h-4 w-4" aria-hidden />
      ) : (
        <ChevronRight className="h-4 w-4" aria-hidden />
      )}
    </Link>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} aria-hidden />
      {label}
    </span>
  );
}
