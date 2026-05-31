import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/status-badge";
import { StatTile } from "@/components/data/stat-tile";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/status";
import { getAttendance, resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { SectionHeader } from "../_components/section-header";

type SearchParams = Promise<{ child?: string }>;

export default async function ParentAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const rows = await getAttendance(selected.id);

  const total = rows.length;
  const present = rows.filter(
    (r) => r.status === "present" || r.status === "late" || r.status === "makeup_attended",
  ).length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const rate = total > 0 ? Math.round((present / total) * 100) : null;

  return (
    <div className="space-y-6">
      <Header subtitle={selected.firstName} />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/attendance"
          />
        </div>
      )}

      <section
        className="grid grid-cols-2 lg:grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Attendance rate"
          value={rate !== null ? `${rate}%` : "—"}
          accent={
            rate === null
              ? "muted"
              : rate >= 90
                ? "success"
                : rate >= 75
                  ? "brand"
                  : "warn"
          }
        />
        <StatTile
          label="Absences"
          value={absent.toString()}
          accent={absent === 0 ? "success" : "warn"}
        />
        <StatTile
          label="Lessons logged"
          value={total.toString()}
          accent="brand"
        />
      </section>

      <div className="rise" style={{ animationDelay: "80ms" }}>
        <Card className="p-0 overflow-hidden">
          <SectionHeader
            title="Lesson log"
            link={{ href: "/parent/feedback", label: "Tutor feedback" }}
          />
          {rows.length === 0 ? (
            <div className="px-6 py-8 text-sm text-ink-soft">
              No attendance has been recorded yet for {selected.firstName}.
            </div>
          ) : (
            <div className="divide-y divide-hairline/60">
              {rows.map((r) => (
                <div
                  key={r.lessonId}
                  className="grid grid-cols-12 items-center gap-4 px-6 py-4"
                >
                  <div className="col-span-4 min-w-0">
                    <div className="text-base text-ink">
                      {formatDateLong(r.date)}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {formatTime(r.startTime)}
                    </div>
                  </div>
                  <div className="col-span-3 text-sm text-ink-soft min-w-0 truncate">
                    {r.subjectName ?? "—"}
                  </div>
                  <div className="col-span-2 text-sm text-ink-soft min-w-0 truncate">
                    {r.tutorName}
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-3">
                    {r.note && (
                      <span className="text-xs text-muted truncate max-w-[10rem]">
                        {r.note}
                      </span>
                    )}
                    <StatusBadge
                      label={ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}
                      className={ATTENDANCE_STATUS_STYLE[r.status]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rise">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600" />
        Attendance
      </div>
      <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
        {subtitle ? `${subtitle}'s lessons` : "Attendance"}
      </h1>
    </header>
  );
}
