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

function timeUntil(date: string, time: string) {
  const target = new Date(`${date}T${time}`);
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export default async function StudentDashboard() {
  const user = await requireRole("student");

  const now = new Date();
  const weekStart = startOfMondayWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [subjects, nextLesson, dueCount, allHomework, weekLessons, grades, notices] =
    await Promise.all([
      getStudentSubjects(user.id),
      getNextLesson(user.id),
      getDueHomeworkCount(user.id),
      getStudentHomework(user.id),
      getStudentLessons(user.id, { from: weekStart }),
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
      endTime: l.endTime.slice(0, 5),
      label: l.subjectName,
      meta: `${l.tutorFirstName} ${l.tutorLastName.charAt(0)}.`,
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
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
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

      {/* Next-up hero — splash of color, breaks up the page */}
      {nextLesson ? (
        <Link
          href={`/student/subjects/`}
          className="block rise"
          style={{ animationDelay: "30ms" }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-navy-800/15 bg-gradient-to-br from-navy-800 via-[#2e3a6b] to-brand-700 text-white px-6 py-5 lg:px-8 lg:py-6 shadow-[0_18px_44px_-20px_rgba(29,41,81,0.5)]">
            {/* Decorative orb */}
            <div
              aria-hidden
              className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden
              className="absolute right-10 bottom-0 h-24 w-24 rounded-full bg-brand-300/30 blur-xl"
            />

            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">
                  Next up · {timeUntil(nextLesson.date, nextLesson.startTime)}
                </div>
                <div className="mt-2 text-2xl lg:text-3xl font-medium tracking-tight">
                  {nextLesson.subjectName}
                </div>
                <div className="mt-1 text-sm text-white/80">
                  {formatWeekday(nextLesson.date)} ·{" "}
                  {formatTime(nextLesson.startTime)} – {formatTime(nextLesson.endTime)} ·
                  with {nextLesson.tutorFirstName} {nextLesson.tutorLastName}
                </div>
              </div>
              {(nextLesson.onlineLink || nextLesson.location) && (
                <div className="flex items-center gap-3">
                  {nextLesson.onlineLink ? (
                    <a
                      href={nextLesson.onlineLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-navy-800 text-sm font-medium hover:bg-brand-50 transition-colors"
                    >
                      Join online →
                    </a>
                  ) : (
                    <div className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-sm">
                      {nextLesson.location}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Link>
      ) : null}

      {/* Stat strip */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise"
        style={{ animationDelay: "60ms" }}
      >
        <StatTile
          label="Subjects"
          value={subjects.length.toString()}
          sub="enrolled"
          accent="brand"
        />
        <StatTile
          label="Due"
          value={dueCount.toString()}
          sub="open homework"
          accent={dueCount > 0 ? "warn" : "muted"}
        />
        <StatTile
          label="Lessons this week"
          value={events.filter((e) => e.kind === "lesson").length.toString()}
          sub="scheduled"
          accent="brand"
        />
        <StatTile
          label="Overall mastery"
          value={`${overallMastery}%`}
          sub="across topics"
          accent={
            overallMastery >= 75 ? "success" : overallMastery >= 50 ? "brand" : "warn"
          }
        />
      </section>

      {/* Hero: This Week Calendar */}
      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "100ms" }}>
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
        <div className="p-5 lg:p-6 bg-gradient-to-b from-brand-50/30 to-transparent">
          <MiniWeekCalendar events={events} weekStart={weekStart} />
        </div>
      </Card>

      {/* Row 1: My subjects (7) + Announcements (5) */}
      <div
        className="grid lg:grid-cols-12 gap-5 rise"
        style={{ animationDelay: "140ms" }}
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
          <SectionHeader title="Announcements" />
          {notices.length === 0 ? (
            <Empty>No announcements right now.</Empty>
          ) : (
            <div className="divide-y divide-hairline/60">
              {notices.map((n) => (
                <div key={n.id} className="px-6 py-4 hover:bg-brand-50/40 transition-colors">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0" />
                      <div className="text-sm text-ink font-medium truncate">
                        {n.title}
                      </div>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted shrink-0">
                      {relativeTime(new Date(n.publishedAt))}
                    </div>
                  </div>
                  <p className="mt-1.5 ml-3.5 text-xs text-ink-soft leading-relaxed line-clamp-2">
                    {n.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: Upcoming due (7) + Topic mastery (5) */}
      <div
        className="grid lg:grid-cols-12 gap-5 rise"
        style={{ animationDelay: "180ms" }}
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

      {/* Row 3: Recent grades — full width */}
      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "220ms" }}>
        <SectionHeader title="Recent grades" />
        {grades.length === 0 ? (
          <Empty>No marked homework yet.</Empty>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 p-5">
            {grades.map((g) => (
              <Link
                key={g.homeworkId}
                href={`/student/homework/${g.homeworkId}`}
                className="block rounded-xl border border-hairline/50 bg-card p-4 hover:border-brand-400 hover:shadow-[0_8px_20px_-12px_rgba(29,41,81,0.18)] transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-sm text-ink font-medium truncate">
                      {g.title}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 truncate">
                      {g.className ?? "—"} · {relativeTime(g.markedAt)}
                    </div>
                  </div>
                  <ScoreBadge score={g.score} />
                </div>
                {g.feedback && (
                  <p className="text-xs text-ink-soft leading-relaxed line-clamp-2">
                    "{g.feedback}"
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>
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
  accent = "brand",
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "brand" | "warn" | "success" | "muted";
}) {
  const accentClass = {
    brand: "text-brand-700",
    warn: "text-amber-700",
    success: "text-emerald-700",
    muted: "text-ink",
  }[accent];
  const borderClass = {
    brand: "border-hairline/50",
    warn: "border-amber-200/70",
    success: "border-emerald-200/60",
    muted: "border-hairline/50",
  }[accent];
  return (
    <div
      className={`rounded-xl border bg-card px-5 py-4 hover:shadow-[0_8px_20px_-14px_rgba(29,41,81,0.18)] transition-shadow ${borderClass}`}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-medium tabular-nums truncate ${accentClass}`}>
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
      className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium tabular-nums border ${tone}`}
    >
      {Number.isFinite(num) ? `${num}` : score}
    </span>
  );
}
