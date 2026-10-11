import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, lessons, profiles, subjects } from "@/db/schema";
import { Empty } from "@/components/admin/ui";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { UrlLabelledSelect } from "@/components/admin/ui/labelled-select";
import { WeekTimeGrid, type TimeGridEvent } from "@/components/data/week-time-grid";
import { formatTime } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";
import { CreateClassPanel } from "./_components/create-class-panel";
import { CreateSubjectPanel } from "./_components/create-subject-panel";
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
function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const BUTTON =
  "inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink shadow-[0_1px_2px_rgba(15,17,30,0.05)] transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

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

  const [allRows, tutors, subjectList] = await Promise.all([
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
        subject: subjects.name,
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
      .select({ id: subjects.id, name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .orderBy(subjects.name),
  ]);

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
          subjectName: subjects.name,
          capacity: classes.capacity,
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
    meta: `${l.tutorFirst} ${l.tutorLast}`.trim(),
    badge: `${l.enrolled}/${l.capacity}`,
    href: `/admin/classes/${l.classId}`,
  }));
  const unscheduled = rows.filter(
    (c) => !c.isRecurring || c.weekday === null || !c.startTime || !c.endTime,
  );

  // Month navigation keys.
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mm] = m.split("-").map(Number);
    year = y;
    month = mm - 1;
  }
  const mKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

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
    ? href({ view: "month", m: mKey(new Date(year, month - 1, 1)) })
    : href({ w: addIsoDays(weekStart, -7) });
  const nextHref = isMonth
    ? href({ view: "month", m: mKey(new Date(year, month + 1, 1)) })
    : href({ w: addIsoDays(weekStart, 7) });
  const todayHref = isMonth ? href({ view: "month" }) : href({});
  const periodLabel = isMonth
    ? `${MONTH_NAMES[month]} ${year}`
    : weekRange(weekStart);

  return (
    <div className="space-y-5">
      <header className="glass-frame rise flex flex-wrap items-center gap-3 rounded-[22px] px-5 py-4">
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">
          Classes
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/admin/terms" className={BUTTON}>
            Manage terms
          </Link>
          <CreateClassPanel
            tutors={tutors}
            subjects={subjectList}
            defaultOpen={openCreate === "1"}
          />
        </div>
      </header>

      <GlassPanel
        className="rise"
        title={
          <span className="inline-flex items-center gap-2">
            Subjects
            <span className="text-[12px] font-bold tabular-nums text-muted">
              {subjectList.length}
            </span>
          </span>
        }
        action={<CreateSubjectPanel />}
        bodyClassName="bg-transparent border-0 shadow-none"
      >
        {subjectList.length === 0 ? (
          <div className="rounded-[16px] bg-surface">
            <Empty>No subjects yet.</Empty>
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(230px, 100%), 1fr))",
            }}
          >
            {subjectList.map((s) => (
              <SubjectBlock
                key={s.id}
                id={s.id}
                name={s.name}
                yearLevel={s.yearLevel}
              />
            ))}
          </div>
        )}
      </GlassPanel>

      <GlassPanel
        className="rise"
        title={isMonth ? "Monthly schedule" : "Weekly schedule"}
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Link href={prevHref} aria-label={isMonth ? "Previous month" : "Previous week"} className={cn(BUTTON, "min-h-9 w-9 justify-center px-0")}>
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
            </Link>
            <Link href={todayHref} className={cn(BUTTON, "min-h-9 px-3 text-[12px]")}>
              Today
            </Link>
            <Link href={nextHref} aria-label={isMonth ? "Next month" : "Next week"} className={cn(BUTTON, "min-h-9 w-9 justify-center px-0")}>
              <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
            </Link>
            <span className="ml-1.5 text-[14px] font-extrabold tabular-nums text-ink">
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
            <div
              role="group"
              aria-label="Schedule view"
              className="inline-flex h-10 items-center rounded-[10px] border border-line-strong bg-surface p-1"
            >
              {[
                { key: "week", label: "Week", to: href({}) },
                { key: "month", label: "Month", to: href({ view: "month" }) },
              ].map((option) => {
                const active = (option.key === "month") === isMonth;
                return (
                  <Link
                    key={option.key}
                    href={option.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 items-center rounded-[8px] px-3 text-[12px] font-bold transition-colors",
                      active ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </>
        }
      >
        {allRows.length === 0 ? (
          <Empty className="flex flex-col items-center gap-4">
            No classes yet.
            <CreateClassPanel
              tutors={tutors}
              subjects={subjectList}
              triggerSize="lg"
            />
          </Empty>
        ) : isMonth ? (
          <MonthView rows={rows} monthParam={m} />
        ) : (
          <>
            <WeekTimeGrid
              events={events}
              weekStart={weekStart}
              todayIso={todayIso}
              detailed
            />
            {unscheduled.length > 0 && (
              <div className="border-t border-line p-4">
                <div className="mb-2 text-[12px] font-bold text-muted">
                  Without a recurring slot
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {unscheduled.map((c) => (
                    <Link
                      key={c.id}
                      href={`/admin/classes/${c.id}`}
                      className="rounded-[12px] border border-line bg-surface p-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="truncate text-[13px] font-bold text-ink">
                        {c.name}
                      </div>
                      <div className="truncate text-[12px] text-ink-soft">
                        {c.subject} · {c.tutorFirst} {c.tutorLast}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
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
  tutorFirst: string;
  tutorLast: string;
  enrolled: number;
};

function MonthView({
  rows,
  monthParam,
}: {
  rows: ClassRow[];
  monthParam: string | undefined;
}) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, mm] = monthParam.split("-").map(Number);
    year = y;
    month = mm - 1;
  }
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay();
  const mondayOffset = (firstDow + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const todayIso = isoLocal(new Date());

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
    isWeekend: boolean;
  }> = [];
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
    <div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-muted mb-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-center py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {visibleDays.map((d) => {
            const dayClasses = classesByWeekday.get(d.weekday) ?? [];
            return (
              <div
                key={d.iso}
                className={cn(
                  "rounded-xl border min-h-[140px] p-2 flex flex-col gap-1.5",
                  d.isToday
                    ? "bg-brand-50/70 border-brand-300"
                    : d.inMonth
                      ? d.isWeekend
                        ? "bg-brand-50/30 border-line"
                        : "bg-surface border-line"
                      : "bg-surface-2/50 border-line/60",
                )}
              >
                <div className="px-0.5">
                  {d.isToday ? (
                    <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-ink text-white text-[12px] font-extrabold tabular-nums leading-none">
                      {d.dayNum}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "text-[15px] tabular-nums font-bold leading-none",
                        d.inMonth ? "text-ink" : "text-muted-2",
                      )}
                    >
                      {d.dayNum}
                    </span>
                  )}
                </div>
                <div className="space-y-1 overflow-hidden">
                  {dayClasses.slice(0, 3).map((c) => {
                    const tokens = getAccentTokens(colorFamilyForSubject(c.subject));
                    return (
                    <Link
                      key={c.id}
                      href={`/admin/classes/${c.id}`}
                      className="block rounded-lg px-1.5 py-1 text-[10px] leading-tight transition-shadow hover:shadow-[0_6px_16px_-10px_rgba(31,40,90,0.5)]"
                      style={{ backgroundColor: tokens.pillBg, color: tokens.pillText }}
                      title={`${classDisplayName(c.subject, c.name)} · ${c.tutorFirst} ${c.tutorLast} · ${c.startTime ?? ""}-${c.endTime ?? ""}`}
                    >
                      <div className="font-bold truncate">
                        {c.subject}
                      </div>
                      <div className="truncate opacity-80">
                        {c.tutorFirst} {c.tutorLast}
                      </div>
                      <div className="tabular-nums opacity-80">
                        {c.startTime
                          ? formatTime(c.startTime)
                          : ""}
                      </div>
                    </Link>
                    );
                  })}
                  {dayClasses.length > 3 && (
                    <div className="text-[10px] text-muted px-1">
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
