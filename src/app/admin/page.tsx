import Link from "next/link";
import { ProgressBar } from "@/components/data/progress-bar";
import {
  MiniWeekCalendar,
  type CalendarEvent,
} from "@/components/data/mini-week-calendar";
import { Card, CardHead, Pill, PageHeader, Empty } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import {
  formatDueDate,
  formatMoney,
  relativeTime,
  startOfMondayWeek,
} from "@/lib/format";
import {
  getAtRiskStudents,
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
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [tutorBacklog, overdueList, atRisk, weekLessons, activity, notices] =
    await Promise.all([
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
      <PageHeader
        className="rise"
        eyebrow={
          <>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            Operations · {dateLabel}
          </>
        }
        title="Dashboard"
      />

      {/* Main + Aside */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-5 lg:gap-6">
        {/* MAIN */}
        <div
          className="space-y-5 min-w-0 rise"
          style={{ animationDelay: "80ms" }}
        >
          {/* Needs your attention */}
          <Card>
            <CardHead
              title="Needs your attention"
              action={
                <Pill tone={attentionItems > 0 ? "warn" : "good"}>
                  {attentionItems > 0
                    ? `${attentionItems} item${attentionItems === 1 ? "" : "s"}`
                    : "All clear"}
                </Pill>
              }
            />
            {attentionItems === 0 ? (
              <Empty>Nothing to action - every tutor and parent is up to date.</Empty>
            ) : (
              <div className="divide-y divide-line">
                {tutorBacklog.map((t) => (
                  <Link
                    key={t.tutorId}
                    href={`/admin/users/${t.tutorId}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-ink truncate">
                        {t.firstName} {t.lastName}
                      </div>
                      <div className="text-[12px] text-muted mt-0.5">
                        {t.pendingNotes} lesson note
                        {t.pendingNotes === 1 ? "" : "s"} overdue · last 14 days
                      </div>
                    </div>
                    <Pill tone="warn">Notes</Pill>
                  </Link>
                ))}
                {overdueList.map((inv) => (
                  <Link
                    key={inv.id}
                    href="/admin/payments"
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-ink truncate">
                        {inv.parentFirst} {inv.parentLast}
                        {inv.studentFirst ? (
                          <span className="text-muted font-normal">
                            {" "}
                            · {inv.studentFirst} {inv.studentLast}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[12px] text-muted mt-0.5">
                        {formatMoney(Number(inv.amount))} · due{" "}
                        {formatDueDate(new Date(`${inv.dueDate}T00:00:00`))}
                      </div>
                    </div>
                    <Pill tone="bad">Overdue</Pill>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* This week */}
          <Card>
            <CardHead
              title="This week"
              action={
                <Link
                  href="/admin/classes"
                  className="text-[12px] font-bold text-brand-600 hover:underline"
                >
                  All classes →
                </Link>
              }
            />
            <div className="p-4 bg-gradient-to-b from-brand-50/40 to-transparent">
              <MiniWeekCalendar events={events} weekStart={weekStart} />
            </div>
          </Card>

          {/* At-risk students */}
          <Card>
            <CardHead
              title="At-risk students"
              action={
                <Pill tone={atRisk.length > 0 ? "warn" : "good"}>
                  {atRisk.length > 0
                    ? `${atRisk.length} flagged`
                    : "None right now"}
                </Pill>
              }
            />
            {atRisk.length === 0 ? (
              <Empty>No students with pending homework backlog.</Empty>
            ) : (
              <div className="divide-y divide-line">
                {atRisk.map((s) => (
                  <Link
                    key={s.studentId}
                    href={`/admin/users/${s.studentId}`}
                    className="block px-5 py-3.5 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="text-[14px] font-bold text-ink truncate">
                          {s.firstName} {s.lastName}
                        </div>
                        <div className="text-[12px] text-muted mt-0.5">
                          {s.yearLevel ? `Yr ${s.yearLevel} · ` : ""}
                          {s.pendingHomework} pending homework
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-ink-soft tabular-nums shrink-0">
                        {s.completionPercent}%
                      </span>
                    </div>
                    <ProgressBar
                      percent={s.completionPercent}
                      color={
                        s.completionPercent >= 75
                          ? "bg-mint"
                          : s.completionPercent >= 40
                            ? "bg-sun-500"
                            : "bg-coral"
                      }
                    />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHead title="Recent activity" />
            {activity.length === 0 ? (
              <Empty>No enrolments, payments, or announcements yet.</Empty>
            ) : (
              <div className="divide-y divide-line">
                {activity.map((a, i) => (
                  <Link
                    key={`${a.kind}-${i}`}
                    href={a.href}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <ActivityDot kind={a.kind} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">{a.title}</div>
                      {a.meta && (
                        <div className="text-[12px] text-muted mt-0.5 truncate">
                          {a.meta}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted-2 shrink-0">
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
          className="space-y-5 min-w-0 rise lg:sticky lg:top-[76px] lg:self-start"
          style={{ animationDelay: "120ms" }}
        >
          {/* Announcements */}
          <Card accent="brand">
            <CardHead
              title="Announcements"
              action={
                <Link
                  href="/admin/announcements"
                  className="text-[12px] font-bold text-brand-600 hover:underline"
                >
                  Compose →
                </Link>
              }
            />
            {notices.length === 0 ? (
              <Empty>
                Nothing published yet -{" "}
                <Link
                  className="text-brand-700 font-semibold hover:underline"
                  href="/admin/announcements"
                >
                  send your first
                </Link>
                .
              </Empty>
            ) : (
              <div className="divide-y divide-line">
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className="px-5 py-3.5 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                        <div className="text-[13px] text-ink font-semibold truncate">
                          {n.title}
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-2 shrink-0">
                        {relativeTime(new Date(n.publishedAt))}
                      </div>
                    </div>
                    <div className="mt-1.5 ml-3.5 text-[12px] text-muted">
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

        </aside>
      </div>
    </div>
  );
}

function ActivityDot({ kind }: { kind: "enrolment" | "payment" | "announcement" }) {
  const color =
    kind === "payment"
      ? "bg-mint"
      : kind === "enrolment"
        ? "bg-brand-500"
        : "bg-sun-500";
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${color}`}
      aria-hidden
    />
  );
}
