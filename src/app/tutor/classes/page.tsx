import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import { StatTile } from "@/components/data/stat-tile";
import { startOfMondayWeek } from "@/lib/format";
import {
  getTutorClasses,
  getTutorStudents,
  getTutorWeekLessons,
  requireTutor,
} from "../_data";

const WEEKDAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function trimTime(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

function classHours(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

export default async function TutorClassesPage() {
  const tutor = await requireTutor();

  const now = new Date();
  const weekStart = startOfMondayWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [list, weekLessons, students] = await Promise.all([
    getTutorClasses(tutor.id),
    getTutorWeekLessons(tutor.id, weekStart, weekEnd),
    getTutorStudents(tutor.id),
  ]);

  const events: CalendarEvent[] = weekLessons.map((l) => ({
    date: l.date,
    time: l.startTime.slice(0, 5),
    endTime: l.endTime.slice(0, 5),
    label: l.className,
    meta: l.subjectName,
    kind: "lesson",
    href: `/tutor/lessons/${l.id}`,
  }));

  const totalHours = list.reduce(
    (acc, c) => acc + classHours(c.startTime, c.endTime),
    0,
  );

  return (
    <div className="space-y-6">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Your classes
        </div>
        <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
          {list.length === 0
            ? "No active classes"
            : `${list.length} active class${list.length === 1 ? "" : "es"}`}
        </h1>
      </header>

      {/* Stat strip */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Classes"
          value={list.length.toString()}
          accent="brand"
        />
        <StatTile
          label="Students"
          value={students.length.toString()}
          accent="brand"
          href="/tutor/students"
        />
        <StatTile
          label="Lessons this week"
          value={weekLessons.length.toString()}
          accent="brand"
        />
        <StatTile
          label="Teaching hours / wk"
          value={`${Math.round(totalHours * 10) / 10}h`}
          accent="brand"
        />
      </section>

      {/* Visual calendar */}
      {list.length > 0 && (
        <Card
          className="p-0 overflow-hidden rise"
          style={{ animationDelay: "80ms" }}
        >
          <div className="px-6 py-5 border-b border-hairline/60 flex items-baseline justify-between">
            <div className="text-xl font-medium text-ink">Weekly schedule</div>
            <span className="text-sm uppercase tracking-[0.18em] text-muted">
              {events.length} lesson{events.length === 1 ? "" : "s"} this week
            </span>
          </div>
          <div className="p-5 bg-gradient-to-b from-brand-50/40 to-transparent">
            <MiniWeekCalendar events={events} weekStart={weekStart} />
          </div>
        </Card>
      )}

      {/* Class detail cards */}
      {list.length === 0 ? (
        <Card>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
            Awaiting assignment
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            An admin needs to assign you to a class before students will appear
            here.
          </p>
        </Card>
      ) : (
        <section className="space-y-3 rise" style={{ animationDelay: "120ms" }}>
          <div className="px-1 flex items-baseline justify-between">
            <h2 className="text-xl font-medium text-ink">All classes</h2>
            <span className="text-sm text-muted">
              {list.length} total
            </span>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map((c) => (
              <Card key={c.id} className="space-y-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium">
                    {c.subjectName}
                    {c.subjectYear ? ` · ${c.subjectYear}` : ""}
                  </div>
                  <h3 className="mt-2 text-xl font-medium tracking-tight text-ink">
                    {c.name}
                  </h3>
                </div>
                <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="text-muted">When</dt>
                  <dd className="text-ink text-right">
                    {typeof c.weekday === "number" ? WEEKDAY[c.weekday] : "—"}{" "}
                    <span className="tabular-nums">
                      {trimTime(c.startTime)}–{trimTime(c.endTime)}
                    </span>
                  </dd>
                  <dt className="text-muted">Where</dt>
                  <dd className="text-ink text-right">
                    {c.location ?? (c.onlineLink ? "Online" : "—")}
                  </dd>
                  <dt className="text-muted">Enrolled</dt>
                  <dd className="text-ink text-right tabular-nums">
                    {c.enrolledCount} / {c.capacity}
                  </dd>
                </dl>
                <div className="flex gap-4 pt-3 border-t border-hairline/60 text-[11px] uppercase tracking-[0.16em]">
                  <Link
                    href="/tutor/students"
                    className="text-brand-700 hover:underline"
                  >
                    Students →
                  </Link>
                  <Link
                    href="/tutor/homework"
                    className="text-brand-700 hover:underline"
                  >
                    Homework →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
