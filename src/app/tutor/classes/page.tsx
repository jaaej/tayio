import Link from "next/link";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead, SectionHead } from "@/components/student/page-head";
import { StatChip } from "@/components/student/stat-chip";
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatChip
          icon="📚"
          hue="brand"
          value={list.length}
          label="Classes"
        />
        <StatChip
          icon="🧑‍🎓"
          hue="sky"
          value={students.length}
          label="Students"
        />
        <StatChip
          icon="🗓️"
          hue="grape"
          value={weekLessons.length}
          label="Lessons this week"
        />
        <StatChip
          icon="⏱️"
          hue="sun"
          value={`${Math.round(totalHours * 10) / 10}h`}
          label="Teaching hours / wk"
        />
      </div>

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
                <Card key={c.id} className="overflow-hidden">
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
                          : "—"}{" "}
                        <span className="tabular-nums">
                          {trimTime(c.startTime)}–{trimTime(c.endTime)}
                        </span>
                      </dd>
                      <dt className="text-muted">Where</dt>
                      <dd className="text-ink text-right truncate">
                        {c.location ?? (c.onlineLink ? "Online" : "—")}
                      </dd>
                      <dt className="text-muted">Enrolled</dt>
                      <dd className="text-right">
                        <Pill tone={full ? "warn" : "good"}>
                          {enrolled} / {capacity}
                        </Pill>
                      </dd>
                    </dl>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
                      <Link
                        href={`/tutor/classes/${c.id}/students`}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-line px-2.5 py-1 text-[11px] font-bold text-ink-soft hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors"
                      >
                        Students →
                      </Link>
                      <Link
                        href={`/tutor/classes/${c.id}/homework`}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-line px-2.5 py-1 text-[11px] font-bold text-ink-soft hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors"
                      >
                        Homework →
                      </Link>
                      <Link
                        href={`/tutor/classes/${c.id}/curriculum`}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-600 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-brand-700 transition-colors"
                      >
                        Curriculum →
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
