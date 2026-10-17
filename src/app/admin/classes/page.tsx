import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { and, eq, gte, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  lessons,
  profiles,
  quizzes,
  subjects,
  subjectWeeks,
  tutorAvailability,
} from "@/db/schema";
import { resolveCurrentTerm } from "@/lib/curriculum";
import {
  Empty,
  GlassPanel,
  PageHeader,
  SegmentedLinks,
  SubjectDot,
  buttonVariants,
} from "@/components/admin/ui";
import { UrlLabelledSelect } from "@/components/admin/ui/labelled-select";
import { WeekTimeGrid, type TimeGridEvent } from "@/components/data/week-time-grid";
import { formatTime, formatTimeRange } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { distinctSubjects } from "@/lib/subject-label";
import { subjectTone } from "@/lib/subject-tone";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";
import { CreateClassPanel } from "./_components/create-class-panel";
import { SubjectPanel } from "./_components/subject-panel";
import { usualLessonMinutes } from "./_lib/class-time";
import { roomsInUse } from "./_lib/rooms";
import type { TutorClassSlot, TutorWeeklyWindow } from "./_lib/tutor-fit";
import { SubjectBlock } from "../_components/subject-block";

export const dynamic = "force-dynamic";

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
const GLASS_ICON = buttonVariants({ variant: "glass", size: "icon" });

/** Calendar arithmetic on ISO dates (UTC-safe, no server timezone). */
function isoFromParts(y: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(y, monthIndex, day)).toISOString().slice(0, 10);
}

