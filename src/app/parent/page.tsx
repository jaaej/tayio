import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  getDashboardData,
  getOutstandingBalanceForParent,
  resolveSelectedChild,
} from "./_data";
import { ChildSwitcher, EmptyChildrenNotice } from "./_components/child-switcher";

type SearchParams = Promise<{ child?: string }>;

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  if (!selected) {
    return (
      <div className="space-y-12">
        <header className="rise">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Family overview
          </div>
          <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
            Welcome.
          </h1>
        </header>
        <EmptyChildrenNotice />
      </div>
    );
  }

  const [data, outstanding] = await Promise.all([
    getDashboardData(selected.id),
    getOutstandingBalanceForParent(user.id),
  ]);

  return (
    <div className="space-y-12">
      <header className="rise space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
            Family overview
          </div>
          <h1 className="mt-2 text-5xl lg:text-6xl font-light tracking-tight text-ink">
            How <span className="">{selected.firstName}</span>{" "}
            is going.
          </h1>
        </div>
        <ChildSwitcher
          children={children}
          selectedId={selected.id}
          basePath="/parent"
        />
      </header>

      <section className="grid lg:grid-cols-4 gap-5 rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardLabel>Attendance</CardLabel>
          <CardTitle>
            {data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"}
          </CardTitle>
          <div className="mt-4 text-xs text-muted">
            {data.attendanceCount > 0
              ? `Across ${data.attendanceCount} lesson${data.attendanceCount === 1 ? "" : "s"}`
              : "No attendance recorded yet"}
          </div>
        </Card>
        <Card>
          <CardLabel>Homework</CardLabel>
          <CardTitle>
            {data.homeworkTotal > 0
              ? `${data.homeworkCompleted} / ${data.homeworkTotal}`
              : "—"}
          </CardTitle>
          <div className="mt-4 text-xs text-muted">
            {data.homeworkTotal > 0
              ? "Completed or marked"
              : "No homework assigned yet"}
          </div>
        </Card>
        <Card>
          <CardLabel>Next lesson</CardLabel>
          <CardTitle>
            {data.nextLesson
              ? formatLessonDate(data.nextLesson.date, data.nextLesson.startTime)
              : "None scheduled"}
          </CardTitle>
          <div className="mt-4 text-xs text-muted">
            {data.nextLesson
              ? `${data.nextLesson.subjectName} · ${data.nextLesson.tutorName}`
              : "Awaiting timetable"}
          </div>
        </Card>
        <Card>
          <CardLabel>Balance</CardLabel>
          <CardTitle>${outstanding.toFixed(2)}</CardTitle>
          <div className="mt-4 text-xs text-muted">
            {outstanding > 0 ? "Outstanding" : "All paid up"}
          </div>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "160ms" }}>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-4">
          {data.latestFeedback
            ? `Latest from ${data.latestFeedback.tutorName}`
            : "Tutor feedback"}
        </div>
        <Card>
          {data.latestFeedback ? (
            <>
              <p className="text-2xl text-ink leading-snug">
                {`"${data.latestFeedback.parentVisibleComment}"`}
              </p>
              <div className="mt-6 text-xs text-muted">
                {formatRelativeShort(data.latestFeedback.createdAt)}
                {data.latestFeedback.subjectName
                  ? ` · ${data.latestFeedback.subjectName}`
                  : null}
              </div>
            </>
          ) : (
            <p className="text-ink-soft">
              No tutor feedback yet. After {selected.firstName}'s next lesson the
              tutor's note will appear here.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}

function formatLessonDate(date: string, startTime: string) {
  const d = new Date(`${date}T${startTime}`);
  if (Number.isNaN(d.getTime())) return date;
  const dayName = d.toLocaleDateString(undefined, { weekday: "long" });
  const time = d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(" ", "");
  return `${dayName} ${time}`;
}

function formatRelativeShort(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const hours = Math.round(diffMs / 36e5);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}
