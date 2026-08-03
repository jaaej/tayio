import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { SubjectCard } from "@/components/student/subject-card";
import {
  Card,
  CardHead,
  CardBody,
} from "@/components/student/card";
import { Badge } from "@/components/student/pill";
import { SubjectPill } from "@/components/student/subject-pill";
import { PageHead, SectionHead } from "@/components/student/page-head";
import {
  MonthCalendar,
  WeekCalendar,
  monthBounds,
  parseMonthParam,
  parseWeekParam,
  weekBounds,
  type MonthHomework,
} from "../_components/month-calendar";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
import {
  getStudentHomework,
  getStudentProgressBySubject,
  getStudentSubjects,
} from "../_lib/queries";

export default async function StudentSubjectsIndex({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; week?: string }>;
}) {
  const user = await requireRole("student");
  const [subjects, progress, allHomework, params] = await Promise.all([
    getStudentSubjects(user.id),
    getStudentProgressBySubject(user.id),
    getStudentHomework(user.id),
    searchParams,
  ]);

  // Due-date calendar, timetable-styled. Defaults to a single week
  // (?week=YYYY-MM-DD to navigate); ?month=YYYY-MM enlarges to the full
  // month. Open + submitted items land on their due dates; overdue and
  // marked items live in the sidebar.
  const isMonthView = Boolean(params.month);
  const { year, month } = parseMonthParam(params.month);
  const weekStart = parseWeekParam(params.week);
  const { fromIso, toIso } = isMonthView
    ? monthBounds(year, month)
    : weekBounds(weekStart);
  // "Full month" toggle target: the month owning most of the viewed week
  // (its Thursday, per ISO convention) - not the Monday, which can sit in
  // the previous month.
  const weekMid = new Date(weekStart);
  weekMid.setDate(weekStart.getDate() + 3);
  const monthKey = isMonthView
    ? params.month!
    : `${weekMid.getFullYear()}-${String(weekMid.getMonth() + 1).padStart(2, "0")}`;

  const openStatuses = new Set([
    "not_started",
    "viewed",
    "resubmission_requested",
    "late",
  ]);
  const open = allHomework.filter((h) => openStatuses.has(h.status));
  const submitted = allHomework.filter((h) => h.status === "submitted");
  const calendarHomework: MonthHomework[] = [...open, ...submitted]
    .map((h) => ({
      id: h.homeworkId,
      dueDate: isoLocal(h.dueDate),
      title: h.title,
      status: h.status,
      className: h.className,
    }))
    .filter((h) => h.dueDate >= fromIso && h.dueDate < toIso);

  // De-duped tutors
  const tutorRows = (() => {
    const seen = new Map<string, { name: string; subjects: string[] }>();
    for (const s of subjects) {
      const name = `${s.tutorFirstName} ${s.tutorLastName}`.trim();
      const key = name || "Unassigned";
      const row = seen.get(key) ?? { name: key, subjects: [] };
      if (!row.subjects.includes(s.subjectName)) row.subjects.push(s.subjectName);
      seen.set(key, row);
    }
    return Array.from(seen.values());
  })();

  if (subjects.length === 0) {
    return (
      <div className="space-y-5">
        <PageHead
          eyebrow="My subjects"
          title="Your subjects"
          sub="Tap a subject to see class materials, lessons, homework, and progress."
        />
        <Card>
          <CardBody>
            <div className="text-[13px] text-muted">
              You're not enrolled in any classes yet.
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="My subjects"
        title="Your subjects"
        sub={`${subjects.length} subject${subjects.length === 1 ? "" : "s"} · ${open.length} homework open`}
      />

      {/* Main grid */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-5 items-start">
        {/* LEFT */}
        <div className="space-y-5 min-w-0">
          {/* Subject grid */}
          <div>
            <SectionHead
              title="All subjects"
              actionHref="/student/progress"
              actionLabel="View progress →"
            />
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {subjects.map((s) => (
                <SubjectCard
                  key={s.classId}
                  href={`/student/subjects/${s.subjectId}`}
                  name={s.subjectName}
                  mastery={s.masteryPercent}
                  nextLabel={
                    s.tutorFirstName
                      ? `${s.tutorFirstName} ${s.tutorLastName ?? ""}`.trim()
                      : undefined
                  }
                />
              ))}
            </div>
          </div>

          {/* Homework - at-a-glance due-date calendar; the full list lives on /student/homework */}
          <div>
            <SectionHead
              title="Homework due dates"
              actionHref="/student/homework"
              actionLabel="All homework →"
            />
            {allHomework.length === 0 ? (
              <Card>
                <CardBody>
                  <div className="text-sm text-muted text-center py-2">
                    No homework assigned yet.
                  </div>
                </CardBody>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <CardHead
                  title="Due dates"
                  action={
                    <div
                      role="group"
                      aria-label="Calendar view"
                      className="inline-flex rounded-lg border border-line overflow-hidden"
                    >
                      <Link
                        href="/student/subjects"
                        aria-current={!isMonthView ? "page" : undefined}
                        className={
                          !isMonthView
                            ? "px-3 py-1.5 text-[11px] font-bold bg-brand-500 text-white"
                            : "px-3 py-1.5 text-[11px] font-bold text-ink-soft hover:bg-surface-2 transition-colors"
                        }
                      >
                        Week
                      </Link>
                      <Link
                        href={`/student/subjects?month=${monthKey}`}
                        aria-current={isMonthView ? "page" : undefined}
                        className={
                          isMonthView
                            ? "px-3 py-1.5 text-[11px] font-bold bg-brand-500 text-white"
                            : "px-3 py-1.5 text-[11px] font-bold text-ink-soft hover:bg-surface-2 transition-colors"
                        }
                      >
                        Full month
                      </Link>
                    </div>
                  }
                />
                <div className="p-4 lg:p-5">
                  {isMonthView ? (
                    <MonthCalendar
                      year={year}
                      month={month}
                      lessons={[]}
                      homework={calendarHomework}
                      basePath="/student/subjects"
                      subjectColorHomework
                    />
                  ) : (
                    <WeekCalendar
                      weekStart={weekStart}
                      lessons={[]}
                      homework={calendarHomework}
                      basePath="/student/subjects"
                      subjectColorHomework
                    />
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-5 min-w-0">
          {/* Your tutors */}
          <Card>
            <CardHead title="Your tutors" />
            <CardBody tight>
              <ul className="divide-y divide-line">
                {tutorRows.map((t) => {
                  const initials = t.name
                    .split(/\s+/)
                    .map((p) => p.charAt(0))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <li
                      key={t.name}
                      className="px-4 py-3 flex items-center gap-3"
                    >
                      <div className="h-9 w-9 rounded-full bg-brand-500 text-white grid place-items-center text-[12px] font-bold shrink-0">
                        {initials || "T"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-ink truncate">
                          {t.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {t.subjects.map((s) => (
                            <SubjectPill key={s} subject={s} />
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
