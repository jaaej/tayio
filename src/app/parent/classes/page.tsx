import { ClipboardCheck, UserX, CalendarDays } from "lucide-react";
import { Card, StatTile, PageHeader, Empty } from "@/components/parent/ui";
import { StatusBadge } from "@/components/data/status-badge";
import { InteractiveTimetable } from "@/app/student/_components/interactive-timetable";
import { buildTimetableChips } from "@/app/_lib/timetable-chips";
import { getStudentHomework } from "@/app/student/_lib/queries";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { listRedeemableCredits } from "@/lib/credits";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/status";
import { getAdminContact, getAttendance, resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { parseMonthParam } from "../_components/month-calendar";
import { SectionHeader } from "../_components/section-header";

type SearchParams = Promise<{
  child?: string;
  month?: string;
}>;

function isoLocal(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function ParentClassesPage({
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
        <PageHeader
          title="Classes"
          sub="Your children's lessons and reschedule requests."
        />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const { year, month } = parseMonthParam(params.month);
  // The interactive timetable manages the month client-side, so load a wide
  // window of data - same window as the student's own timetable.
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month + 3, 1);

  const [chips, homeworkRows, attendanceRows, credits, admin] = await Promise.all([
    buildTimetableChips(selected.id, from, to),
    getStudentHomework(selected.id),
    getAttendance(selected.id),
    listRedeemableCredits(selected.id),
    getAdminContact(),
  ]);

  const fromIso = isoLocal(from);
  const toIso = isoLocal(to);
  const hw = homeworkRows
    .map((h) => ({
      id: h.homeworkId,
      dueDate: isoLocal(h.dueDate),
      title: h.title,
      done: h.status === "submitted" || h.status === "marked",
    }))
    .filter((h) => h.dueDate >= fromIso && h.dueDate < toIso);

  const total = attendanceRows.length;
  const present = attendanceRows.filter(
    (r) =>
      r.status === "present" ||
      r.status === "late" ||
      r.status === "makeup_attended",
  ).length;
  const absent = attendanceRows.filter((r) => r.status === "absent").length;
  const rate = total > 0 ? Math.round((present / total) * 100) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${selected.firstName}'s classes`}
        sub="Calendar, attendance log and reschedule requests."
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/classes"
          />
        </div>
      )}

      <section
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Attendance rate"
          value={rate !== null ? `${rate}%` : "-"}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="mint"
          accent
          delta="All logged lessons"
          deltaTone={
            rate === null ? "flat" : rate >= 90 ? "up" : rate < 75 ? "down" : "flat"
          }
        />
        <StatTile
          label="Absences"
          value={absent.toString()}
          icon={<UserX className="h-5 w-5" />}
          tone={absent === 0 ? "good" : "coral"}
          accent
          delta="Marked absent"
          deltaTone={absent === 0 ? "up" : "down"}
        />
        <StatTile
          label="Lessons logged"
          value={total.toString()}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="sky"
          accent
          delta="This term"
        />
      </section>

      <div className="rise" style={{ animationDelay: "60ms" }}>
        <Card>
          <SectionHeader
            title={`${selected.firstName}'s schedule`}
            description="Click a lesson to open it, then choose Go to subject, Reschedule, or Cancel."
          />
          <div className="p-4 lg:p-5">
            <InteractiveTimetable
              key={selected.id}
              initialYear={year}
              initialMonth={month}
              lessons={chips}
              homework={hw}
              credits={credits}
              adminId={admin?.id ?? null}
              studentId={selected.id}
              subjectBase="/parent/subjects"
              subjectQuery={`?child=${selected.id}`}
              messageBase="/parent/messages/with"
              homeworkHref={() => `/parent/homework?child=${selected.id}`}
            />
          </div>
        </Card>
      </div>

      <div className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <SectionHeader
            title="Lesson Log"
            link={{ href: "/parent/feedback", label: "Tutor feedback" }}
          />
          {attendanceRows.length === 0 ? (
            <Empty>
              No attendance has been recorded yet for {selected.firstName}.
            </Empty>
          ) : (
            <div className="divide-y divide-line/70">
              {attendanceRows.map((r) => (
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
                    {r.subjectName ?? "-"}
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
