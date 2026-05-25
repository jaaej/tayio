import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { StatTile } from "@/components/data/stat-tile";
import { StatusBadge } from "@/components/data/status-badge";
import { ProgressBar } from "@/components/data/progress-bar";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import { requireRole } from "@/lib/auth";
import {
  formatDateLong,
  formatTime,
  formatWeekday,
  isoDate,
  relativeTime,
  startOfMondayWeek,
} from "@/lib/format";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/status";
import {
  getAdminContact,
  getAttendance,
  getChildTutors,
  getDashboardData,
  getFeedback,
  getHomeworkDueBetween,
  getLessonsBetween,
  getParentAnnouncements,
  getTopicMastery,
  resolveSelectedChild,
} from "./_data";
import { ChildSwitcher, EmptyChildrenNotice } from "./_components/child-switcher";
import { SectionHeader } from "./_components/section-header";

type SearchParams = Promise<{ child?: string }>;

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (!selected) {
    return (
      <div className="space-y-6">
        <header className="rise">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
            {dateLabel}
          </div>
          <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
            Family overview
          </h1>
        </header>
        <EmptyChildrenNotice />
      </div>
    );
  }

  const weekStart = startOfMondayWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekStartIso = isoDate(weekStart);
  const weekEndIso = isoDate(weekEnd);

  const [
    data,
    weekLessons,
    weekHomework,
    feedback,
    attendanceLog,
    mastery,
    notices,
    tutors,
    admin,
  ] = await Promise.all([
    getDashboardData(selected.id),
    getLessonsBetween(selected.id, weekStartIso, weekEndIso),
    getHomeworkDueBetween(selected.id, weekStart, weekEnd),
    getFeedback(selected.id),
    getAttendance(selected.id),
    getTopicMastery(selected.id),
    getParentAnnouncements(user.id, 4),
    getChildTutors(selected.id),
    getAdminContact(),
  ]);

  const events: CalendarEvent[] = [];
  for (const l of weekLessons) {
    events.push({
      date: l.date,
      time: l.startTime.slice(0, 5),
      endTime: l.endTime.slice(0, 5),
      label: l.subjectName,
      kind: "lesson",
    });
  }
  for (const h of weekHomework) {
    if (h.status === "marked" || h.status === "submitted" || h.status === "returned")
      continue;
    events.push({
      date: isoDate(h.dueDate),
      time: null,
      label: h.title,
      meta: h.className ?? undefined,
      kind: "homework",
    });
  }

  const overallMastery =
    mastery.length > 0
      ? Math.round(mastery.reduce((acc, m) => acc + m.percent, 0) / mastery.length)
      : 0;

  const recentFeedback = feedback.slice(0, 4);
  const recentAttendance = attendanceLog.slice(0, 6);

  const homeworkRatio =
    data.homeworkTotal > 0
      ? `${data.homeworkCompleted} / ${data.homeworkTotal}`
      : "—";

  const bookingsHref = `/parent/bookings?child=${selected.id}`;

  return (
    <div className="space-y-6">
      {/* Title strip */}
      <header className="flex items-baseline justify-between gap-6 rise">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
            {dateLabel}
          </div>
          <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
            How {selected.firstName}'s going
          </h1>
        </div>
        {data.nextLesson && (
          <div className="hidden md:flex items-center gap-3 text-sm shrink-0">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Next
            </span>
            <span className="text-ink font-medium">
              {data.nextLesson.subjectName}
            </span>
            <span className="text-muted">·</span>
            <span className="text-ink-soft">
              {formatWeekday(data.nextLesson.date, "short")}{" "}
              {formatTime(data.nextLesson.startTime)}
            </span>
          </div>
        )}
      </header>

      {/* Child switcher */}
      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent"
          />
        </div>
      )}

      {/* Stat strip */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Attendance"
          value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"}
          accent={
            data.attendanceRate === null
              ? "muted"
              : data.attendanceRate >= 90
                ? "success"
                : data.attendanceRate >= 75
                  ? "brand"
                  : "warn"
          }
          href="/parent/attendance"
        />
        <StatTile
          label="Homework"
          value={homeworkRatio}
          accent={
            data.homeworkTotal === 0
              ? "muted"
              : data.homeworkCompleted / data.homeworkTotal >= 0.9
                ? "success"
                : data.homeworkCompleted / data.homeworkTotal >= 0.6
                  ? "brand"
                  : "warn"
          }
          href="/parent/homework"
        />
      </section>

      {/* Main + Aside */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-5 lg:gap-6">
        {/* MAIN */}
        <div
          className="space-y-5 min-w-0 rise"
          style={{ animationDelay: "80ms" }}
        >
          {/* This week — calendar with prominent reschedule CTA */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title="This week"
              link={{ href: bookingsHref, label: "Open bookings" }}
            />
            <div className="p-4 bg-gradient-to-b from-brand-50/30 to-transparent">
              <MiniWeekCalendar events={events} weekStart={weekStart} />
            </div>
            <div className="px-5 pb-5 pt-4">
              <Link
                href={bookingsHref}
                className="group flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 text-navy-800 px-6 py-4 hover:from-brand-200 hover:via-brand-300 hover:to-brand-200 transition-colors"
              >
                <span className="text-lg font-medium">Reschedule a class</span>
                <span
                  aria-hidden
                  className="text-2xl shrink-0 transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          </Card>

          {/* Tutor feedback feed */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title="From the tutor"
              link={{ href: "/parent/feedback", label: "All feedback" }}
            />
            {recentFeedback.length === 0 ? (
              <Empty>
                No tutor notes yet. After {selected.firstName}'s next lesson the
                tutor's note will appear here.
              </Empty>
            ) : (
              <div className="divide-y divide-hairline/60">
                {recentFeedback.map((f, i) => (
                  <div key={f.id} className="px-6 py-5">
                    {i === 0 ? (
                      <>
                        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted">
                          <span>
                            {f.subjectName ?? "Lesson"}
                            {f.topicCovered ? (
                              <span className="ml-2 text-ink-soft normal-case tracking-normal">
                                · {f.topicCovered}
                              </span>
                            ) : null}
                          </span>
                          <span>{relativeTime(f.createdAt)}</span>
                        </div>
                        <p className="mt-3 text-xl text-ink leading-snug">
                          {f.parentVisibleComment}
                        </p>
                        <div className="mt-3 text-xs text-muted">
                          {f.tutorName}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                            {f.subjectName ?? "Lesson"} · {f.tutorName}
                          </div>
                          <p className="mt-1.5 text-base text-ink-soft leading-relaxed line-clamp-2">
                            {f.parentVisibleComment}
                          </p>
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted shrink-0">
                          {relativeTime(f.createdAt)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent attendance */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title="Recent attendance"
              link={{ href: "/parent/attendance", label: "Full log" }}
            />
            {recentAttendance.length === 0 ? (
              <Empty>No attendance recorded yet.</Empty>
            ) : (
              <div className="divide-y divide-hairline/60">
                {recentAttendance.map((r) => (
                  <div
                    key={r.lessonId}
                    className="flex items-center gap-4 px-6 py-3.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-ink">
                        {formatDateLong(r.date)}
                      </div>
                      <div className="text-sm text-muted mt-0.5 truncate">
                        {r.subjectName ?? "Lesson"} · {formatTime(r.startTime)} ·{" "}
                        {r.tutorName}
                      </div>
                    </div>
                    <StatusBadge
                      label={ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}
                      className={ATTENDANCE_STATUS_STYLE[r.status]}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ASIDE */}
        <aside
          className="space-y-5 min-w-0 rise lg:sticky lg:top-6 lg:self-start"
          style={{ animationDelay: "120ms" }}
        >
          {/* Topic mastery */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader title="Topic mastery" />
            <div className="p-5">
              <CardLabel>Overall</CardLabel>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-6xl font-light text-ink tabular-nums">
                  {overallMastery}%
                </div>
                {mastery.length > 0 && (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                    {mastery.length} subj
                  </span>
                )}
              </div>
              <div className="mt-5 space-y-3.5">
                {mastery.slice(0, 5).map((m) => (
                  <ProgressBar
                    key={m.subjectId}
                    label={m.subjectName}
                    percent={m.percent}
                    color={
                      m.percent >= 85
                        ? "bg-emerald-500"
                        : m.percent >= 60
                          ? "bg-brand-600"
                          : m.percent >= 30
                            ? "bg-amber-500"
                            : "bg-hairline"
                    }
                  />
                ))}
                {mastery.length === 0 && (
                  <div className="text-xs text-muted">No data yet.</div>
                )}
              </div>
            </div>
          </Card>

          {/* Contact */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader title="Contact" />
            <div className="p-5 space-y-4">
              {tutors.length === 0 && !admin ? (
                <p className="text-sm text-ink-soft">
                  No contacts on file yet.
                </p>
              ) : (
                <>
                  {tutors.length > 0 && (
                    <div className="space-y-3">
                      <CardLabel>Tutors</CardLabel>
                      {tutors.map((t) => (
                        <ContactRow
                          key={t.id}
                          name={`${t.firstName} ${t.lastName}`.trim()}
                          meta={t.subjects.join(" · ")}
                          email={t.email}
                          phone={t.phone}
                        />
                      ))}
                    </div>
                  )}
                  {admin && (
                    <div className="pt-4 border-t border-hairline/60 space-y-3">
                      <CardLabel>Admin office</CardLabel>
                      <ContactRow
                        name={`${admin.firstName} ${admin.lastName}`.trim()}
                        meta="Taiyo Tuition"
                        email={admin.email}
                        phone={admin.phone}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Announcements */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader title="Announcements" />
            {notices.length === 0 ? (
              <Empty>No announcements right now.</Empty>
            ) : (
              <div className="divide-y divide-hairline/60">
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className="px-5 py-3.5 hover:bg-brand-50/40 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0" />
                        <div className="text-base text-ink font-medium truncate">
                          {n.title}
                        </div>
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted shrink-0">
                        {relativeTime(new Date(n.publishedAt))}
                      </div>
                    </div>
                    <p className="mt-1.5 ml-3.5 text-sm text-ink-soft leading-relaxed line-clamp-2">
                      {n.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ContactRow({
  name,
  meta,
  email,
  phone,
}: {
  name: string;
  meta?: string;
  email: string;
  phone: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="min-w-0">
        <div className="text-base text-ink truncate">{name}</div>
        {meta && (
          <div className="text-xs text-muted truncate">{meta}</div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <a
          href={`mailto:${email}`}
          className="text-brand-700 hover:underline truncate"
        >
          {email}
        </a>
        {phone && (
          <>
            <span className="text-muted">·</span>
            <a
              href={`tel:${phone}`}
              className="text-ink-soft hover:text-ink"
            >
              {phone}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-8 text-sm text-ink-soft">{children}</div>;
}
