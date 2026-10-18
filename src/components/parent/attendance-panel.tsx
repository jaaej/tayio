import { GlassPanel, MetricTile, Pill, type PillTone } from "@/components/admin/ui";
import { attendanceLabel, attendanceSummary, isMovedAbsence } from "@/lib/attendance-rules";
import { formatDateLong, formatTime } from "@/lib/format";

export type AttendanceListRow = {
  lessonId: string;
  date: string;
  startTime: string;
  subjectName: string | null;
  tutorName: string;
  status: string;
  moved: boolean;
};

const TONE: Record<string, PillTone> = {
  present: "good",
  late: "warn",
  left_early: "warn",
  absent: "bad",
  makeup_attended: "info",
};

/**
 * A child's marked lessons with the rate on top, from the one attendance
 * rule (`attendanceSummary`): a lesson moved or credited reads "Moved" and
 * is left out of the rate. Used for every class on the Timetable and for
 * one subject on its page.
 */
export function AttendancePanel({
  id,
  rows,
  childFirstName,
  showSubject = true,
  titled = true,
}: {
  id?: string;
  /** Off where a tab already names the section. */
  titled?: boolean;
  rows: AttendanceListRow[];
  childFirstName: string;
  /** Hide the subject on a subject's own page. */
  showSubject?: boolean;
}) {
  const summary = attendanceSummary(rows);
  return (
    <GlassPanel
      id={id}
      title={titled ? "Attendance" : undefined}
      titleId={id ? `${id}-h` : "attendance-h"}
      bodyClassName="bg-transparent shadow-none"
    >
      {rows.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-[13px] text-muted">
          No attendance has been recorded for {childFirstName} yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            <MetricTile
              label="Attendance"
              value={summary.percent === null ? "-" : `${summary.percent}%`}
              tone={summary.percent !== null && summary.percent < 75 ? "bad" : "default"}
            />
            <MetricTile
              label="Absences"
              value={summary.absent}
              tone={summary.absent > 0 ? "bad" : "default"}
            />
            <MetricTile label="Lessons" value={summary.total} />
          </div>
          <ul className="panel divide-y divide-line overflow-hidden">
            {rows.map((r) => (
              <li key={r.lessonId} className="flex items-center gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-ink">
                    {formatDateLong(r.date)}
                    <span className="font-semibold text-muted"> · {formatTime(r.startTime)}</span>
                  </span>
                  <span className="truncate text-[12px] text-muted">
                    {[showSubject ? r.subjectName : null, r.tutorName].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Pill tone={isMovedAbsence(r) ? "default" : (TONE[r.status] ?? "default")}>
                  {attendanceLabel(r)}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassPanel>
  );
}
