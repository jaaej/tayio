import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Lock,
  Megaphone,
  NotebookPen,
  Plus,
  Wallet,
} from "lucide-react";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import {
  WeekTimeGrid,
  type TimeGridEvent,
} from "@/components/data/week-time-grid";
import { Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth";
import { isUnrestrictedAdmin } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { relativeTime } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { resolveCurrentTerm, currentWeekNumber } from "@/lib/curriculum";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { inclusiveDayCount, melbourneDate } from "@/lib/tutor-cover-rules";
import { getAdminSecurityState } from "./_lib/actions-security";
import {
  getRecentActivity,
  getRecentAnnouncements,
  getWeekLessons,
} from "./_lib/queries";
import {
  getDashboardTodo,
  getMonthlyRevenue,
  getStudentsToWatch,
  type TodoKind,
} from "./_lib/dashboard-queries";
import { RevenueBars } from "./_components/revenue-bars";

export const dynamic = "force-dynamic";

const TODO_ICON: Record<TodoKind, { icon: React.ReactNode; tone: string }> = {
  attendance: { icon: <ClipboardCheck className="h-4 w-4" />, tone: "bg-warn-bg text-warn" },
  overdue: { icon: <CreditCard className="h-4 w-4" />, tone: "bg-bad-bg text-bad" },
  reschedules: { icon: <CalendarClock className="h-4 w-4" />, tone: "bg-brand-50 text-brand-700" },
  announcements: { icon: <Megaphone className="h-4 w-4" />, tone: "bg-info-bg text-info" },
  checkins: { icon: <Wallet className="h-4 w-4" />, tone: "bg-good-bg text-good" },
  notes: { icon: <NotebookPen className="h-4 w-4" />, tone: "bg-surface-2 text-ink-soft" },
};

const BUTTON =
  "inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink shadow-[0_1px_2px_rgba(15,17,30,0.05)] transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function money(n: number) {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

function weekLabel(weekStart: string) {
  const end = addIsoDays(weekStart, 6);
  const fmt = (iso: string, withMonth: boolean) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
      day: "numeric",
      ...(withMonth ? { month: "short" } : {}),
    });
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  return `${fmt(weekStart, !sameMonth)} – ${fmt(end, true)}`;
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireRole("admin");
  const { week } = await searchParams;
  const now = new Date();
  const todayIso = melbourneDate(now);

  const isOwner = isUnrestrictedAdmin(
    user.app_metadata?.role as UserRole | undefined,
  );
  // Same rule as the revenue page: reception sees money only after the PIN.
  const { unlocked } = await getAdminSecurityState();
  const showMoney = isOwner || unlocked;

  let weekStart = weekStartForIsoDate(todayIso);
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
    try {
      weekStart = weekStartForIsoDate(week);
    } catch {
      /* invalid date: stay on this week */
    }
  }
  const weekEndExclusive = addIsoDays(weekStart, 7);

  const [todo, revenue, watch, weekLessons, activity, notices, term] =
    await Promise.all([
      getDashboardTodo(now, { showMoney, isOwner }),
      showMoney ? getMonthlyRevenue(now) : Promise.resolve(null),
      getStudentsToWatch(5),
      getWeekLessons(
        new Date(`${weekStart}T00:00:00`),
        new Date(`${weekEndExclusive}T00:00:00`),
      ),
      getRecentActivity(6),
      getRecentAnnouncements(4),
      resolveCurrentTerm(new Date(`${todayIso}T12:00:00`)),
    ]);

  const lessons = weekLessons.filter((l) => l.status !== "cancelled");
  const events: TimeGridEvent[] = lessons.map((l) => ({
    id: l.id,
    date: l.date,
    startTime: l.startTime,
    endTime: l.endTime,
    // The block is narrow: subject only, full class name in the tooltip.
    label: l.subjectName,
    title: classDisplayName(l.subjectName, l.className),
    subject: l.subjectName,
    href: `/admin/attendance/${l.id}`,
  }));

  const dateLabel = new Date(`${todayIso}T12:00:00`).toLocaleDateString(
    "en-AU",
    { weekday: "long", day: "numeric", month: "long" },
  );
  const termLabel = term
    ? `Term ${term.termNumber}, Week ${currentWeekNumber(
        term,
        Math.ceil(inclusiveDayCount(term.startDate, term.endDate) / 7),
        new Date(`${todayIso}T12:00:00`),
      )}`
    : null;
  const firstName = (user.user_metadata?.first_name as string | undefined) ?? "Admin";
  const thisMonth = revenue?.[revenue.length - 1];
  const monthName = new Date(`${todayIso}T12:00:00`).toLocaleDateString("en-AU", {
    month: "long",
  });

  return (
    <div className="space-y-5">
      {/* Greeting + quick actions */}
      <header className="glass-frame rise flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[22px] px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">
            {greeting(now)}, {firstName}
          </h1>
          <p className="mt-0.5 text-[13px] font-semibold text-ink-soft">
            {dateLabel}
            {termLabel ? ` · ${termLabel}` : ""}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/admin/announcements#compose" className={BUTTON}>
            New announcement
          </Link>
          <Link href="/admin/users?new=1" className={BUTTON}>
            Add user
          </Link>
          <Link
            href="/admin/classes?new=1"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-ink px-4 text-[13px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(14,17,22,0.6)] transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New class
          </Link>
        </div>
      </header>

      {/* To do + Revenue */}
      <div className="rise grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ animationDelay: "40ms" }}>
        <GlassPanel
          title={
            <span className="inline-flex items-center gap-2">
              To do
              {todo.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-extrabold tabular-nums text-white">
                  {todo.length}
                </span>
              )}
            </span>
          }
        >
          {todo.length === 0 ? (
            <Empty>All clear. Nothing needs your attention right now.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {todo.map((item) => (
                <li key={item.kind} className="flex items-center gap-3.5 px-4 py-3">
                  <span
                    aria-hidden
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${TODO_ICON[item.kind].tone}`}
                  >
                    {TODO_ICON[item.kind].icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-ink">{item.title}</div>
                    <div className="text-[12px] text-ink-soft">{item.detail}</div>
                  </div>
                  <Link href={item.href} className={cn(BUTTON, "min-h-9 shrink-0 px-3 text-[12px]")}>
                    {item.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel title="Revenue" meta={revenue ? "Last 6 months" : undefined}>
          {revenue && thisMonth ? (
            <div className="p-4">
              <div className="text-[28px] font-extrabold tabular-nums tracking-[-0.02em] text-ink">
                {money(thisMonth.total)}
              </div>
              <div className="mb-4 text-[12px] font-semibold text-ink-soft">
                {monthName} so far
              </div>
              <RevenueBars months={revenue} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-start gap-2 p-5">
              <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                <Lock className="h-4 w-4 text-muted" aria-hidden />
                Revenue is locked
              </div>
              <p className="text-[12px] text-ink-soft">
                Enter the admin PIN on the Revenue page to see figures.
              </p>
              <Link href="/admin/revenue" className={cn(BUTTON, "mt-1")}>
                Unlock revenue
              </Link>
            </div>
          )}
        </GlassPanel>
      </div>

      {/* This week */}
      <GlassPanel
        className="rise"
        title="This week"
        meta={`${weekLabel(weekStart)} · ${lessons.length} ${lessons.length === 1 ? "class" : "classes"}`}
        action={
          <>
            <Link
              href={`/admin?week=${addIsoDays(weekStart, -7)}`}
              aria-label="Previous week"
              className={cn(BUTTON, "min-h-9 w-9 justify-center px-0")}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
            </Link>
            <Link
              href={`/admin?week=${addIsoDays(weekStart, 7)}`}
              aria-label="Next week"
              className={cn(BUTTON, "min-h-9 w-9 justify-center px-0")}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
            </Link>
            <Link
              href={`/admin/classes?w=${weekStart}`}
              className={cn(BUTTON, "min-h-9 px-3 text-[12px] text-brand-700")}
            >
              Open schedule
            </Link>
          </>
        }
      >
        <WeekTimeGrid events={events} weekStart={weekStart} todayIso={todayIso} />
      </GlassPanel>

      {/* Students to watch */}
      <GlassPanel
        className="rise"
        title="Students to watch"
        action={
          <Link href="/admin/users?role=student" className="text-[12px] font-bold text-brand-700 hover:underline">
            All students
          </Link>
        }
      >
        {watch.length === 0 ? (
          <Empty>No students with repeated absences or overdue homework.</Empty>
        ) : (
          <>
          {/* Phones: one stacked row per student so the reason stays visible. */}
          <ul className="divide-y divide-line sm:hidden">
            {watch.map((s) => (
              <li key={s.studentId}>
                <Link
                  href={`/admin/users/${s.studentId}`}
                  className="block px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <div className="text-[13px] font-bold text-ink">
                    {s.firstName} {s.lastName}
                  </div>
                  {s.className && (
                    <div className="text-[12px] text-ink-soft">{s.className}</div>
                  )}
                  <span
                    className={`mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      s.tone === "bad" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn"
                    }`}
                  >
                    {s.reason}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold text-muted">
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Why</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {watch.map((s) => (
                  <tr key={s.studentId}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-extrabold text-ink"
                        >
                          {s.firstName.charAt(0)}
                          {s.lastName.charAt(0)}
                        </span>
                        <span className="text-[13px] font-bold text-ink">
                          {s.firstName} {s.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink-soft">
                      {s.className ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          s.tone === "bad" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn"
                        }`}
                      >
                        {s.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${s.studentId}`}
                        className="text-[12px] font-bold text-brand-700 hover:underline"
                      >
                        View student
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </GlassPanel>

      {/* Announcements + Recent activity */}
      <div className="rise grid gap-5 lg:grid-cols-2">
        <GlassPanel
          title="Announcements"
          action={
            <Link href="/admin/announcements#compose" className="text-[12px] font-bold text-brand-700 hover:underline">
              Compose
            </Link>
          }
        >
          {notices.length === 0 ? (
            <Empty>No announcements yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {notices.map((n) => (
                <li key={n.id} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
                    {n.title}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-muted">
                    {relativeTime(n.publishedAt, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel title="Recent activity">
          {activity.length === 0 ? (
            <Empty>No recent activity.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((a, i) => (
                <li key={`${a.kind}-${i}`}>
                  <Link
                    href={a.href}
                    className="flex items-baseline gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-ink">
                        {a.title}
                      </span>
                      {/* Payment lines carry the amount: hidden until PIN unlock. */}
                      {a.meta && (a.kind !== "payment" || showMoney) && (
                        <span className="block truncate text-[12px] text-ink-soft">
                          {a.meta}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-muted">
                      {relativeTime(a.at, now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