function weekRange(weekStart: string) {
  const end = addIsoDays(weekStart, 6);
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", opts);
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  return `${fmt(weekStart, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

type SearchParams = Promise<{
  w?: string;
  view?: string;
  m?: string;
  new?: string;
  tutor?: string;
}>;

function weekLabel(weeks: number) {
  if (weeks === 0) return "No weeks this term";
  return `${weeks} week${weeks === 1 ? "" : "s"} this term`;
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { w, view, m, new: openCreate, tutor } = await searchParams;
  const isMonth = view === "month";
  const todayIso = melbourneDate(new Date());

  const [allRows, tutors, subjectList, currentTerm, quizzesToReview, availabilityRows] = await Promise.all([
    db
      .select({
        id: classes.id,
        name: classes.name,
        capacity: classes.capacity,
        location: classes.location,
        onlineLink: classes.onlineLink,
        weekday: classes.weekday,
        startTime: classes.startTime,
        endTime: classes.endTime,
        isRecurring: classes.isRecurring,
        tutorId: classes.tutorId,
        subjectId: subjects.id,
        subject: subjects.name,
        subjectYearLevel: subjects.yearLevel,
        subjectColor: subjects.color,
        tutorFirst: profiles.firstName,
        tutorLast: profiles.lastName,
        enrolled: sql<number>`(
          select count(*)::int from ${enrollments}
          where ${enrollments.classId} = ${classes.id}
            and ${enrollments.withdrawnAt} is null
        )`,
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .innerJoin(profiles, eq(profiles.id, classes.tutorId))
      .orderBy(classes.name),
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(eq(profiles.role, "tutor"))
      .orderBy(profiles.firstName),
    db
      .select({
        id: subjects.id,
        name: subjects.name,
        yearLevel: subjects.yearLevel,
        color: subjects.color,
      })
      .from(subjects)
      .orderBy(subjects.name),
    resolveCurrentTerm(),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(quizzes)
      .where(eq(quizzes.status, "pending_review"))
      .then(([row]) => row?.n ?? 0),
    // Weekly availability for the New class tutor picker (date-specific rows
    // are one-off changes and do not decide a weekly class).
    db
      .selectDistinct({
        tutorId: tutorAvailability.tutorId,
        weekday: tutorAvailability.weekday,
        startTime: tutorAvailability.startTime,
        endTime: tutorAvailability.endTime,
        subjectId: tutorAvailability.subjectId,
      })
      .from(tutorAvailability)
      .where(
        and(
          isNotNull(tutorAvailability.weekday),
          isNull(tutorAvailability.date),
          eq(tutorAvailability.isAvailable, true),
        ),
      ),
  ]);
  const tutorWindows: TutorWeeklyWindow[] = availabilityRows.map((r) => ({
    tutorId: r.tutorId,
    weekday: r.weekday!,
    startTime: r.startTime,
    endTime: r.endTime,
    subjectId: r.subjectId,
  }));
  const classSlots: TutorClassSlot[] = allRows.map((r) => ({
    tutorId: r.tutorId,
    name: classDisplayName(r.subject, r.name),
    weekday: r.weekday,
    startTime: r.startTime,
    endTime: r.endTime,
  }));

  // Weeks planned this term, per subject: one grouped count, only in term.
  const weekCounts = new Map<string, number>();
  if (currentTerm) {
    const weekRows = await db
      .select({ subjectId: subjectWeeks.subjectId, n: sql<number>`count(*)::int` })
      .from(subjectWeeks)
      .where(eq(subjectWeeks.termId, currentTerm.id))
      .groupBy(subjectWeeks.subjectId);
    for (const row of weekRows) weekCounts.set(row.subjectId, row.n);
  }

  const tutorFilter = tutor && tutors.some((t) => t.id === tutor) ? tutor : null;
  const rows = tutorFilter
    ? allRows.filter((r) => r.tutorId === tutorFilter)
    : allRows;

  // Week: real lessons, so cancellations, make-ups, and moved lessons show as
  // they will actually happen.
  let weekStart = weekStartForIsoDate(todayIso);
  if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) {
    try {
      weekStart = weekStartForIsoDate(w);
    } catch {
      /* invalid date: stay on this week */
    }
  }
  const weekLessons = isMonth
    ? []
    : await db
        .select({
          id: lessons.id,
          classId: lessons.classId,
          date: lessons.date,
          startTime: lessons.startTime,
          endTime: lessons.endTime,
          className: classes.name,
          subjectId: subjects.id,
          subjectName: subjects.name,
          subjectYearLevel: subjects.yearLevel,
          subjectColor: subjects.color,
          capacity: classes.capacity,
          room: sql<string | null>`coalesce(nullif(trim(${lessons.location}), ''), nullif(trim(${classes.location}), ''))`,
          tutorFirst: profiles.firstName,
          tutorLast: profiles.lastName,
          enrolled: sql<number>`(
            select count(*)::int from ${enrollments}
            where ${enrollments.classId} = ${lessons.classId}
              and ${enrollments.withdrawnAt} is null
          )`,
        })
        .from(lessons)
        .innerJoin(classes, eq(classes.id, lessons.classId))
        .innerJoin(subjects, eq(subjects.id, classes.subjectId))
        .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
        .where(
          and(
            gte(lessons.date, weekStart),
            lt(lessons.date, addIsoDays(weekStart, 7)),
            ne(lessons.status, "cancelled"),
            tutorFilter ? eq(lessons.tutorId, tutorFilter) : undefined,
          ),
        );

  const events: TimeGridEvent[] = weekLessons.map((l) => ({
    id: l.id,
    date: l.date,
    startTime: l.startTime,
    endTime: l.endTime,
    label: l.subjectName,
    title: classDisplayName(l.subjectName, l.className),
    subject: l.subjectName,
    subjectColor: l.subjectColor,
    meta: [`${l.tutorFirst} ${l.tutorLast}`.trim(), l.room].filter(Boolean).join(" · "),
    badge: `${l.enrolled}/${l.capacity}`,
    href: `/admin/classes/${l.classId}`,
  }));
  const unscheduled = rows.filter(
    (c) => !c.isRecurring || c.weekday === null || !c.startTime || !c.endTime,
  );

  // Month navigation keys. The default month is Melbourne's, not the
  // server's (UTC) - early on the 1st they differ.
  let year = Number(todayIso.slice(0, 4));
  let month = Number(todayIso.slice(5, 7)) - 1;
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mm] = m.split("-").map(Number);
    if (mm >= 1 && mm <= 12) {
      year = y;
      month = mm - 1;
    }
  }
  const mKey = (y: number, monthIndex: number) =>
    isoFromParts(y, monthIndex, 1).slice(0, 7);

  const href = (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    if (tutorFilter) qs.set("tutor", tutorFilter);
    for (const [key, value] of Object.entries(params)) {
      if (value) qs.set(key, value);
    }
    const str = qs.toString();
    return str ? `/admin/classes?${str}` : "/admin/classes";
  };
  const prevHref = isMonth
    ? href({ view: "month", m: mKey(year, month - 1) })
    : href({ w: addIsoDays(weekStart, -7) });
  const nextHref = isMonth
    ? href({ view: "month", m: mKey(year, month + 1) })
    : href({ w: addIsoDays(weekStart, 7) });
  const todayHref = isMonth ? href({ view: "month" }) : href({});
  const periodLabel = isMonth
    ? `${MONTH_NAMES[month]} ${year}`
    : weekRange(weekStart);

  const lessonMinutes = usualLessonMinutes(allRows);
  const rooms = roomsInUse(allRows.map((r) => r.location));
  const shownSubjects = isMonth
    ? rows
        .filter((r) => r.isRecurring && r.weekday !== null)
        .map((r) => ({
          id: r.subjectId,
          name: r.subject,
          yearLevel: r.subjectYearLevel,
          color: r.subjectColor,
        }))
    : weekLessons.map((l) => ({
        id: l.subjectId,
        name: l.subjectName,
        yearLevel: l.subjectYearLevel,
        color: l.subjectColor,
      }));
  const legend = distinctSubjects(shownSubjects);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Classes"
        actions={
          <>
            <Link
              href="/admin/terms"
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              Terms
            </Link>
            <Link
              href="/admin/quizzes"
              aria-label={
                quizzesToReview > 0
                  ? `Quizzes, ${quizzesToReview} waiting for review`
                  : undefined
              }
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              Quizzes
              {quizzesToReview > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-extrabold tabular-nums text-white">
                  {quizzesToReview}
                </span>
              )}
            </Link>
            <CreateClassPanel
              tutors={tutors}
              tutorWindows={tutorWindows}
              classSlots={classSlots}
              subjects={subjectList}
              rooms={rooms}
              lessonMinutes={lessonMinutes}
              triggerSize="lg"
              defaultOpen={openCreate === "1"}
            />
          </>
        }
      />

      <GlassPanel
        title="Subjects"
        titleId="subjects-heading"
        meta={subjectList.length}
        action={<SubjectPanel />}
        bodyClassName="p-2"
      >
        {subjectList.length === 0 ? (
          <Empty>No subjects yet.</Empty>
        ) : (
          <ul
            className="grid gap-2"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
            }}
          >
            {subjectList.map((s) => (
              <li key={s.id} className="min-w-0">
                <SubjectBlock
                  id={s.id}
                  name={s.name}
                  color={s.color}
                  yearLevel={s.yearLevel}
                  detail={
                    currentTerm
                      ? weekLabel(weekCounts.get(s.id) ?? 0)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      <GlassPanel
        title={isMonth ? "Monthly schedule" : "Weekly schedule"}
        titleId="schedule-heading"
        meta={
          <span className="inline-flex items-center gap-1">
            <Link
              href={prevHref}
              aria-label={isMonth ? "Previous month" : "Previous week"}
              className={GLASS_ICON}
            >
              <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
            </Link>
            <Link
              href={todayHref}
              className={buttonVariants({ variant: "glass", size: "md" })}
            >
              Today
            </Link>
            <Link
              href={nextHref}
              aria-label={isMonth ? "Next month" : "Next week"}
              className={GLASS_ICON}
            >
              <ChevronRight className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
            </Link>
            <span className="ml-2 text-[14px] font-bold tabular-nums text-ink">
              {periodLabel}
            </span>
          </span>
        }
        action={
          <>
            <UrlLabelledSelect
              label="Tutor"
              param="tutor"
              options={[
                { value: "", label: "All" },
                ...tutors.map((t) => ({
                  value: t.id,
                  label: `${t.firstName} ${t.lastName}`.trim(),
                })),
              ]}
            />
            <SegmentedLinks
              label="Schedule view"
              items={[
                { label: "Week", href: href({}), active: !isMonth },
                { label: "Month", href: href({ view: "month" }), active: isMonth },
              ]}
            />
          </>
        }
      >
        {allRows.length === 0 ? (
          <Empty className="flex flex-col items-center gap-4">
            No classes yet.
            <CreateClassPanel
              tutors={tutors}
              tutorWindows={tutorWindows}
              classSlots={classSlots}
              subjects={subjectList}
              rooms={rooms}
              lessonMinutes={lessonMinutes}
              triggerSize="lg"
            />
          </Empty>
        ) : (
          <>
            {isMonth ? (
              <MonthView rows={rows} year={year} month={month} todayIso={todayIso} />
            ) : (
              <WeekTimeGrid
                events={events}
                weekStart={weekStart}
                todayIso={todayIso}
                detailed
              />
            )}
            {legend.length > 0 && (
              <ul
                aria-label="Subject colours"
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-[18px] py-3 text-[12px] font-semibold text-muted"
              >
                {legend.map((l) => (
                  <li key={l.id} className="inline-flex items-center gap-1.5">
                    <SubjectDot subject={l.name} color={l.color} className="h-2.5 w-2.5" />
                    {l.label}
                  </li>
                ))}
              </ul>
            )}
            {!isMonth && unscheduled.length > 0 && (
              <section
                aria-labelledby="unscheduled-heading"
                className="border-t border-line p-4"
              >
                <h3
                  id="unscheduled-heading"
                  className="mb-2.5 text-[13px] font-extrabold text-muted"
                >
                  Without a recurring slot
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {unscheduled.map((c) => (
                    <li key={c.id} className="min-w-0">
                      <Link
                        href={`/admin/classes/${c.id}`}
                        className="flex min-h-11 items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                      >
                        <SubjectDot subject={c.subject} color={c.subjectColor} className="h-2.5 w-2.5" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold text-ink">
                            {c.name}
                          </span>
                          <span className="block truncate text-[12px] text-muted">
                            {c.subject} · {c.tutorFirst} {c.tutorLast}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </GlassPanel>
    </div>
  );
}

type ClassRow = {
  id: string;
  name: string;
  capacity: number;
  location: string | null;
  onlineLink: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  isRecurring: boolean;
  tutorId: string;
  subject: string;
  subjectColor: string | null;
  tutorFirst: string;
  tutorLast: string;
  enrolled: number;
};

function MonthView({
  rows,
  year,
  month,
  todayIso,
}: {
  rows: ClassRow[];
  year: number;
  /** 0-based */
  month: number;
  /** Melbourne date */
  todayIso: string;
}) {
  // JS weekday of the 1st (0 = Sun), on a UTC date so the server zone
  // never shifts it.
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const mondayOffset = (firstDow + 6) % 7;

  // Index classes by weekday (0=Sun..6=Sat)
  const classesByWeekday = new Map<number, ClassRow[]>();
  for (const c of rows) {
    if (!c.isRecurring || c.weekday === null) continue;
    if (!classesByWeekday.has(c.weekday)) classesByWeekday.set(c.weekday, []);
    classesByWeekday.get(c.weekday)!.push(c);
  }
  for (const list of classesByWeekday.values()) {
    list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  }

  const days: Array<{
    iso: string;
    dayNum: number;
    weekday: number;
    inMonth: boolean;
    isToday: boolean;
  }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year, month, 1 - mondayOffset + i));
    const iso = d.toISOString().slice(0, 10);
    days.push({
      iso,
      dayNum: d.getUTCDate(),
      weekday: d.getUTCDay(),
      inMonth: d.getUTCMonth() === month,
      isToday: iso === todayIso,
    });
  }
  let usedRows = 6;
  while (
    usedRows > 4 &&
    days.slice((usedRows - 1) * 7, usedRows * 7).every((d) => !d.inMonth)
  )
    usedRows--;
  const visibleDays = days.slice(0, usedRows * 7);

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="min-w-[760px] p-3">
        <div className="mb-1 grid grid-cols-7 gap-1.5">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[12px] font-extrabold tracking-[0.04em] text-muted"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {visibleDays.map((d) => {
            const dayClasses = classesByWeekday.get(d.weekday) ?? [];
            return (
              <div
                key={d.iso}
                className={cn(
                  "flex min-h-[132px] flex-col gap-1.5 rounded-[12px] border p-2",
                  d.isToday
                    ? "border-brand-300 bg-brand-50"
                    : d.inMonth
                      ? "border-line bg-surface"
                      : "border-line/60 bg-surface-2/60",
                )}
              >
                <div className="px-0.5">
                  {d.isToday ? (
                    <span
                      aria-current="date"
                      className="inline-grid h-[26px] min-w-[26px] place-items-center rounded-full bg-ink px-1 text-[13px] font-extrabold tabular-nums text-white"
                    >
                      {d.dayNum}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "inline-grid h-[26px] items-center text-[14px] font-extrabold tabular-nums",
                        d.inMonth ? "text-ink" : "text-muted-2",
                      )}
                    >
                      {d.dayNum}
                    </span>
                  )}
                </div>
                <div className="space-y-1 overflow-hidden">
                  {dayClasses.slice(0, 3).map((c) => {
                    const tone = subjectTone(c.subject, c.subjectColor);
                    return (
                      <Link
                        key={c.id}
                        href={`/admin/classes/${c.id}`}
                        className="block rounded-[8px] px-1.5 py-1 text-[11px] leading-tight transition-[filter] hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                        style={{ backgroundColor: tone.bg, color: tone.fg }}
                        title={`${classDisplayName(c.subject, c.name)} · ${c.tutorFirst} ${c.tutorLast}${
                          c.startTime && c.endTime
                            ? ` · ${formatTimeRange(c.startTime, c.endTime)}`
                            : ""
                        }`}
                      >
                        <div className="truncate font-extrabold">{c.subject}</div>
                        {c.startTime && (
                          <div className="font-semibold tabular-nums">
                            {formatTime(c.startTime)}
                          </div>
                        )}
                        <div className="truncate opacity-90">
                          {c.tutorFirst} {c.tutorLast}
                        </div>
                      </Link>
                    );
                  })}
                  {dayClasses.length > 3 && (
                    <div className="px-1 text-[11px] font-semibold text-muted">
                      +{dayClasses.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
