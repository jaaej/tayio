import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth";
import { getAttendance, resolveSelectedChild, type AttendanceRow } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";

type SearchParams = Promise<{ child?: string }>;

const STATUS_LABEL: Record<AttendanceRow["status"], string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  left_early: "Left early",
  makeup_attended: "Make-up attended",
};

const STATUS_TONE: Record<AttendanceRow["status"], string> = {
  present: "bg-emerald-50 text-emerald-700",
  absent: "bg-rose-50 text-rose-700",
  late: "bg-amber-50 text-amber-700",
  left_early: "bg-amber-50 text-amber-700",
  makeup_attended: "bg-brand-100 text-navy-800",
};

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
      <div className="space-y-12">
        <Header />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const rows = await getAttendance(selected.id);

  return (
    <div className="space-y-10">
      <Header subtitle={selected.firstName} />
      <ChildSwitcher
        children={children}
        selectedId={selected.id}
        basePath="/parent/attendance"
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-ink-soft">
            No attendance has been recorded yet for {selected.firstName}.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-hairline">
            {rows.map((r) => (
              <div
                key={r.lessonId}
                className="grid grid-cols-12 items-baseline gap-4 px-6 py-4"
              >
                <div className="col-span-3 text-sm text-ink">
                  {formatDate(r.date)}
                  <span className="ml-2 text-xs text-muted">
                    {formatTime(r.startTime)}
                  </span>
                </div>
                <div className="col-span-3 text-sm text-ink-soft">
                  {r.subjectName ?? "—"}
                </div>
                <div className="col-span-2 text-sm text-ink-soft">
                  {r.tutorName}
                </div>
                <div className="col-span-2">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_TONE[r.status],
                    )}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-muted truncate">
                  {r.note ?? ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rise">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
        Attendance
      </div>
      <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
        {subtitle ? (
          <>
            <span className="">{subtitle}</span>'s lessons
          </>
        ) : (
          "Attendance"
        )}
      </h1>
    </header>
  );
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(" ", "");
}
