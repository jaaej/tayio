import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { ProgressBar } from "@/components/data/progress-bar";
import { SubjectCard } from "@/components/data/subject-card";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import { requireRole } from "@/lib/auth";
import { StatusBadge } from "./_components/badge";
import {
  formatDueDate,
  formatTime,
  formatWeekday,
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "./_lib/format";
import {
  getDueHomeworkCount,
  getNextLesson,
  getStudentHomework,
  getStudentLessons,
  getStudentSubjects,
} from "./_lib/queries";

const ACCENT_PALETTE = [
  "var(--periwinkle-500)",
  "#6b82c8",
  "#7fa0d8",
  "#a8b8e8",
  "#5e7bc7",
  "#8a9dd9",
];
function colorForSubject(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

function startOfMondayWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dayToMon = [6, 0, 1, 2, 3, 4, 5];
  x.setDate(x.getDate() - dayToMon[x.getDay()]);
  return x;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function StudentDashboard() {
  const user = await requireRole("student");

  const now = new Date();
  const weekStart = startOfMondayWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [subjects, nextLesson, dueCount, allHomework, weekLessons] =
    await Promise.all([
      getStudentSubjects(user.id),
      getNextLesson(user.id),
      getDueHomeworkCount(user.id),
      getStudentHomework(user.id),
      getStudentLessons(user.id, { from: weekStart }),
    ]);

  const upcomingDue = allHomework
    .filter(
      (h) =>
        h.status === "not_started" ||
        h.status === "viewed" ||
        h.status === "resubmission_requested",
    )
    .slice(0, 6);

  const overallMastery =
    subjects.length > 0
      ? Math.round(
          subjects.reduce((acc, s) => acc + s.masteryPercent, 0) / subjects.length,
        )
      : 0;

  const events: CalendarEvent[] = [];
  for (const l of weekLessons) {
    const d = new Date(`${l.date}T00:00:00`);
    if (d < weekStart || d >= weekEnd) continue;
    events.push({
      date: l.date,
      time: l.startTime.slice(0, 5),
      label: l.subjectName,
      meta: `${l.tutorFirstName} ${l.tutorLastName}`,
      kind: "lesson",
    });
  }
  for (const h of allHomework) {
    const due = new Date(h.dueDate);
    if (due < weekStart || due >= weekEnd) continue;
    if (h.status === "marked" || h.status === "submitted") continue;
    events.push({
      date: isoDate(due),
      time: null,
      label: h.title,
      meta: h.className ?? undefined,
      kind: "homework",
      href: `/student/homework/${h.homeworkId}`,
    });
  }

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            {dateLabel}
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-medium tracking-tight text-ink">
            Dashboard
          </h1>
        </div>
        <Link
          href="/student/subjects"
          className="text-xs text-brand-700 hover:underline hidden sm:inline"
        >
          View all subjects →
        </Link>
      </header>

      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile label="Subjects" value={subjects.length.toString()} sub="enrolled" />
        <StatTile
          label="Due"
          value={dueCount.toString()}
          sub="open homework"
          tone={dueCount > 0 ? "warn" : "default"}
        />
        <StatTile
          label="Next class"
          value={
            nextLesson
              ? `${formatWeekday(nextLesson.date, "short")} ${formatTime(nextLesson.startTime)}`
              : "—"
          }
          sub={nextLesson?.subjectName ?? "Nothing scheduled"}
        />
        <StatTile
          label="Mastery"
          value={`${overallMastery}%`}
          sub="across topics"
        />
      </section>

      <div className="grid lg:grid-cols-12 gap-4 lg:gap-5">
        <div
          className="lg:col-span-8 space-y-4 rise"
          style={{ animationDelay: "80ms" }}
        >
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline/60 flex items-baseline justify-between">
              <div className="text-base font-medium text-ink">My subjects</div>
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
                {subjects.length} enrolled
              </span>
            </div>
            <div className="p-4">
              {subjects.length === 0 ? (
                <div className="text-sm text-ink-soft py-4 px-2">
                  You're not enrolled in any classes yet.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {subjects.map((s) => (
                    <SubjectCard
                      key={s.classId}
                      href={`/student/subjects/${s.classId}`}
                      subject={s.subjectName}
                      meta={`${s.tutorFirstName} ${s.tutorLastName}`}
                      accent={colorForSubject(s.subjectName)}
                      badge={
                        s.dueHomeworkCount > 0
                          ? { label: `${s.dueHomeworkCount} due`, tone: "warn" }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline/60 flex items-baseline justify-between">
              <div className="text-base font-medium text-ink">Upcoming due</div>
              <Link
                href="/student/homework"
                className="text-xs text-brand-700 hover:underline"
              >
                All homework
              </Link>
            </div>
            {upcomingDue.length === 0 ? (
              <div className="px-5 py-6 text-sm text-ink-soft">
                You're caught up — nothing to submit.
              </div>
            ) : (
              <div className="divide-y divide-hairline/60">
                {upcomingDue.map((h) => (
                  <Link
                    key={h.homeworkId}
                    href={`/student/homework/${h.homeworkId}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{h.title}</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {h.className ?? "—"} · {formatDueDate(h.dueDate)}
                      </div>
                    </div>
                    <StatusBadge
                      label={HOMEWORK_STATUS_LABEL[h.status] ?? h.status}
                      className={HOMEWORK_STATUS_STYLE[h.status]}
                    />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div
          className="lg:col-span-4 space-y-4 rise"
          style={{ animationDelay: "120ms" }}
        >
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline/60 flex items-baseline justify-between">
              <div className="text-base font-medium text-ink">This week</div>
              <Link
                href="/student/timetable"
                className="text-xs text-brand-700 hover:underline"
              >
                Full timetable
              </Link>
            </div>
            <div className="p-4">
              <MiniWeekCalendar events={events} weekStart={weekStart} />
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline/60 flex items-baseline justify-between">
              <div className="text-base font-medium text-ink">Topic mastery</div>
              <Link
                href="/student/progress"
                className="text-xs text-brand-700 hover:underline"
              >
                Open
              </Link>
            </div>
            <div className="p-5">
              <CardLabel>Overall</CardLabel>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-3xl font-light text-ink tabular-nums">
                  {overallMastery}%
                </div>
                {subjects.length > 0 && (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5">
                    {subjects.length} subj
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {subjects.slice(0, 4).map((s) => (
                  <ProgressBar
                    key={s.subjectId}
                    label={s.subjectName}
                    percent={s.masteryPercent}
                    color={
                      s.masteryPercent >= 85
                        ? "bg-emerald-500"
                        : s.masteryPercent >= 60
                          ? "bg-brand-600"
                          : s.masteryPercent >= 30
                            ? "bg-amber-500"
                            : "bg-hairline"
                    }
                  />
                ))}
                {subjects.length === 0 && (
                  <div className="text-xs text-muted">No data yet.</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={
        "rounded-xl border bg-card px-4 py-2.5 " +
        (tone === "warn" ? "border-amber-200/70" : "border-hairline/50")
      }
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-medium text-ink tabular-nums truncate">
        {value}
      </div>
      <div className="text-[11px] text-muted truncate">{sub}</div>
    </div>
  );
}
