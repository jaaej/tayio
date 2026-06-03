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
import { PageHeader } from "./_components/page-header";
import { FeedbackList, type FeedbackItem } from "./_components/feedback-list";

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
        <PageHeader eyebrow={dateLabel} title="Family overview" pulse />
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
  const feedbackItems: FeedbackItem[] = recentFeedback.map((f) => ({
    id: String(f.id),
    subjectName: f.subjectName,
    tutorName: f.tutorName,
    parentVisibleComment: f.parentVisibleComment,
    timeLabel: relativeTime(f.createdAt),
  }));
  const recentAttendance = attendanceLog.slice(0, 6);

  const homeworkRatio =
    data.homeworkTotal > 0
      ? `${data.homeworkCompleted} / ${data.homeworkTotal}`
      : "—";

  const classesHref = `/parent/classes?child=${selected.id}`;

  return (
    <div className="space-y-6">
      {/* Hero — indigo gradient greeting with child meta + next lesson pod */}
      <section
        className="relative overflow-hidden rounded-[28px] px-7 py-7 text-white shadow-[0_20px_44px_-22px_rgba(31,40,90,0.6)] rise"
        style={{
          background:
            "radial-gradient(120% 140% at 0% 0%, #A0BFFC 0%, transparent 45%), radial-gradient(110% 150% at 100% 10%, #7A9BF5 0%, transparent 52%), linear-gradient(125deg, #4F5BD5 0%, #3F4AB5 58%, #2B3287 100%)",
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-8 -top-10 w-[240px] h-[240px] opacity-25 pointer-events-none"
          fill="none"
        >
          <circle cx="70" cy="30" r="30" fill="rgba(255,255,255,0.4)" />
          <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.4)" />
          <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.5)" />
        </svg>

        <div className="relative z-10 flex flex-wrap items-center gap-6">
          <div className="h-[68px] w-[68px] rounded-[22px] grid place-items-center text-2xl font-extrabold bg-white/[0.16] border-2 border-white/40 backdrop-blur-sm shrink-0">
            {selected.firstName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold opacity-80">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {dateLabel}
            </div>
            <h1 className="mt-1.5 text-3xl lg:text-4xl font-extrabold tracking-[-0.02em]">
              How {selected.firstName}'s going
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {selected.yearLevel && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-bold bg-white/[0.18] border border-white/25">
                  {selected.yearLevel}
                </span>
              )}
              {mastery.length > 0 && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-bold bg-white/[0.18] border border-white/25">
                  {mastery.length} subject{mastery.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          {data.nextLesson && (
            <div className="rounded-[20px] bg-white/[0.14] border border-white/25 px-5 py-4 backdrop-blur-sm text-center shrink-0">
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold opacity-80">
                Up next
              </div>
              <div className="mt-1 text-2xl font-extrabold tracking-[-0.02em] tabular-nums">
                {formatTime(data.nextLesson.startTime)}
              </div>
              <div className="mt-0.5 text-xs font-semibold opacity-90">
                {data.nextLesson.subjectName}
              </div>
              <div className="text-[11px] opacity-75">
                {formatWeekday(data.nextLesson.date, "short")}
              </div>
            </div>
          )}
        </div>
      </section>

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
          href="/parent/classes"
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
              title="This Week"
              link={{ href: classesHref, label: "Open classes" }}
            />
            <div className="p-4 bg-gradient-to-b from-brand-50/30 to-transparent">
              <MiniWeekCalendar events={events} weekStart={weekStart} />
            </div>
            <div className="px-5 pb-5 pt-4">
              <Link
                href={classesHref}
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
              title="From The Tutor"
              link={{ href: "/parent/feedback", label: "All feedback" }}
            />
            {feedbackItems.length === 0 ? (
              <Empty>
                No tutor notes yet. After {selected.firstName}'s next lesson the
                tutor's note will appear here.
              </Empty>
            ) : (
              <FeedbackList items={feedbackItems} />
            )}
          </Card>

          {/* Recent attendance */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title="Recent Attendance"
              link={{ href: "/parent/classes", label: "Full log" }}
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
            <SectionHeader
              title="Topic Mastery"
              link={{
                href: `/parent/progress?child=${selected.id}`,
                label: "Open",
              }}
            />
            <div className="p-5">
              <CardLabel>Overall</CardLabel>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-6xl font-extrabold tracking-[-0.03em] text-ink tabular-nums">
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
                          userId={t.id}
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
                        userId={admin.id}
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
  userId,
}: {
  name: string;
  meta?: string;
  email: string;
  phone: string | null;
  userId?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="min-w-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base text-ink truncate">{name}</div>
          {meta && (
            <div className="text-xs text-muted truncate">{meta}</div>
          )}
        </div>
        {userId && (
          <a
            href={`/parent/messages/with/${userId}`}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Message
          </a>
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
