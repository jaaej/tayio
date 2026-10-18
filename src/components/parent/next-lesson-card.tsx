import Link from "next/link";
import { GlassPanel } from "@/components/admin/ui";
import type { TimetableChip } from "@/app/student/_components/interactive-timetable";
import { formatTimeRange } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";

const weekdayFmt = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" });
const dayMonthFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * The child's next lesson on the parent Overview, from the same timetable
 * source as the Timetable page (`nextAttendingLesson`): a moved or cancelled
 * lesson is never next and a make-up is. "Can't make it?" opens that lesson
 * on the Timetable, where it can be rescheduled or cancelled.
 */
export function NextLessonCard({
  lesson,
  timetableHref,
  cantMakeItHref,
}: {
  lesson: TimetableChip | null;
  timetableHref: string;
  cantMakeItHref: string | null;
}) {
  return (
    <GlassPanel
      title="Next lesson"
      titleId="next-lesson-h"
      action={
        <Link
          href={timetableHref}
          className="rounded-[6px] px-1.5 text-[13px] font-bold text-[#3A1AA8] hover:text-[#21106B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Timetable
        </Link>
      }
    >
      {lesson ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
          <div className="flex min-w-0 flex-[1_1_240px] items-center gap-3.5">
            <span className="flex w-[46px] shrink-0 flex-col items-center leading-[1.1]">
              <span className="text-[11px] font-extrabold uppercase text-muted">
                {weekdayFmt.format(new Date(`${lesson.date}T00:00:00Z`))}
              </span>
              <span className="text-[22px] font-extrabold tabular-nums text-ink">
                {Number(lesson.date.slice(8, 10))}
              </span>
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-extrabold text-ink">
                <span
                  aria-hidden
                  className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                  style={{ backgroundColor: subjectTone(lesson.subjectName, lesson.subjectColor).dot }}
                />
                <span className="truncate">{lesson.subjectName}</span>
              </span>
              <span className="text-[13px] text-ink-soft">
                {[
                  dayMonthFmt.format(new Date(`${lesson.date}T00:00:00Z`)),
                  formatTimeRange(lesson.startTime, lesson.endTime),
                  lesson.location,
                  lesson.tutorName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {lesson.moveLabel && (
                <span className="text-[13px] font-semibold text-ink-soft">{lesson.moveLabel}</span>
              )}
            </span>
          </div>
          {cantMakeItHref && (
            <Link
              href={cantMakeItHref}
              className="inline-flex h-9 shrink-0 items-center rounded-[10px] border border-[#DFE1EC] bg-white px-3.5 text-[13px] font-bold text-ink transition-colors hover:bg-[#F5F6FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Can&apos;t make it?
            </Link>
          )}
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-[13px] text-muted">
          No lessons booked in the next few weeks.
        </p>
      )}
    </GlassPanel>
  );
}
