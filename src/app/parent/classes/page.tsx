import { CalendarDays } from "lucide-react";
import { Card, PageHeader, Empty } from "@/components/parent/ui";
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
import { StatusPill } from "../_components/status-pill";

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
      href: `/parent/homework?child=${selected.id}`,
    }))
    .filter((h) => h.dueDate >= fromIso && h.dueDate < toIso);

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

      <div className="rise" style={{ animationDelay: "40ms" }}>
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
            />
          </div>
        </Card>
      </div>

      <div id="attendance" className="rise scroll-mt-6" style={{ animationDelay: "60ms" }}>
        <Card>
          <SectionHeader
            title="Attendance"
            link={{ href: "/parent/feedback", label: "Tutor feedback" }}
          />
          {attendanceRows.length === 0 ? (
            <Empty>
              No attendance has been recorded yet for {selected.firstName}.
            </Empty>
          ) : (
            <div className="divide-y divide-line/70">
              {attendanceRows.map((r) => {
                const meta = [r.subjectName, r.tutorName]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={r.lessonId}
                    className="flex items-start gap-3 px-5 py-3.5"
                  >
                    <CalendarDays
                      className="h-[18px] w-[18px] text-muted shrink-0 mt-[3px]"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-ink truncate">
                            {formatDateLong(r.date)}
                          </div>
                          <div className="text-[11px] font-semibold text-muted tabular-nums mt-0.5">
                            {formatTime(r.startTime)}
                          </div>
                        </div>
                        <span className="shrink-0">
                          <StatusPill
                            label={ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}
                            className={ATTENDANCE_STATUS_STYLE[r.status]}
                          />
                        </span>
                      </div>
                      <div
                        className="mt-1.5 text-[13px] text-ink-soft truncate"
                        title={meta || undefined}
                      >
                        {meta || "-"}
                      </div>
                      {r.note && (
                        <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">
                          {r.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
