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
  getRecentFeedback,
  getRecentGrades,
  getRelevantAnnouncements,
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

function relativeTime(d: Date) {
  const diffHours = Math.round((Date.now() - d.getTime()) / 36e5);
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const days = Math.round(diffHours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default async function StudentDashboard() {
  const user = await requireRole("student");

  const now = new Date();
  const weekStart = startOfMondayWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [
    subjects,
    nextLesson,
    dueCount,
    allHomework,
    weekLessons,
    feedback,
    grades,
    notices,
  ] = await Promise.all([
    getStudentSubjects(user.id),
    getNextLesson(user.id),
    getDueHomeworkCount(user.id),
    getStudentHomework(user.id),
    getStudentLessons(user.id, { from: weekStart }),
    getRecentFeedback(user.id, 3),
    getRecentGrades(user.id, 5),
    getRelevantAnnouncements(user.id, 4),
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
      {/* Title strip */}
      <header className="flex items-baseline justify-between rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            {dateLabel}
          </div>
          <h1 className="mt-1 text-3xl lg:text-4xl font-medium tracking-tight text-ink">
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

      {/* Stat strip */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise"
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

      {/* Hero: This week calendar — full width */}
      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "80ms" }}>
        <div className="px-6 py-4 border-b border-hairline/60 flex items-baseline justify-between">
          <div>
            <div className="text-base font-medium text-ink">This week</div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted mt-0.5">
              {events.length === 0
                ? "Nothing scheduled"
                : `${events.length} event${events.length === 1 ? "" : "s"} · lessons & homework`}
            </div>
          </div>
          <Link
            href="/student/timetable"
            className="text-xs text-brand-700 hover:underline"
          >
            Full timetable →
          </Link>
        </div>
        <div className="p-6">
          <MiniWeekCalendar events={events} weekStart={weekStart} />
        </div>
      </Card>

      {/* Row 1: My subjects (7) + Topic mastery (5) */}
      <div
        className="grid lg:grid-cols-12 gap-5 rise"
        style={{ animationDelay: "120ms" }}
      >
        <Card className="lg:col-span-7 p-0 overflow-hidden">
          <SectionHeader title="My subjects" right={`${subjects.length} enrolled`} />
          <div className="p-5">
            {subjects.length === 0 ? (
              <Empty>You're not enrolled in any classes yet.</Empty>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
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

        <Card className="lg:col-span-5 p-0 overflow-hidden">
          <SectionHeader
            title="Topic mastery"
            link={{ href: "/student/progress", label: "Open" }}
          />
          <div className="p-6">
            <CardLabel>Overall</CardLabel>
            <div className="mt-1 flex items-baseline gap-3">
              <div className="text-5xl font-light text-ink tabular-nums">
                {overallMastery}%
              </div>
              {subjects.length > 0 && (
                <span className="text-[10px] uppercase tracking-[0.14em] text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                  {subjects.length} subjects
                </span>
              )}
            </div>
            <div className="mt-6 space-y-4">
              {subjects.slice(0, 6).map((s) => (
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

      {/* Row 2: Upcoming due (7) + Latest feedback (5) */}
      <div
        className="grid lg:grid-cols-12 gap-5 rise"
        style={{ animationDelay: "160ms" }}
      >
        <Card className="lg:col-span-7 p-0 overflow-hidden">
          <SectionHeader
            title="Upcoming due"
            link={{ href: "/student/homework", label: "All homework" }}
          />
          {upcomingDue.length === 0 ? (
            <Empty>You're caught up — nothing to submit.</Empty>
          ) : (
            <div className="divide-y divide-hairline/60">
              {upcomingDue.map((h) => (
                <Link
                  key={h.homeworkId}
                  href={`/student/homework/${h.homeworkId}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">{h.title}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {h.className ?? "—"} · due {formatDueDate(h.dueDate)}
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

        <Card className="lg:col-span-5 p-0 overflow-hidden">
          <SectionHeader
            title="Latest feedback"
            link={{ href: "/student/lessons", label: "All lessons" }}
          />
          {feedback.length === 0 ? (
            <Empty>
              No feedback yet — your tutor's notes appear here after each lesson.
            </Empty>
          ) : (
            <div className="divide-y divide-hairline/60">
              {feedback.map((f) => (
                <Link
                  key={f.lessonId}
                  href={`/student/lessons/${f.lessonId}`}
                  className="block px-6 py-4 hover:bg-brand-50 transition-colors"
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    {f.subjectName} · {f.tutorFirstName} {f.tutorLastName.charAt(0)}.
                  </div>
                  <p className="mt-2 text-sm text-ink leading-relaxed line-clamp-3">
                    "{f.comment}"
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Recent grades (7) + Announcements (5) */}
      <div
        className="grid lg:grid-cols-12 gap-5 rise"
        style={{ animationDelay: "200ms" }}
      >
        <Card className="lg:col-span-7 p-0 overflow-hidden">
          <SectionHeader title="Recent grades" />
          {grades.length === 0 ? (
            <Empty>No marked homework yet.</Empty>
          ) : (
            <div className="divide-y divide-hairline/60">
              {grades.map((g) => (
                <Link
                  key={g.homeworkId}
                  href={`/student/homework/${g.homeworkId}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">{g.title}</div>
                    <div className="text-xs text-muted mt-0.5 truncate">
                      {g.className ?? "—"} · {relativeTime(g.markedAt)}
                      {g.feedback ? ` · "${g.feedback.slice(0, 40)}${g.feedback.length > 40 ? "…" : ""}"` : ""}
                    </div>
                  </div>
                  <ScoreBadge score={g.score} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-5 p-0 overflow-hidden">
          <SectionHeader title="Announcements" />
          {notices.length === 0 ? (
            <Empty>No announcements right now.</Empty>
          ) : (
            <div className="divide-y divide-hairline/60">
              {notices.map((n) => (
                <div key={n.id} className="px-6 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm text-ink font-medium truncate">
                      {n.title}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted shrink-0">
                      {relativeTime(new Date(n.publishedAt))}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft leading-relaxed line-clamp-2">
                    {n.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  right,
  link,
}: {
  title: string;
  right?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="px-6 py-4 border-b border-hairline/60 flex items-baseline justify-between">
      <div className="text-base font-medium text-ink">{title}</div>
      {link ? (
        <Link href={link.href} className="text-xs text-brand-700 hover:underline">
          {link.label}
        </Link>
      ) : right ? (
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
          {right}
        </span>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-8 text-sm text-ink-soft">{children}</div>;
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
        "rounded-xl border bg-card px-5 py-4 " +
        (tone === "warn" ? "border-amber-200/70" : "border-hairline/50")
      }
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-medium text-ink tabular-nums truncate">
        {value}
      </div>
      <div className="text-xs text-muted truncate">{sub}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: string }) {
  const num = Number(score);
  const tone =
    num >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : num >= 60
        ? "bg-brand-50 text-brand-700 border-brand-200"
        : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium tabular-nums border ${tone}`}
    >
      {Number.isFinite(num) ? `${num}` : score}
    </span>
  );
}
