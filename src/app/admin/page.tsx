import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  Lock,
  Megaphone,
  NotebookPen,
  Plus,
  Wallet,
} from "lucide-react";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import type { TimeGridEvent } from "@/components/data/week-time-grid";
import { Empty, PageHeader, buttonVariants } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth";
import { isUnrestrictedAdmin } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { melbourneGreeting, relativeTime } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { termWeekLabel } from "@/lib/curriculum";
import { addIsoDays } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { weekStartFromParam } from "@/lib/week-nav";
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
import { TodoPanel } from "@/components/dashboard/todo-panel";
import { PersonStatusTable } from "@/components/dashboard/person-status-table";
import { WeekPanel } from "@/components/dashboard/week-panel";

export const dynamic = "force-dynamic";

const TODO_ICON: Record<TodoKind, { icon: React.ReactNode; tone: string }> = {
  attendance: { icon: <ClipboardCheck className="h-4 w-4" />, tone: "bg-warn-bg text-warn" },
  overdue: { icon: <CreditCard className="h-4 w-4" />, tone: "bg-bad-bg text-bad" },
  reschedules: { icon: <CalendarClock className="h-4 w-4" />, tone: "bg-brand-50 text-brand-700" },
  announcements: { icon: <Megaphone className="h-4 w-4" />, tone: "bg-info-bg text-info" },
  checkins: { icon: <Wallet className="h-4 w-4" />, tone: "bg-good-bg text-good" },
  notes: { icon: <NotebookPen className="h-4 w-4" />, tone: "bg-surface-2 text-ink-soft" },
};

const LINE_SM = buttonVariants({ variant: "outline", size: "md" });

function money(n: number) {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
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

  const weekStart = weekStartFromParam(week, todayIso);
  const weekEndExclusive = addIsoDays(weekStart, 7);

  const [todo, revenue, watch, weekLessons, activity, notices, termLabel] =
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
      termWeekLabel(todayIso),
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
  const firstName = (user.user_metadata?.first_name as string | undefined) ?? "Admin";
  const thisMonth = revenue?.[revenue.length - 1];
  const monthName = new Date(`${todayIso}T12:00:00`).toLocaleDateString("en-AU", {
    month: "long",
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${melbourneGreeting(now)}, ${firstName}`}
        sub={`${dateLabel}${termLabel ? ` · ${termLabel}` : ""}`}
        actions={
          <>
            <Link
              href="/admin/announcements#compose"
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              New announcement
            </Link>
            <Link
              href="/admin/users?new=1"
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              Add user
            </Link>
            <Link
              href="/admin/classes?new=1"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              <Plus className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
              New class
            </Link>
          </>
        }
      />

      {/* To do + Revenue */}
      <div className="rise grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ animationDelay: "40ms" }}>
        <TodoPanel
          empty="All clear. Nothing needs your attention right now."
          items={todo.map((item) => ({
            key: item.kind,
            icon: TODO_ICON[item.kind].icon,
            tone: TODO_ICON[item.kind].tone,
            title: item.title,
            detail: item.detail,
            href: item.href,
            action: item.action,
          }))}
        />

        <GlassPanel title="Revenue" meta={revenue ? "Last 6 months" : undefined}>
          {revenue && thisMonth ? (
            <div className="p-4">
              <div className="text-[26px] font-extrabold tabular-nums text-ink">
                {money(thisMonth.total)}
              </div>
              <div className="mb-4 text-[13px] text-muted">
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
              <Link href="/admin/revenue" className={cn(LINE_SM, "mt-1")}>
                Unlock revenue
              </Link>
            </div>
          )}
        </GlassPanel>
      </div>

      {/* This week */}
      <WeekPanel
        className="rise"
        basePath="/admin"
        weekStart={weekStart}
        todayIso={todayIso}
        events={events}
        noun="class"
        calendarHref={`/admin/classes?w=${weekStart}`}
        calendarLabel="Open schedule"
      />

      {/* Students to watch */}
      <GlassPanel
        className="rise"
        title="Students to watch"
        action={
          <Link href="/admin/users?role=student" className="pr-1.5 text-[13px] font-bold text-brand-600 hover:text-brand-700">
            All students
          </Link>
        }
      >
        <PersonStatusTable
          empty="No students with repeated absences or overdue homework."
          phoneAction={false}
          rows={watch.map((s) => ({
            id: s.studentId,
            firstName: s.firstName,
            lastName: s.lastName,
            context: s.className,
            reason: s.reason,
            tone: s.tone,
            href: `/admin/users/${s.studentId}`,
            action: (
              <Link
                href={`/admin/users/${s.studentId}`}
                className="text-[12px] font-bold text-brand-700 hover:underline"
              >
                View student
              </Link>
            ),
          }))}
        />
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
