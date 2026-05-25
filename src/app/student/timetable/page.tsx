import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/data/stat-tile";
import { requireRole } from "@/lib/auth";
import {
  MonthCalendar,
  monthBounds,
  parseMonthParam,
  type MonthHomework,
  type MonthLesson,
} from "../_components/month-calendar";
import { getStudentHomework, getStudentLessons } from "../_lib/queries";

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

type SearchParams = Promise<{ month?: string }>;

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("student");
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);
  const { fromIso, toIso } = monthBounds(year, month);

  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);

  const [lessonRows, homeworkRows] = await Promise.all([
    getStudentLessons(user.id, { from, to }),
    getStudentHomework(user.id),
  ]);

  const lessons: MonthLesson[] = lessonRows.map((l) => ({
    id: l.id,
    date: l.date,
    startTime: l.startTime,
    endTime: l.endTime,
    status: l.status,
    subjectName: l.subjectName,
    className: l.className,
  }));

  // Filter homework to this month by due date
  const homework: MonthHomework[] = homeworkRows
    .filter((h) => {
      const due = isoLocal(h.dueDate);
      return due >= fromIso && due < toIso;
    })
    .map((h) => ({
      id: h.homeworkId,
      dueDate: isoLocal(h.dueDate),
      title: h.title,
      status: h.status,
      className: h.className,
    }));

  const today = new Date();
  const todayIso = isoLocal(today);
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  // Stats for the visible month
  const upcomingLessons = lessons.filter(
    (l) => l.date >= todayIso && l.status === "upcoming",
  ).length;
  const dueHomework = homework.filter(
    (h) =>
      h.status === "not_started" ||
      h.status === "viewed" ||
      h.status === "resubmission_requested",
  ).length;

  const dateLabel = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      {/* Title strip */}
      <header className="flex items-baseline justify-between rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
            {dateLabel}
          </div>
          <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
            Timetable
          </h1>
        </div>
        {!isCurrentMonth && (
          <div className="hidden md:flex items-center gap-3 text-sm">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Viewing
            </span>
            <span className="text-ink font-medium">
              {MONTH_NAMES[month]} {year}
            </span>
          </div>
        )}
      </header>

      {/* Stat strip */}
      <section
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" } as React.CSSProperties}
      >
        <StatTile
          label="Lessons this month"
          value={lessons.length.toString()}
          accent="brand"
        />
        <StatTile
          label="Upcoming"
          value={upcomingLessons.toString()}
          accent="brand"
        />
        <StatTile
          label="Homework due"
          value={dueHomework.toString()}
          accent={dueHomework > 0 ? "warn" : "success"}
          href="/student/homework"
        />
      </section>

      {/* Month calendar */}
      <Card
        className="p-0 overflow-hidden rise"
        style={{ animationDelay: "80ms" } as React.CSSProperties}
      >
        <div className="p-5 lg:p-6 bg-gradient-to-b from-brand-50/30 to-transparent">
          <MonthCalendar
            year={year}
            month={month}
            lessons={lessons}
            homework={homework}
            basePath="/student/timetable"
          />
        </div>
      </Card>
    </div>
  );
}

function isoLocal(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
