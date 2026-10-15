import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { MonthGrid, type MonthChip } from "@/components/calendar/month-grid";
import { buttonVariants, Empty, Pill, type PillTone } from "@/components/admin/ui";
import { db } from "@/db/client";
import { classes, lessons, subjects, tutorCoverRequests } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { classDisplayName } from "@/lib/class-display";
import {
  formatDateLong,
  formatMonthShort,
  formatTime,
  formatTimeRange,
  formatWeekday,
} from "@/lib/format";
import { weeklyWindowsByDay } from "@/lib/availability-windows";
import { subjectTone } from "@/lib/subject-tone";
import { getTutorAbsenceLessonOptions } from "@/lib/tutor-cover";
import { melbourneDate, tutorCoverClassLabel } from "@/lib/tutor-cover-rules";
import { addIsoDays } from "@/lib/tutor-checkin-rules";
import { cn } from "@/lib/utils";
import { getWeeklyRules } from "../_lib/availability";
import { LEAVE_STATUS, leaveDetail, leaveRangeLabel } from "../cover/_lib/labels";
import { getTutorTimeAway } from "../cover/_lib/queries";
import {
  LeavePanelProvider,
  LeavePanelTrigger,
  type LeaveTab,
} from "./_components/leave-panel";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
/** The availability bars span the hours the tutor can pick: 6 am to 11 pm. */
const DAY_START = 6 * 60;
const DAY_SPAN = 17 * 60;

const PANEL_TABS: Record<string, LeaveTab> = {
  leave: "class",
  hours: "hours",
  extended: "leave",
};

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function parseMonthParam(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (month >= 1 && month <= 12) return { year, month: month - 1 };
  }
  const [year, month] = melbourneDate().split("-").map(Number);
  return { year, month: month - 1 };
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return monthKey(date.getUTCFullYear(), date.getUTCMonth());
}

