import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/data/stat-tile";
import { requireRole } from "@/lib/auth";
import {
  getMonthLessons,
  getRescheduleLessonForParent,
  resolveSelectedChild,
} from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import {
  MonthCalendar,
  monthBounds,
  parseMonthParam,
} from "../_components/month-calendar";
import { ReschedulePanel } from "../_components/reschedule-panel";
import { SectionHeader } from "../_components/section-header";

type SearchParams = Promise<{
  child?: string;
  month?: string;
  reschedule?: string;
  submitted?: string;
  error?: string;
}>;

export default async function ParentBookingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const params = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, params.child);

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const { year, month } = parseMonthParam(params.month);
  const monthIso = `${year}-${String(month + 1).padStart(2, "0")}`;
  const { fromIso, toIso } = monthBounds(year, month);

  const monthLessons = await getMonthLessons(selected.id, fromIso, toIso);

  const upcomingThisMonth = monthLessons.filter(
    (l) =>
      l.date >= isoLocalToday() &&
      (l.status === "upcoming" || l.status === "rescheduled"),
  );
  const rescheduledCount = monthLessons.filter(
    (l) => l.status === "rescheduled" || l.status === "makeup",
  ).length;

  const rescheduleLesson = params.reschedule
    ? await getRescheduleLessonForParent(user.id, params.reschedule)
    : null;

  return (
    <div className="space-y-6">
      <Header subtitle={selected.firstName} />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/bookings"
          />
        </div>
      )}

      {params.submitted === "1" && (
        <Card className="rise border-emerald-200/70 bg-emerald-50">
          <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-800">
            Request submitted
          </div>
          <p className="mt-1 text-sm text-emerald-900">
            Your reschedule request has been sent to the admin team. They'll be
            in touch to confirm a new time.
          </p>
        </Card>
      )}

      {params.error === "1" && (
        <Card className="rise border-rose-200/70 bg-rose-50">
          <div className="text-[11px] uppercase tracking-[0.16em] text-rose-800">
            Couldn't submit request
          </div>
          <p className="mt-1 text-sm text-rose-900">
            Please add a reason of at least 5 characters and try again.
          </p>
        </Card>
      )}

      <section
        className="grid grid-cols-2 lg:grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Lessons this month"
          value={monthLessons.length.toString()}
          sub={monthLessons.length === 0 ? "Quiet month" : "Scheduled"}
          accent="brand"
        />
        <StatTile
          label="Upcoming"
          value={upcomingThisMonth.length.toString()}
          sub={upcomingThisMonth.length === 0 ? "Nothing left" : "Yet to come"}
          accent="brand"
        />
        <StatTile
          label="Rescheduled"
          value={rescheduledCount.toString()}
          sub={rescheduledCount === 0 ? "None moved" : "Includes make-ups"}
          accent={rescheduledCount === 0 ? "success" : "warn"}
        />
      </section>

      <Card
        className="p-0 overflow-hidden rise"
        style={{ animationDelay: "80ms" }}
      >
        <SectionHeader
          title={`${selected.firstName}'s schedule`}
          description="Click a lesson to request a reschedule."
        />
        <div className="p-5 bg-gradient-to-b from-brand-50/30 to-transparent">
          <MonthCalendar
            year={year}
            month={month}
            lessons={monthLessons}
            basePath="/parent/bookings"
            childId={selected.id}
          />
        </div>
      </Card>

      {rescheduleLesson && (
        <ReschedulePanel
          lesson={rescheduleLesson}
          childId={selected.id}
          monthIso={monthIso}
          basePath="/parent/bookings"
        />
      )}
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rise">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600" />
        Bookings
      </div>
      <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
        {subtitle ? `${subtitle}'s schedule` : "Bookings"}
      </h1>
    </header>
  );
}

function isoLocalToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
