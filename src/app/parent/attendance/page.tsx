import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/status";
import { getAttendance, resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { PageHeader } from "../_components/page-header";
import { Kpi } from "../_components/kpi";
import { StatusPill } from "../_components/status-pill";
import { Table, Th, Td, Tr } from "../_components/table";

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
        <PageHeader title="Attendance" sub="Your child's lesson attendance." />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const rows = await getAttendance(selected.id);

  const total = rows.length;
  const present = rows.filter(
    (r) =>
      r.status === "present" ||
      r.status === "late" ||
      r.status === "makeup_attended",
  ).length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const rate = total > 0 ? Math.round((present / total) * 100) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${selected.firstName}'s attendance`}
        sub="Every logged lesson and how it was marked."
      />

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
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <Kpi
          label="Attendance rate"
          value={rate !== null ? `${rate}%` : "—"}
          sub="All logged lessons"
          delta={
            rate === null ? "flat" : rate >= 90 ? "up" : rate < 75 ? "down" : "flat"
          }
        />
        <Kpi
          label="Absences"
          value={absent.toString()}
          sub="Marked absent"
          delta={absent === 0 ? "up" : "down"}
        />
        <Kpi label="Lessons logged" value={total.toString()} sub="This term" />
      </section>

      <div className="rise" style={{ animationDelay: "80ms" }}>
        <Card className="p-0 overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-6 py-8 text-sm text-ink-soft">
              No attendance has been recorded yet for {selected.firstName}.
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Subject</Th>
                  <Th>Tutor</Th>
                  <Th>Note</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.lessonId}>
                    <Td>
                      <div className="font-bold text-ink whitespace-nowrap">
                        {formatDateLong(r.date)}
                      </div>
                      <div className="text-xs text-muted">
                        {formatTime(r.startTime)}
                      </div>
                    </Td>
                    <Td className="text-ink-soft">{r.subjectName ?? "—"}</Td>
                    <Td className="text-ink-soft">{r.tutorName}</Td>
                    <Td className="text-muted max-w-[14rem] truncate">
                      {r.note || "—"}
                    </Td>
                    <Td>
                      <StatusPill
                        label={ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}
                        className={ATTENDANCE_STATUS_STYLE[r.status]}
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
