import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/data/stat-tile";
import { StatusBadge } from "@/components/data/status-badge";
import { ProgressBar } from "@/components/data/progress-bar";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import { requireRole } from "@/lib/auth";
import {
  formatDueDate,
  formatMoney,
  isoDate,
  relativeTime,
  startOfMondayWeek,
} from "@/lib/format";
import {
  LESSON_STATUS_LABEL,
  LESSON_STATUS_STYLE,
} from "@/lib/status";
import {
  getAtRiskStudents,
  getOpsStats,
  getOverdueInvoices,
  getRecentActivity,
  getRecentAnnouncements,
  getTutorsWithPendingNotes,
  getWeekLessons,
} from "./_lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireRole("admin");

  const now = new Date();
  const weekStart = startOfMondayWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [stats, tutorBacklog, overdueList, atRisk, weekLessons, activity, notices] =
    await Promise.all([
      getOpsStats({
        weekStart,
        weekEnd,
        monthStart,
        prevMonthStart,
        today: now,
      }),
      getTutorsWithPendingNotes(fourteenDaysAgo, now, 5),
      getOverdueInvoices(now, 5),
      getAtRiskStudents(5),
      getWeekLessons(weekStart, weekEnd),
      getRecentActivity(8),
      getRecentAnnouncements(4),
    ]);

  const events: CalendarEvent[] = weekLessons.map((l) => ({
    date: l.date,
    time: l.startTime.slice(0, 5),
    endTime: l.endTime.slice(0, 5),
    label: l.subjectName,
    meta: `${l.tutorFirst} ${l.tutorLast.charAt(0)}.`,
    kind: "lesson",
  }));

  const dateLabel = now.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const attentionItems = tutorBacklog.length + overdueList.length;

  return (
    <div className="space-y-6">
      {/* Title strip */}
      <header className="flex items-baseline justify-between rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
            Operations · {dateLabel}
          </div>
          <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
            Dashboard
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Roster
          </span>
          <span className="text-ink font-medium tabular-nums">
            {stats.activeStudents}
          </span>
          <span className="text-muted">students</span>
          <span className="text-muted">·</span>
          <span className="text-ink font-medium tabular-nums">
            {stats.activeTutors}
          </span>
          <span className="text-muted">tutors</span>
        </div>
      </header>

      {/* Stat strip */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Flagged students"
          value={atRisk.length.toString()}
          accent={atRisk.length > 0 ? "warn" : "muted"}
        />
        <StatTile
          label="Notes pending"
          value={stats.notesPending.toString()}
          accent={stats.notesPending > 0 ? "warn" : "muted"}
          href="/admin/classes"
        />
      </section>

      {/* Main + Aside */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-5 lg:gap-6">
        {/* MAIN */}
        <div
          className="space-y-5 min-w-0 rise"
          style={{ animationDelay: "80ms" }}
        >
          {/* Needs your attention */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title="Needs Your Attention"
              right={
                attentionItems > 0
                  ? `${attentionItems} item${attentionItems === 1 ? "" : "s"}`
                  : "All clear"
              }
            />
            {attentionItems === 0 ? (
              <Empty>Nothing to action — every tutor and parent is up to date.</Empty>
            ) : (
              <div className="divide-y divide-hairline/60">
                {tutorBacklog.map((t) => (
                  <Link
                    key={t.tutorId}
                    href={`/admin/users/${t.tutorId}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-ink truncate">
                        {t.firstName} {t.lastName}
                      </div>
                      <div className="text-sm text-muted mt-0.5">
                        {t.pendingNotes} lesson note
                        {t.pendingNotes === 1 ? "" : "s"} overdue · last 14 days
                      </div>
                    </div>
                    <Badge tone="warn">Notes</Badge>
                  </Link>
                ))}
                {overdueList.map((inv) => (
                  <Link
                    key={inv.id}
                    href="/admin/payments"
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-ink truncate">
                        {inv.parentFirst} {inv.parentLast}
                        {inv.studentFirst ? (
                          <span className="text-muted">
                            {" "}
                            · {inv.studentFirst} {inv.studentLast}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted mt-0.5">
                        {formatMoney(Number(inv.amount))} · due{" "}
                        {formatDueDate(new Date(`${inv.dueDate}T00:00:00`))}
                      </div>
                    </div>
                    <Badge tone="danger">Overdue</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* This week */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title="This Week"
              link={{ href: "/admin/classes", label: "All classes" }}
            />
            <div className="p-4 bg-gradient-to-b from-brand-50/30 to-transparent">
              <MiniWeekCalendar events={events} weekStart={weekStart} />
            </div>
          </Card>

          {/* At-risk students */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title="At-risk students"
              right={
                atRisk.length > 0
                  ? `${atRisk.length} flagged`
                  : "None right now"
              }
            />
            {atRisk.length === 0 ? (
              <Empty>No students with pending homework backlog.</Empty>
            ) : (
              <div className="divide-y divide-hairline/60">
                {atRisk.map((s) => (
                  <Link
                    key={s.studentId}
                    href={`/admin/users/${s.studentId}`}
                    className="block px-6 py-3.5 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="text-base text-ink truncate">
                          {s.firstName} {s.lastName}
                        </div>
                        <div className="text-sm text-muted mt-0.5">
                          {s.yearLevel ? `Yr ${s.yearLevel} · ` : ""}
                          {s.pendingHomework} pending homework
                        </div>
                      </div>
                      <span className="text-sm text-ink-soft tabular-nums shrink-0">
                        {s.completionPercent}%
                      </span>
                    </div>
                    <ProgressBar
                      percent={s.completionPercent}
                      color={
                        s.completionPercent >= 75
                          ? "bg-emerald-500"
                          : s.completionPercent >= 40
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }
                    />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Recent activity */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader title="Recent Activity" />
            {activity.length === 0 ? (
              <Empty>No enrolments, payments, or announcements yet.</Empty>
            ) : (
              <div className="divide-y divide-hairline/60">
                {activity.map((a, i) => (
                  <Link
                    key={`${a.kind}-${i}`}
                    href={a.href}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-brand-50 transition-colors"
                  >
                    <ActivityDot kind={a.kind} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{a.title}</div>
                      {a.meta && (
                        <div className="text-xs text-muted mt-0.5 truncate">
                          {a.meta}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted shrink-0">
                      {relativeTime(a.at)}
                    </span>
                  </Link>
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
          {/* Announcements */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader
              title="Announcements"
              link={{ href: "/admin/announcements", label: "Compose" }}
            />
            {notices.length === 0 ? (
              <Empty>
                Nothing published yet —{" "}
                <Link
                  className="text-brand-700 hover:underline"
                  href="/admin/announcements"
                >
                  send your first
                </Link>
                .
              </Empty>
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
                        <div className="text-sm text-ink font-medium truncate">
                          {n.title}
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted shrink-0">
                        {relativeTime(new Date(n.publishedAt))}
                      </div>
                    </div>
                    <div className="mt-1.5 ml-3.5 text-xs text-muted">
                      {n.className
                        ? `Class · ${n.className}`
                        : n.audienceRole
                          ? `All ${n.audienceRole}s`
                          : "Everyone"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Jump to */}
          <Card className="p-0 overflow-hidden">
            <SectionHeader title="Jump To" />
            <div className="grid grid-cols-2 divide-x divide-y divide-hairline/60">
              <JumpLink href="/admin/users" label="Users" />
              <JumpLink href="/admin/classes" label="Classes" />
              <JumpLink href="/admin/enrolments" label="Enrolments" />
              <JumpLink href="/admin/payments" label="Payments" />
              <JumpLink href="/admin/announcements" label="Announcements" />
              <JumpLink href="/admin/reports" label="Reports" />
            </div>
          </Card>

          {/* Today’s lessons preview */}
          {weekLessons.filter((l) => l.date === isoDate(now)).length > 0 && (
            <Card className="p-0 overflow-hidden">
              <SectionHeader title="Today's Lessons" />
              <div className="divide-y divide-hairline/60">
                {weekLessons
                  .filter((l) => l.date === isoDate(now))
                  .slice(0, 6)
                  .map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <div className="text-xs text-muted tabular-nums shrink-0 w-14">
                        {l.startTime.slice(0, 5)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink truncate">
                          {l.subjectName}
                        </div>
                        <div className="text-xs text-muted truncate">
                          {l.tutorFirst} {l.tutorLast}
                        </div>
                      </div>
                      <StatusBadge
                        label={LESSON_STATUS_LABEL[l.status] ?? l.status}
                        className={LESSON_STATUS_STYLE[l.status]}
                      />
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </aside>
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
          className="text-sm text-brand-700 hover:underline shrink-0"
        >
          {link.label} →
        </Link>
      ) : right ? (
        <span className="text-sm uppercase tracking-[0.18em] text-muted shrink-0">
          {right}
        </span>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-8 text-sm text-ink-soft">{children}</div>;
}

function JumpLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-5 py-4 text-sm text-ink-soft hover:bg-brand-50 hover:text-ink transition-colors text-center"
    >
      {label}
    </Link>
  );
}

function ActivityDot({ kind }: { kind: "enrolment" | "payment" | "announcement" }) {
  const color =
    kind === "payment"
      ? "bg-emerald-500"
      : kind === "enrolment"
        ? "bg-brand-600"
        : "bg-amber-500";
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${color}`}
      aria-hidden
    />
  );
}