function minutesLabel(minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Every date from start to end inclusive (YYYY-MM-DD). */
function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addIsoDays(date, 1)) dates.push(date);
  return dates;
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
  const fromIso = `${monthKey(year, month)}-01`;
  const toIso = `${shiftMonth(year, month, 1)}-01`;
  // The grid shows up to six days either side of the month.
  const gridFrom = addIsoDays(fromIso, -6);
  const gridTo = addIsoDays(toIso, 6);

  const lessonFields = {
    id: lessons.id,
    date: lessons.date,
    startTime: lessons.startTime,
    endTime: lessons.endTime,
    status: lessons.status,
    className: classes.name,
    subjectName: subjects.name,
  };
  const [ownLessons, handedOff, rules, absenceLessons, timeAway] = await Promise.all([
    db
      .select(lessonFields)
      .from(lessons)
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(
          eq(lessons.tutorId, tutor.id),
          gte(lessons.date, gridFrom),
          lt(lessons.date, gridTo),
        ),
      )
      .orderBy(asc(lessons.date), asc(lessons.startTime)),
    // Your classes another tutor now teaches: the claim moved the lesson to
    // them, so they only show here as handed over.
    db
      .select(lessonFields)
      .from(tutorCoverRequests)
      .innerJoin(lessons, eq(lessons.id, tutorCoverRequests.lessonId))
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(
          eq(tutorCoverRequests.originalTutorId, tutor.id),
          eq(tutorCoverRequests.status, "claimed"),
          gte(lessons.date, gridFrom),
          lt(lessons.date, gridTo),
        ),
      ),
    getWeeklyRules(tutor.id),
    getTutorAbsenceLessonOptions(tutor.id),
    getTutorTimeAway(tutor.id),
  ]);

  // Your classes posted for cover (one-off or by leave) still waiting for a tutor.
  const openCoverIds =
    ownLessons.length === 0
      ? new Set<string>()
      : new Set(
          (
            await db
              .select({ lessonId: tutorCoverRequests.lessonId })
              .from(tutorCoverRequests)
              .where(
                and(
                  eq(tutorCoverRequests.status, "open"),
                  inArray(
                    tutorCoverRequests.lessonId,
                    ownLessons.map((lesson) => lesson.id),
                  ),
                ),
              )
          ).map((row) => row.lessonId),
        );

  const chips: MonthChip[] = [
    ...ownLessons.map((lesson): MonthChip => {
      const tone = subjectTone(lesson.subjectName);
      const name = classDisplayName(lesson.subjectName, lesson.className);
      const off = lesson.status === "cancelled" || lesson.status === "rescheduled";
      const coverOpen = openCoverIds.has(lesson.id);
      const note = off
        ? lesson.status === "cancelled"
          ? "Cancelled"
          : "Rescheduled"
        : coverOpen
          ? "Cover requested"
          : null;
      return {
        id: lesson.id,
        date: lesson.date,
        label: formatTime(lesson.startTime),
        sublabel: note ? `${name} · ${note}` : name,
        sortKey: lesson.startTime,
        tone: off ? "line-through" : "",
        dimmed: off,
        href: `/tutor/lessons/${lesson.id}?from=schedule`,
        style: coverOpen
          ? { backgroundColor: "var(--warn-bg)", color: "var(--warn)" }
          : { backgroundColor: tone.bg, color: tone.fg },
        barStyle: { backgroundColor: coverOpen ? "var(--warn)" : tone.dot },
        title: `${name} · ${formatTimeRange(lesson.startTime, lesson.endTime)}${note ? ` · ${note}` : ""}`,
      };
    }),
    ...handedOff.map((lesson): MonthChip => {
      const name = classDisplayName(lesson.subjectName, lesson.className);
      return {
        id: `handed-${lesson.id}`,
        date: lesson.date,
        label: formatTime(lesson.startTime),
        sublabel: name,
        sortKey: lesson.startTime,
        tone: "bg-surface-3 text-muted line-through",
        title: `${name} · handed to cover`,
        ariaLabel: `${name}, ${formatTime(lesson.startTime)}, handed to cover`,
      };
    }),
  ];

  const dayBadges = new Map<string, string>();
  for (const row of timeAway.absences) dayBadges.set(row.date, "Away");
  for (const leave of timeAway.leave) {
    for (const date of datesBetween(
      leave.startDate < gridFrom ? gridFrom : leave.startDate,
      leave.endDate > gridTo ? gridTo : leave.endDate,
    )) {
      dayBadges.set(date, leave.status === "approved" ? "Away" : "Pending");
    }
  }

  const legendSubjects = Array.from(
    new Set(ownLessons.filter((lesson) => lesson.date >= fromIso && lesson.date < toIso).map((lesson) => lesson.subjectName)),
  ).sort();
  const legendHanded = handedOff.some((lesson) => lesson.date >= fromIso && lesson.date < toIso);
  const legendCover = ownLessons.some(
    (lesson) => openCoverIds.has(lesson.id) && lesson.date >= fromIso && lesson.date < toIso,
  );

  const week = weeklyWindowsByDay(rules);
  const regularWindows = week.flatMap((day) =>
    day.windows.map((window) => ({
      key: `${day.weekday}-${window.start}-${window.end}`,
      dayLabel: WEEKDAY_LONG[day.weekday],
      timeLabel: formatTimeRange(minutesLabel(window.start), minutesLabel(window.end)),
      ruleIds: window.ruleIds,
    })),
  );

  const lessonOptions = absenceLessons.map((lesson) => ({
    id: lesson.id,
    weekday: formatWeekday(lesson.date, "short").toUpperCase(),
    day: String(Number(lesson.date.slice(8, 10))),
    month: formatMonthShort(lesson.date).toUpperCase(),
    name: classDisplayName(lesson.subjectName, lesson.className),
    subjectName: lesson.subjectName,
    time: formatTimeRange(lesson.startTime, lesson.endTime),
    dateLabel: formatDateLong(lesson.date),
  }));

  const awayItems = [
    ...timeAway.absences.map((row) => ({
      key: `cover-${row.id}`,
      sort: row.date,
      when: leaveRangeLabel(row.date, row.date),
      status:
        row.status === "claimed"
          ? { label: "Covered", tone: "good" as PillTone }
          : { label: "Needs cover", tone: "warn" as PillTone },
      detail: [
        tutorCoverClassLabel(row.subjectName, row.className),
        row.reason,
        row.status === "claimed"
          ? `${row.replacementTutorFirst} ${row.replacementTutorLast} is teaching`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    ...timeAway.leave.map((row) => ({
      key: `leave-${row.id}`,
      sort: row.startDate,
      when: leaveRangeLabel(row.startDate, row.endDate),
      status: LEAVE_STATUS[row.status],
      detail: `Extended leave · ${leaveDetail(row)}`,
    })),
  ].sort((a, b) => a.sort.localeCompare(b.sort));

  const navLink = buttonVariants({ variant: "glass", size: "icon" });

  return (
    <LeavePanelProvider
      initialTab={panel ? (PANEL_TABS[panel] ?? null) : null}
      lessons={lessonOptions}
      windows={regularWindows}
    >
      <div className="flex flex-col gap-5">
        <header className="glass flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[24px] py-3.5 pl-[22px] pr-[18px]">
          <h1 className="text-[22px] font-extrabold leading-tight text-ink">
            Schedule &amp; availability
          </h1>
          <LeavePanelTrigger tab="class" size="lg" variant="primary">
            Absence or leave
          </LeavePanelTrigger>
        </header>

        <div className="flex flex-wrap items-start gap-5">
          <section
            aria-labelledby="month-heading"
            className="glass flex min-w-0 flex-[999_1_640px] flex-col rounded-[24px] p-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 pl-3 pr-1.5 pt-1.5">
              <h2 id="month-heading" className="text-[20px] font-extrabold text-ink">
                {MONTH_NAMES[month]} <span className="font-medium text-ink-soft">{year}</span>
              </h2>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/tutor/timetable?m=${shiftMonth(year, month, -1)}`}
                  aria-label="Previous month"
                  className={navLink}
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                </Link>
                <Link
                  href="/tutor/timetable"
                  className={buttonVariants({ variant: "glass", size: "md" })}
                >
                  Today
                </Link>
                <Link
                  href={`/tutor/timetable?m=${shiftMonth(year, month, 1)}`}
                  aria-label="Next month"
                  className={navLink}
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                </Link>
              </div>
            </div>
            <MonthGrid year={year} month={month} chips={chips} dayBadges={dayBadges} />
            {(legendSubjects.length > 0 || legendHanded || legendCover) && (
              <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-2.5 pb-1.5 pt-1 text-[12px] font-semibold text-ink-soft">
                {legendSubjects.map((subject) => (
                  <LegendItem key={subject} color={subjectTone(subject).dot} label={subject} />
                ))}
                {legendCover && <LegendItem color="var(--warn)" label="Cover requested" />}
                {legendHanded && <LegendItem color="var(--muted)" label="Handed to cover" />}
              </ul>
            )}
          </section>

          <div className="flex min-w-[min(280px,100%)] max-w-full flex-[1_1_300px] flex-col gap-5 lg:max-w-[360px]">
            <section aria-labelledby="week-heading" className="glass flex flex-col rounded-[24px] p-1.5">
              <div className="flex items-center justify-between gap-3 pb-2 pl-3 pr-1.5 pt-1.5">
                <h2 id="week-heading" className="text-[16px] font-extrabold text-ink">
                  Your regular week
                </h2>
                <LeavePanelTrigger tab="hours" variant="glass">
                  Edit hours
                </LeavePanelTrigger>
              </div>
              <ul className="panel p-1.5">
                {week.map((day) => {
                  const available = day.windows.length > 0;
                  return (
                    <li key={day.weekday} className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px]">
                      <span
                        className={cn(
                          "w-9 shrink-0 text-[13px] font-extrabold",
                          available ? "text-ink" : "text-muted",
                        )}
                      >
                        {WEEKDAY_SHORT[day.weekday]}
                      </span>
                      <span aria-hidden className="relative h-2 flex-1 overflow-hidden rounded-[4px] bg-surface-3">
                        {day.windows.map((window) => (
                          <span
                            key={window.start}
                            className="absolute inset-y-0 rounded-[4px] bg-ink"
                            style={{
                              left: `${Math.max(0, ((window.start - DAY_START) / DAY_SPAN) * 100)}%`,
                              width: `${Math.max(0, ((Math.min(window.end, DAY_START + DAY_SPAN) - Math.max(window.start, DAY_START)) / DAY_SPAN) * 100)}%`,
                            }}
                          />
                        ))}
                      </span>
                      <span
                        className={cn(
                          "w-[112px] shrink-0 text-right text-[12px] font-semibold tabular-nums",
                          available ? "text-ink" : "text-muted",
                        )}
                      >
                        {available
                          ? day.windows
                              .map((window) =>
                                formatTimeRange(minutesLabel(window.start), minutesLabel(window.end)),
                              )
                              .join(", ")
                          : "Not available"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="away-heading" className="glass flex flex-col rounded-[24px] p-1.5">
              <h2 id="away-heading" className="px-3 pb-2.5 pt-2 text-[16px] font-extrabold text-ink">
                Time away
              </h2>
              <div className="panel overflow-hidden">
                {awayItems.length === 0 ? (
                  <Empty className="py-8">No time away booked.</Empty>
                ) : (
                  <ul className="divide-y divide-line">
                    {awayItems.map((item) => (
                      <li key={item.key} className="flex flex-col gap-1.5 px-3.5 py-3">
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 pt-0.5 text-[14px] font-bold text-ink">{item.when}</span>
                          <Pill tone={item.status.tone} className="shrink-0">{item.status.label}</Pill>
                        </span>
                        <span className="text-[12px] text-muted">{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </LeavePanelProvider>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: color }} />
      {label}
    </li>
  );
}
