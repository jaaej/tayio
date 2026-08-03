import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, UserX, CalendarDays, BookOpen } from "lucide-react";
import { Card, StatTile, PageHeader, Empty } from "@/components/parent/ui";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime, relativeTime } from "@/lib/format";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_STYLE,
} from "@/lib/status";
import { getParentClassDetail, resolveSelectedChild } from "../../_data";
import { SectionHeader } from "../../_components/section-header";
import { StatusPill } from "../../_components/status-pill";

const WEEKDAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type SearchParams = Promise<{ child?: string }>;

export default async function ParentClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { classId } = await params;
  const { child } = await searchParams;

  const { selected } = await resolveSelectedChild(user.id, child);
  if (!selected) notFound();

  const detail = await getParentClassDetail(user.id, selected.id, classId);
  if (!detail) notFound();

  const scheduleLabel =
    typeof detail.weekday === "number" && detail.startTime && detail.endTime
      ? `${WEEKDAY[detail.weekday]} · ${formatTime(detail.startTime)}–${formatTime(detail.endTime)}`
      : "No recurring slot";

  const total = detail.attendance.length;
  const present = detail.attendance.filter(
    (r) =>
      r.status === "present" ||
      r.status === "late" ||
      r.status === "makeup_attended",
  ).length;
  const absent = detail.attendance.filter((r) => r.status === "absent").length;
  const rate = total > 0 ? Math.round((present / total) * 100) : null;

  const childQs = `?child=${selected.id}`;

  return (
    <div className="space-y-6">
      <Link
        href={`/parent/classes${childQs}`}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-bold text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← All classes
      </Link>

      <PageHeader
        title={detail.subjectName}
        sub={`${detail.className} · ${scheduleLabel}${
          detail.tutorName ? ` · ${detail.tutorName}` : ""
        }`}
      />

      <div className="rise" style={{ animationDelay: "20ms" }}>
        <Link
          href={`/parent/subjects/${detail.subjectId}${childQs}`}
          className="group flex items-center gap-3 rounded-[14px] border border-line bg-surface px-5 py-4 hover:border-brand-300 hover:bg-brand-50/60 transition-colors"
        >
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-brand-50 text-brand-700 shrink-0">
            <BookOpen className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-ink">
              Curriculum &amp; homework
            </div>
            <div className="text-[12px] text-muted">
              Weekly content, resources, and what&apos;s coming up
            </div>
          </div>
          <span className="text-[13px] font-bold text-brand-700 shrink-0">
            Open →
          </span>
        </Link>
      </div>

      <div className="rise" style={{ animationDelay: "40ms" }}>
        <Card>
          <SectionHeader
            title="Attendance"
            link={{ href: `/parent/feedback${childQs}`, label: "Tutor feedback" }}
          />
          {total === 0 ? (
            <Empty>
              No attendance has been recorded yet for {selected.firstName} in
              this class.
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 lg:p-5">
                <StatTile
                  label="Attendance rate"
                  value={rate !== null ? `${rate}%` : "-"}
                  icon={<ClipboardCheck className="h-5 w-5" />}
                  tone="mint"
                  accent
                  delta="This class"
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
                  delta="This class"
                />
              </div>
              <div className="divide-y divide-line/70 border-t border-line">
                {detail.attendance.map((r) => (
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
                      {r.note && (
                        <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">
                          {r.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="rise" style={{ animationDelay: "60ms" }}>
        <Card>
          <SectionHeader title="Tutor feedback" />
          {detail.feedback.length === 0 ? (
            <Empty>
              No tutor feedback yet for this class. Notes appear here after each
              lesson.
            </Empty>
          ) : (
            <div className="divide-y divide-line/70">
              {detail.feedback.map((f) => (
                <div key={f.id} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-bold text-ink truncate">
                      {f.topicCovered || "Lesson note"}
                    </div>
                    <div className="text-[11px] text-muted shrink-0">
                      {relativeTime(f.createdAt)}
                    </div>
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink-soft leading-relaxed">
                    {f.parentVisibleComment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
