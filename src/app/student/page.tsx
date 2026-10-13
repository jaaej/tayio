import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Clock,
  PlayCircle,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { GlassPanel, PageHeader, buttonVariants } from "@/components/admin/ui";
import { TodoPanel, type TodoItem } from "@/components/dashboard/todo-panel";
import { requireRole } from "@/lib/auth";
import { melbourneGreeting } from "@/lib/format";
import { getStudentDashboard } from "./_lib/dashboard";
import type { StudentTodoKind } from "./_lib/dashboard-rules";
import { SubjectCards } from "./_components/subject-cards";
import { WeekList } from "./_components/week-list";

export const dynamic = "force-dynamic";

const ICON = "h-[18px] w-[18px]";

const TODO_LOOK: Record<StudentTodoKind, { icon: React.ReactNode; tone: string }> = {
  overdue: { icon: <AlertCircle className={ICON} />, tone: "bg-bad-bg text-bad" },
  resubmit: { icon: <RotateCcw className={ICON} />, tone: "bg-warn-bg text-warn" },
  "due-soon": { icon: <Clock className={ICON} />, tone: "bg-warn-bg text-warn" },
  payment: { icon: <Wallet className={ICON} />, tone: "bg-warn-bg text-warn" },
  quiz: { icon: <CircleHelp className={ICON} />, tone: "bg-brand-50 text-brand-700" },
  video: { icon: <PlayCircle className={ICON} />, tone: "bg-info-bg text-info" },
  "due-later": { icon: <ClipboardList className={ICON} />, tone: "bg-surface-3 text-ink-soft" },
  marked: { icon: <CheckCircle2 className={ICON} />, tone: "bg-good-bg text-good" },
};

export default async function StudentDashboard() {
  const user = await requireRole("student");
  const isUnrestricted =
    (user.app_metadata?.role as string | undefined) === "student_unrestricted";
  const now = new Date();
  const dashboard = await getStudentDashboard(user.id, { isUnrestricted, now });

  const firstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "there";
  const dateLabel = new Date(`${dashboard.todayIso}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const todo: TodoItem[] = dashboard.todo.map((row) => ({
    key: row.key,
    icon: TODO_LOOK[row.kind].icon,
    tone: TODO_LOOK[row.kind].tone,
    title: row.title,
    detail: row.detail,
    href: row.href,
    action: row.action,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${melbourneGreeting(now)}, ${firstName}`}
        sub={`${dateLabel}${dashboard.termLabel ? ` · ${dashboard.termLabel}` : ""}`}
        actions={
          dashboard.nextHomework && (
            <Link
              href={dashboard.nextHomework.href}
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              {dashboard.nextHomework.label}
            </Link>
          )
        }
      />

      {/* This week runs the full height beside subjects and To do: the page
          is the student's week, so the week frames everything on it. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <SubjectCards subjects={dashboard.subjects} />
          <TodoPanel
            items={todo}
            count={dashboard.todo.reduce((sum, row) => sum + row.count, 0)}
            empty="All caught up. Nothing is due."
          />
        </div>

        <GlassPanel
          title="This week"
          titleId="student-week-heading"
          action={
            <Link
              href="/student/timetable"
              className="rounded-[8px] px-2 py-1 text-[13px] font-bold text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Timetable
            </Link>
          }
        >
          <WeekList days={dashboard.week} />
        </GlassPanel>
      </div>
    </div>
  );
}
