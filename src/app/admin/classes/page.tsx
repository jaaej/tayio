import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, profiles, subjects } from "@/db/schema";
import { Card, CardHead, CardBody, Pill, PageHeader, Empty } from "@/components/admin/ui";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateClassPanel } from "./_components/create-class-panel";
import { CreateSubjectPanel } from "./_components/create-subject-panel";

export const dynamic = "force-dynamic";

const WEEKDAYS_SCHEDULE = [
  { idx: 1, short: "Mon" },
  { idx: 2, short: "Tue" },
  { idx: 3, short: "Wed" },
  { idx: 4, short: "Thu" },
  { idx: 5, short: "Fri" },
  { idx: 6, short: "Sat" },
  { idx: 0, short: "Sun" },
];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
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
function hh(n: number): string {
  return `${String(n).padStart(2, "0")}:00`;
}
function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfWeekMon(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // 0=Sun..6=Sat
  const offset = (dow + 6) % 7; // days since last Monday
  x.setDate(x.getDate() - offset);
  return x;
}
function shortDate(d: Date) {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

type SearchParams = Promise<{ w?: string; view?: string; m?: string }>;

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { w, view, m } = await searchParams;
  const isMonth = view === "month";
  const rows = await db
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
    .orderBy(classes.name);

  const tutors = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(eq(profiles.role, "tutor"))
    .orderBy(profiles.firstName);

  const subjectList = await db
    .select({ id: subjects.id, name: subjects.name, yearLevel: subjects.yearLevel })
    .from(subjects)
    .orderBy(subjects.name);

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Operations"
        title="Class Management"
        actions={<CreateClassPanel tutors={tutors} subjects={subjectList} />}
      />

      {/* Subjects lead: they are the shortest surface on the page and a class
          cannot exist without one, so they sit above the tall schedule grid. */}
      <section className="rise" style={{ animationDelay: "40ms" }}>
        <Card>
          <CardHead title="Subjects" action={<CreateSubjectPanel />} />
          {subjectList.length === 0 ? (
            <Empty>No subjects yet.</Empty>
          ) : (
            <CardBody>
              {/* Tiles rather than full-width rows: a subject is a short label,
                  and a wrapped grid uses the page width instead of stretching
                  one name across it. */}
              <div
                className="grid gap-3"
                style={{
                  // `min(240px, 100%)` keeps a single tile from overflowing the
                  // card on the narrowest phones, where the body is under 240px.
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(240px, 100%), 1fr))",
                }}
              >
                {subjectList.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/subjects/${s.id}/curriculum`}
                    className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-brand-400 hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <span className="text-[14px] font-bold text-ink truncate">
                      {s.name}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      {s.yearLevel ? (
                        <Pill tone="sky">Yr {s.yearLevel}</Pill>
                      ) : (
                        <span aria-hidden />
                      )}
                      <span className="text-[12px] font-bold text-brand-600 shrink-0">
                        Curriculum →
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </CardBody>
          )}
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardHead
            title={isMonth ? "Monthly Schedule" : "Weekly Schedule"}
            action={
              <Link
                href={isMonth ? "/admin/classes" : `/admin/classes?view=month`}
                className="text-[12px] font-bold text-brand-600 hover:underline"
              >
                {isMonth ? "← Back to weekly" : "Open monthly →"}
              </Link>
            }
          />
          {rows.length === 0 ? (
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
            <WeekView rows={rows} weekParam={w} />
          )}
        </Card>
      </section>
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
  subject: string;
  tutorFirst: string;
  tutorLast: string;
  enrolled: number;
};

function WeekView({
  rows,
  weekParam,
}: {
  rows: ClassRow[];
  weekParam: string | undefined;
}) {
  const weekStart =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? startOfWeekMon(new Date(`${weekParam}T00:00:00`))
      : startOfWeekMon(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(weekStart.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(weekStart.getDate() + 7);

  return (
    <div className="space-y-3">
      {/* The period label is the grid's heading, so on narrow widths it takes
          its own line rather than squeezing the controls either side of it. */}
      <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-y-2">
        <div className="order-2 sm:order-none flex items-center gap-1.5">
          <Link
            href={`/admin/classes?w=${isoLocal(prevWeek)}`}
            aria-label="Previous week"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface text-lg text-ink-soft hover:border-brand-400 hover:bg-surface-2 hover:text-ink transition-colors"
          >
            ‹
          </Link>
          <Link
            href={`/admin/classes?w=${isoLocal(nextWeek)}`}
            aria-label="Next week"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface text-lg text-ink-soft hover:border-brand-400 hover:bg-surface-2 hover:text-ink transition-colors"
          >
            ›
          </Link>
        </div>
        <h4 className="order-1 sm:order-none w-full sm:w-auto text-center text-[20px] lg:text-[22px] font-extrabold tracking-[-0.01em] text-ink tabular-nums">
          {shortDate(weekStart)} - {shortDate(weekEnd)}
        </h4>
        <Link
          href="/admin/classes"
          className="order-3 sm:order-none text-[11px] uppercase tracking-[0.16em] font-bold text-brand-600 hover:underline"
        >
          This week
        </Link>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px] p-5">
          <ScheduleGrid rows={rows} />
        </div>
      </div>
    </div>
  );
}

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

  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const mKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {/* Same nav shape as the weekly view - see the note there. */}
      <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-y-2">
        <div className="order-2 sm:order-none flex items-center gap-1.5">
          <Link
            href={`/admin/classes?view=month&m=${mKey(prevMonth)}`}
            aria-label="Previous month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-soft hover:border-brand-400 hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
          </Link>
          <Link
            href={`/admin/classes?view=month&m=${mKey(nextMonth)}`}
            aria-label="Next month"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-soft hover:border-brand-400 hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
          </Link>
        </div>
        <h4 className="order-1 sm:order-none w-full sm:w-auto text-center text-[20px] lg:text-[22px] font-extrabold tracking-[-0.01em] text-ink tabular-nums">
          {MONTH_NAMES[month]} {year}
        </h4>
        <Link
          href="/admin/classes?view=month"
          className="order-3 sm:order-none text-[11px] uppercase tracking-[0.16em] font-bold text-brand-600 hover:underline"
        >
          This month
        </Link>
      </div>
      <div className="p-5">
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
                    ? "bg-surface border-brand-400 ring-1 ring-brand-300/40"
                    : d.inMonth
                      ? d.isWeekend
                        ? "bg-brand-50/30 border-line"
                        : "bg-surface border-line"
                      : "bg-surface-2/50 border-line/60",
                )}
              >
                <div className="px-0.5">
                  {d.isToday ? (
                    <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-brand-500 text-white text-[12px] font-extrabold tabular-nums leading-none">
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
                  {dayClasses.slice(0, 3).map((c) => (
                    <Link
                      key={c.id}
                      href={`/admin/classes/${c.id}`}
                      className="block rounded-lg px-1.5 py-1 text-[10px] leading-tight bg-brand-50 hover:bg-brand-100 transition-colors"
                      title={`${c.name} · ${c.subject} · ${c.tutorFirst} ${c.tutorLast} · ${c.startTime ?? ""}-${c.endTime ?? ""}`}
                    >
                      <div className="font-bold text-ink truncate">
                        {c.subject}
                      </div>
                      <div className="text-ink-soft truncate">
                        {c.tutorFirst} {c.tutorLast}
                      </div>
                      <div className="text-ink-soft tabular-nums">
                        {c.startTime
                          ? formatTime(c.startTime)
                          : ""}
                      </div>
                    </Link>
                  ))}
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

function ScheduleGrid({ rows }: { rows: ClassRow[] }) {
  // Index classes by `${weekday}-${hour}` using their start hour.
  type Cell = {
    id: string;
    name: string;
    subject: string;
    tutor: string;
    startTime: string;
    endTime: string;
    spanHours: number;
    enrolled: number;
    capacity: number;
  };
  const cellByKey = new Map<string, Cell[]>();
  const occupiedKeys = new Set<string>();
  for (const c of rows) {
    if (!c.isRecurring || c.weekday === null || !c.startTime || !c.endTime)
      continue;
    const startH = parseInt(c.startTime.slice(0, 2), 10);
    const endH = parseInt(c.endTime.slice(0, 2), 10);
    const span = Math.max(1, endH - startH);
    const startKey = `${c.weekday}-${startH}`;
    if (!cellByKey.has(startKey)) cellByKey.set(startKey, []);
    cellByKey.get(startKey)!.push({
      id: c.id,
      name: c.name,
      subject: c.subject,
      tutor: `${c.tutorFirst} ${c.tutorLast}`,
      startTime: c.startTime,
      endTime: c.endTime,
      spanHours: span,
      enrolled: c.enrolled,
      capacity: c.capacity,
    });
    for (let h = startH + 1; h < endH; h++) {
      occupiedKeys.add(`${c.weekday}-${h}`);
    }
  }

  // One-off / un-scheduled classes shown separately below the grid.
  const unscheduled = rows.filter(
    (c) => !c.isRecurring || c.weekday === null || !c.startTime || !c.endTime,
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-1.5">
        <div />
        {WEEKDAYS_SCHEDULE.map((d) => (
          <div
            key={d.idx}
            className="text-center py-2 text-[11px] uppercase tracking-[0.16em] font-bold text-muted"
          >
            {d.short}
          </div>
        ))}

        {HOURS.map((h) => (
          <ScheduleHourRow
            key={h}
            hour={h}
            cellByKey={cellByKey}
            occupiedKeys={occupiedKeys}
          />
        ))}
      </div>

      {unscheduled.length > 0 && (
        <div className="border-t border-line pt-4">
          <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted mb-2">
            Without a recurring slot
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unscheduled.map((c) => (
              <Link
                key={c.id}
                href={`/admin/classes/${c.id}`}
                className="rounded-[14px] border border-line bg-surface p-3 hover:border-brand-400 hover:bg-surface-2 transition-colors"
              >
                <div className="text-[14px] font-bold text-ink truncate">
                  {c.name}
                </div>
                <div className="text-xs text-ink-soft truncate">
                  {c.subject} · {c.tutorFirst} {c.tutorLast}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleHourRow({
  hour,
  cellByKey,
  occupiedKeys,
}: {
  hour: number;
  cellByKey: Map<
    string,
    Array<{
      id: string;
      name: string;
      subject: string;
      tutor: string;
      startTime: string;
      endTime: string;
      spanHours: number;
      enrolled: number;
      capacity: number;
    }>
  >;
  occupiedKeys: Set<string>;
}) {
  return (
    <>
      <div className="text-[11px] tabular-nums text-muted text-right pr-2 pt-2">
        {formatTime(hh(hour))}
      </div>
      {WEEKDAYS_SCHEDULE.map((d) => {
        const key = `${d.idx}-${hour}`;
        const cells = cellByKey.get(key) ?? [];
        const isOccupied = occupiedKeys.has(key);
        if (cells.length === 0 && isOccupied) {
          // Spanned by a class starting in a previous hour - render nothing.
          return <div key={key} className="h-16" />;
        }
        if (cells.length === 0) {
          return (
            <div
              key={key}
              className="h-16 rounded-lg border border-line/60 bg-surface-2/40"
            />
          );
        }
        return (
          <div key={key} className="space-y-1">
            {cells.map((c) => (
              <Link
                key={c.id}
                href={`/admin/classes/${c.id}`}
                className={cn(
                  "block rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5 hover:bg-brand-100 hover:border-brand-400 transition-colors overflow-hidden",
                  c.spanHours > 1 && "min-h-[4rem]",
                )}
                style={
                  c.spanHours > 1
                    ? { height: `${c.spanHours * 4 + (c.spanHours - 1) * 0.375}rem` }
                    : { height: "4rem" }
                }
                title={`${c.name} · ${c.subject} · ${c.tutor} · ${formatTime(c.startTime)}-${formatTime(c.endTime)}`}
              >
                <div className="text-[11px] font-bold text-ink truncate">
                  {c.subject}
                </div>
                <div className="text-[10px] text-ink-soft truncate">
                  {c.tutor}
                </div>
                <div className="text-[10px] tabular-nums text-ink-soft mt-0.5">
                  {formatTime(c.startTime)}–{formatTime(c.endTime)} ·{" "}
                  {c.enrolled}/{c.capacity}
                </div>
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}
