import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { and, eq, gte, inArray, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  lessons,
  profiles,
  quizzes,
  subjects,
  tutorAvailability,
} from "@/db/schema";
import { STUDENT_TIERS } from "@/lib/roles";
import { onRosterSql } from "@/lib/class-roster-sql";
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
import { MonthGrid, type MonthChip } from "@/components/calendar/month-grid";
import { LESSON_OFF_STATUSES } from "@/lib/lesson-progress-sql";
import { formatTime, formatTimeRange } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { distinctSubjects } from "@/lib/subject-label";
import { subjectTone } from "@/lib/subject-tone";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { CreateClassPanel } from "./_components/create-class-panel";
import { SubjectPanel } from "./_components/subject-panel";
import { usualLessonMinutes } from "./_lib/class-time";
import { roomChoices, type RoomUse } from "./_lib/rooms";
import type { TutorClassSlot, TutorWeeklyWindow } from "./_lib/tutor-fit";
import { SubjectBlock } from "../_components/subject-block";
import { classEditHref } from "../_lib/class-links";

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

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { w, view, m, new: openCreate, tutor } = await searchParams;
  const isMonth = view === "month";
  const todayIso = melbourneDate(new Date());

  const [allRows, tutors, subjectList, quizzesToReview, availabilityRows, studentRows] = await Promise.all([
    db
      .select({
        id: classes.id,
        name: classes.name,
        capacity: classes.capacity,
        location: classes.location,
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
    // Students New class can enrol (as the subject page's Add a student).
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        school: profiles.school,
      })
      .from(profiles)
      .where(and(inArray(profiles.role, STUDENT_TIERS), eq(profiles.isActive, true)))
      .orderBy(profiles.firstName, profiles.lastName),
  ]);
  const students = studentRows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    detail: r.school ? `${r.school} · ${r.email}` : r.email,
    short: r.school || r.email,
  }));
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

  // Each subject's number of classes, under its name.
  const classCounts = new Map<string, number>();
  for (const r of allRows) classCounts.set(r.subjectId, (classCounts.get(r.subjectId) ?? 0) + 1);

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

  // Both views draw real lessons, so term dates, holidays, cancellations,
  // make-ups and moved lessons show as they will actually happen. The month
  // grid starts on the Monday on or before the 1st and runs six weeks.
  const firstOfMonth = isoFromParts(year, month, 1);
  const rangeStart = isMonth ? weekStartForIsoDate(firstOfMonth) : weekStart;
  const rangeEnd = addIsoDays(rangeStart, isMonth ? 42 : 7);
  const scheduleLessons = await db
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
      // The class's students on this lesson (who joined by then, not left).
      enrolled: sql<number>`(
        select count(*)::int from enrollments e
        where e.class_id = lessons.class_id and ${onRosterSql("e", "lessons")}
      )`,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(
      and(
        gte(lessons.date, rangeStart),
        lt(lessons.date, rangeEnd),
        notInArray(lessons.status, [...LESSON_OFF_STATUSES]),
        tutorFilter ? eq(lessons.tutorId, tutorFilter) : undefined,
      ),
    )
    .orderBy(lessons.date, lessons.startTime);

  // A lesson opens its roll, as on the dashboard's schedule.
  const events: TimeGridEvent[] = scheduleLessons.map((l) => ({
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
    href: `/admin/attendance/${l.id}`,
  }));
  const monthChips: MonthChip[] = scheduleLessons.map((l) => {
    const tone = subjectTone(l.subjectName, l.subjectColor);
    const tutorName = `${l.tutorFirst} ${l.tutorLast}`.trim();
    return {
      id: l.id,
      date: l.date,
      label: formatTime(l.startTime),
      sublabel: l.subjectName,
      sortKey: l.startTime,
      tone: "rounded-[8px]",
      style: { backgroundColor: tone.bg, color: tone.fg },
      href: `/admin/attendance/${l.id}`,
      title: [classDisplayName(l.subjectName, l.className), formatTimeRange(l.startTime, l.endTime), tutorName, l.room]
        .filter(Boolean)
        .join(" · "),
      ariaLabel: `${classDisplayName(l.subjectName, l.className)}, ${formatTime(l.startTime)}, ${tutorName}`,
    };
  });
  const unscheduled = rows.filter(
    (c) => !c.isRecurring || c.weekday === null || !c.startTime || !c.endTime,
  );

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
  const rooms = roomChoices(allRows.map((r) => r.location));
  const roomSlots: RoomUse[] = allRows
    .filter((r) => r.isRecurring && r.weekday !== null)
    .map((r) => ({ weekday: r.weekday, startTime: r.startTime, endTime: r.endTime, room: r.location }));
  const legend = distinctSubjects(
    scheduleLessons.map((l) => ({
      id: l.subjectId,
      name: l.subjectName,
      yearLevel: l.subjectYearLevel,
      color: l.subjectColor,
    })),
  );

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
              roomSlots={roomSlots}
              lessonMinutes={lessonMinutes}
              students={students}
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
        // Each subject is its own white card on the glass, as in the mock.
        bodyClassName="rounded-none bg-transparent p-1 shadow-none"
      >
        {subjectList.length === 0 ? (
          <div className="panel">
            <Empty>No subjects yet.</Empty>
          </div>
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
                  detail={`${classCounts.get(s.id) ?? 0} ${classCounts.get(s.id) === 1 ? "class" : "classes"}`}
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
              roomSlots={roomSlots}
              lessonMinutes={lessonMinutes}
              students={students}
              triggerSize="lg"
            />
          </Empty>
        ) : (
          <>
            {isMonth ? (
              <div className="p-3">
                <MonthGrid year={year} month={month} chips={monthChips} />
              </div>
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
                        href={classEditHref(c.subjectId, c.id)}
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
