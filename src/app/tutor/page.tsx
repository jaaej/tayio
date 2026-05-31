import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import { StatTile } from "@/components/data/stat-tile";
import { StatusBadge } from "@/components/data/status-badge";
import {
  formatTime,
  formatWeekday,
  relativeTime,
  startOfMondayWeek,
} from "@/lib/format";
import {
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "@/lib/status";
import {
  getLessonsMissingNotes,
  getPendingMarkCount,
  getPendingNotesCount,
  getRecentLessonNotes,
  getSubmissionsToMark,
  getTodayLessons,
  getTutorWeekLessons,
  requireTutor,
} from "./_data";

export default async function TutorDashboard() {
  const tutor = await requireTutor();

  const now = new Date();
  const weekStart = startOfMondayWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [
    todayLessons,
    weekLessons,
    submissions,
    missingNotes,
    pendingMark,
    pendingNotes,
    recentNotes,
  ] = await Promise.all([
    getTodayLessons(tutor.id),
    getTutorWeekLessons(tutor.id, weekStart, weekEnd),
    getSubmissionsToMark(tutor.id, 9),
    getLessonsMissingNotes(tutor.id, 5),
    getPendingMarkCount(tutor.id),
    getPendingNotesCount(tutor.id),
    getRecentLessonNotes(tutor.id, 4),
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

  const dateLabel = now.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const nextToday = todayLessons.find((l) => {
    const [h, m] = l.startTime.split(":").map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0, 0);
    return start >= now;
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
          <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
            Today
          </h1>
        </div>
        {nextToday && (
          <div className="hidden md:flex items-center gap-3 text-sm">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Next
            </span>
            <span className="text-ink font-medium">{nextToday.className}</span>
            <span className="text-muted">·</span>
            <span className="text-ink-soft">
              {formatTime(nextToday.startTime)}
            </span>
          </div>
        )}
      </header>

      {/* Stat strip */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Classes today"
          value={todayLessons.length.toString()}
          accent={todayLessons.length > 0 ? "brand" : "muted"}
        />
        <StatTile
          label="To mark"
          value={pendingMark.toString()}
          accent={pendingMark > 0 ? "warn" : "muted"}
          href="/tutor/homework"
        />
        <StatTile
          label="Notes pending"
          value={pendingNotes.toString()}
          accent={pendingNotes > 0 ? "warn" : "muted"}
          href="/tutor/notes"
        />
        <StatTile
          label="Lessons this week"
          value={weekLessons.length.toString()}
          accent="brand"
        />
      </section>

      {/* Top: big calendar (left) + today's schedule (right) */}
      <div
        className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-5 lg:gap-6 rise"
        style={{ animationDelay: "80ms" }}
      >
        {/* CALENDAR — large left block */}
        <Card className="p-0 overflow-hidden">
          <SectionHeader
            title="This Week"
            link={{ href: "/tutor/timetable", label: "Open timetable" }}
          />
          <div className="p-5 bg-gradient-to-b from-brand-50/40 to-transparent">
            <MiniWeekCalendar events={events} weekStart={weekStart} />
          </div>
        </Card>

        {/* TODAY'S SCHEDULE — right column, matches calendar height */}
        <Card className="p-0 overflow-hidden flex flex-col">
          <SectionHeader
            title="Today's Schedule"
            right={
              todayLessons.length === 0
                ? "Nothing"
                : `${todayLessons.length} class${todayLessons.length === 1 ? "" : "es"}`
            }
          />
          {todayLessons.length === 0 ? (
            <Empty>
              Nothing on your calendar today — see{" "}
              <Link
                href="/tutor/classes"
                className="text-brand-700 hover:underline"
              >
                your class list
              </Link>{" "}
              for upcoming sessions.
            </Empty>
          ) : (
            <div className="p-5 space-y-3 flex-1">
              {todayLessons.map((l) => (
                <Link
                  key={l.id}
                  href={`/tutor/lessons/${l.id}`}
                  className="flex items-baseline gap-4 rounded-xl border border-brand-200/70 bg-gradient-to-r from-brand-200/70 via-brand-100/60 to-brand-50/30 px-4 py-3.5 hover:from-brand-300/70 hover:via-brand-200/60 hover:border-brand-400 transition-colors"
                >
                  <div className="w-20 text-sm tabular-nums text-ink shrink-0">
                    {formatTime(l.startTime)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-ink truncate font-medium">
                      {l.className}
                    </div>
                    <div className="text-sm text-muted mt-0.5 truncate">
                      {l.subjectName}
                      {l.location ? ` · ${l.location}` : ""}
                      {l.onlineLink ? " · Online" : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Submissions to mark — main block */}
      <Card
        className="p-0 overflow-hidden rise"
        style={{ animationDelay: "120ms" }}
      >
        <SectionHeader
          title="Submissions To Mark"
          right={
            submissions.length > 0
              ? `${pendingMark} awaiting`
              : undefined
          }
          link={{ href: "/tutor/homework", label: "All homework" }}
        />
        {submissions.length === 0 ? (
          <Empty>No new submissions waiting — you're up to date.</Empty>
        ) : (
          <div className="p-5 grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {submissions.map((s) => {
              const isLate = s.status === "late";
              // submission status only — anything else is "pending" (no submission yet)
              const isSubmitted = s.status === "submitted";
              const tone = isLate
                ? {
                    border: "border-amber-400 bg-amber-50/70 hover:bg-amber-100/70 hover:border-amber-500",
                    avatar: "bg-amber-600",
                    footer: "border-amber-300/70 text-amber-900/80",
                    cta: "text-amber-800",
                  }
                : isSubmitted
                  ? {
                      border:
                        "border-emerald-400 bg-emerald-50/60 hover:bg-emerald-100/60 hover:border-emerald-500",
                      avatar: "bg-emerald-600",
                      footer: "border-emerald-300/70 text-emerald-900/80",
                      cta: "text-emerald-800",
                    }
                  : {
                      border:
                        "border-brand-300 bg-brand-50/60 hover:bg-brand-100/60 hover:border-brand-400",
                      avatar: "bg-brand-600",
                      footer: "border-brand-300/70 text-brand-900/80",
                      cta: "text-brand-700",
                    };
              return (
                <Link
                  key={`${s.homeworkId}-${s.studentId}`}
                  href={`/tutor/homework/${s.homeworkId}`}
                  className={`group block rounded-2xl border-2 p-5 transition-all hover:shadow-[0_10px_28px_-16px_rgba(29,41,81,0.28)] hover:-translate-y-[1px] ${tone.border}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-8 w-8 rounded-full text-white flex items-center justify-center text-[11px] font-semibold shrink-0 ${tone.avatar}`}
                        >
                          {s.firstName.charAt(0)}
                          {s.lastName.charAt(0)}
                        </div>
                        <div className="text-base font-medium text-ink truncate">
                          {s.firstName} {s.lastName}
                        </div>
                      </div>
                    </div>
                    <StatusBadge
                      label={HOMEWORK_STATUS_LABEL[s.status] ?? s.status}
                      className={HOMEWORK_STATUS_STYLE[s.status]}
                    />
                  </div>
                  <div className="text-sm text-ink line-clamp-2 leading-relaxed">
                    {s.title}
                  </div>
                  <div
                    className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${tone.footer}`}
                  >
                    <span className="truncate">
                      {s.className ?? "Individual"}
                    </span>
                    <span className="shrink-0">
                      {s.submittedAt
                        ? `submitted ${relativeTime(s.submittedAt)}`
                        : ""}
                    </span>
                  </div>
                  <div
                    className={`mt-3 text-xs uppercase tracking-[0.16em] font-semibold ${tone.cta}`}
                  >
                    Mark →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Bottom row: lessons missing notes + recent notes */}
      <div
        className="grid lg:grid-cols-2 gap-5 lg:gap-6 rise"
        style={{ animationDelay: "160ms" }}
      >
        <Card className="p-0 overflow-hidden">
          <SectionHeader
            title="Lessons Missing A Note"
            right={
              missingNotes.length > 0
                ? `${missingNotes.length} in last 7 days`
                : undefined
            }
          />
          {missingNotes.length === 0 ? (
            <Empty>Every recent lesson is documented. Nice.</Empty>
          ) : (
            <div className="divide-y divide-hairline/60">
              {missingNotes.map((l) => (
                <Link
                  key={l.id}
                  href={`/tutor/lessons/${l.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-brand-50 transition-colors"
                >
                  <div className="w-24 text-sm tabular-nums text-ink-soft shrink-0">
                    {formatWeekday(l.date, "short")}{" "}
                    {formatTime(l.startTime)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-ink truncate">
                      {l.className}
                    </div>
                    <div className="text-sm text-muted mt-0.5 truncate">
                      {l.subjectName}
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-brand-700 shrink-0">
                    Write note →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-0 overflow-hidden">
          <SectionHeader title="Recent Notes" />
          {recentNotes.length === 0 ? (
            <Empty>No notes yet.</Empty>
          ) : (
            <div className="divide-y divide-hairline/60">
              {recentNotes.map((n) => (
                <Link
                  key={n.id}
                  href={`/tutor/students/${n.studentId}`}
                  className="block px-5 py-3.5 hover:bg-brand-50/40 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0" />
                      <div className="text-base text-ink font-medium truncate">
                        {n.studentFirstName} {n.studentLastName}
                      </div>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted shrink-0">
                      {relativeTime(new Date(n.createdAt))}
                    </div>
                  </div>
                  <p className="mt-1.5 ml-3.5 text-sm text-ink-soft leading-relaxed line-clamp-2">
                    {n.topicCovered ??
                      n.parentVisibleComment ??
                      n.internalNote ??
                      n.className}
                  </p>
                </Link>
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
  eyebrow,
  right,
  link,
}: {
  title: string;
  eyebrow?: string;
  right?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xl font-medium text-ink uppercase tracking-wide">{title}</div>
        {eyebrow && (
          <div className="text-sm uppercase tracking-[0.16em] text-muted mt-1 truncate">
            {eyebrow}
          </div>
        )}
      </div>
      {link ? (
        <Link
          href={link.href}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm font-semibold hover:bg-brand-700 transition-colors"
        >
          {link.label} →
        </Link>
      ) : right ? (
        <span className="text-sm uppercase tracking-[0.18em] text-muted font-medium shrink-0">
          {right}
        </span>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-8 text-sm text-ink-soft">{children}</div>;
}
