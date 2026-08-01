import Link from "next/link";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead, SectionHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import { startOfMondayWeek } from "@/lib/format";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
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
  return t ? t.slice(0, 5) : "-";
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

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Your classes"
        title={
          list.length === 0
            ? "No active classes"
            : `${list.length} active class${list.length === 1 ? "" : "es"}`
        }
        sub={
          list.length > 0
            ? `${students.length} student${students.length === 1 ? "" : "s"} · ${weekLessons.length} lesson${weekLessons.length === 1 ? "" : "s"} this week`
            : undefined
        }
      />

      {list.length > 0 && (
        <Card className="overflow-hidden">
          <CardHead
            title="Weekly schedule"
            action={
              <Link href="/tutor/timetable">Open full timetable →</Link>
            }
          />
          <CardBody>
            <MiniWeekCalendar events={events} weekStart={weekStart} />
          </CardBody>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-bold">
              Awaiting assignment
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              An admin needs to assign you to a class before students will
              appear here.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div>
          <SectionHead title="All classes" />
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {list.map((c) => {
              const fam = colorFamilyForSubject(c.subjectName);
              const accent = getAccentTokens(fam);
              const initial = c.subjectName.charAt(0).toUpperCase();
              const capacity = c.capacity ?? 0;
              const enrolled = c.enrolledCount ?? 0;
              const full = capacity > 0 && enrolled >= capacity;
              return (
                <Link
                  key={c.id}
                  href={`/tutor/classes/${c.id}`}
                  className="block group h-full"
                >
                <Card className="overflow-hidden h-full transition-all duration-150 group-hover:-translate-y-[3px] group-hover:shadow-[0_14px_28px_-16px_rgba(31,40,90,0.5)]">
                  <div
                    className="px-4 py-3 flex items-center gap-3 border-b border-line"
                    style={{
                      background: `linear-gradient(135deg, ${accent.bgFrom} 0%, ${accent.bgTo} 100%)`,
                    }}
                  >
                    <div
                      className="h-10 w-10 rounded-[10px] grid place-items-center text-[15px] font-extrabold shrink-0"
                      style={{
                        background: accent.title,
                        color: "#fff",
                      }}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="text-[10px] uppercase tracking-[0.12em] font-bold"
                        style={{ color: accent.meta }}
                      >
                        {c.subjectName}
                        {c.subjectYear ? ` · ${c.subjectYear}` : ""}
                      </div>
                      <div
                        className="text-[14px] font-extrabold leading-tight truncate"
                        style={{ color: accent.title }}
                      >
                        {c.name}
                      </div>
                    </div>
                  </div>
                  <CardBody>
                    <dl className="text-[13px] grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                      <dt className="text-muted">When</dt>
                      <dd className="text-ink text-right">
                        {typeof c.weekday === "number"
                          ? WEEKDAY[c.weekday]
                          : "-"}{" "}
                        <span className="tabular-nums">
                          {trimTime(c.startTime)}–{trimTime(c.endTime)}
                        </span>
                      </dd>
                      <dt className="text-muted">Where</dt>
                      <dd className="text-ink text-right truncate">
                        {c.location ?? (c.onlineLink ? "Online" : "-")}
                      </dd>
                      <dt className="text-muted">Enrolled</dt>
                      <dd className="text-right">
                        <Pill tone={full ? "warn" : "good"}>
                          {enrolled} / {capacity}
                        </Pill>
                      </dd>
                    </dl>
                    <div className="mt-3 pt-3 border-t border-line flex items-center justify-end">
                      <span className="text-[13px] font-bold text-brand-700 group-hover:text-brand-800">
                        Open class →
                      </span>
                    </div>
                  </CardBody>
                </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
