import Link from "next/link";
import { Play } from "lucide-react";
import { Empty } from "@/components/admin/ui";
import { formatWeekday, melbourneDayKey, parseLessonDate } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { subjectTone } from "@/lib/subject-tone";
import { getStudentLessonsWithNotes } from "../../_lib/queries";

/** The student's past lessons, newest first, each linking to its recap. */
export async function RecordedLessons({ studentId }: { studentId: string }) {
  const lessons = await getStudentLessonsWithNotes(studentId, {
    until: melbourneDayKey(new Date()),
  });

  return (
    <section
      aria-labelledby="rl-h"
      className="glass flex flex-col rounded-[24px] p-1.5 lg:sticky lg:top-[var(--portal-sticky-top)] lg:max-h-[var(--portal-fill-h)]"
    >
      <div className="flex items-center justify-between pb-2.5 pl-3 pr-2 pt-2">
        <h2 id="rl-h" className="text-[16px] font-extrabold text-ink">
          Recorded lessons
        </h2>
        <span className="text-[13px] font-semibold text-ink-soft">{lessons.length} total</span>
      </div>
      <div className="panel scroll-fade flex min-h-0 flex-col gap-0.5 p-1.5 lg:overflow-y-auto">
        {lessons.length === 0 ? (
          <Empty>No lessons yet.</Empty>
        ) : (
          lessons.map((l) => {
            const cancelled = l.status === "cancelled";
            const ready = l.hasNote && !cancelled;
            return (
              <Link
                key={l.lessonId}
                href={`/student/resources/${l.lessonId}`}
                className="flex items-center gap-3 rounded-[12px] p-2.5 text-ink transition-colors hover:bg-[#F6F7FA] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <span className="flex w-[42px] flex-none flex-col items-center leading-[1.1]">
                  <span className="text-[10px] font-extrabold uppercase text-muted">
                    {formatWeekday(l.date, "short")}
                  </span>
                  <span className="text-[17px] font-extrabold">
                    {parseLessonDate(l.date).getDate()}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: subjectTone(l.subjectName).dot }}
                    />
                    <span className="truncate">{classDisplayName(l.subjectName, l.className)}</span>
                  </span>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: ready ? "#15803D" : "#5E5A73" }}
                  >
                    {cancelled ? "Cancelled" : ready ? "Recap ready" : "No recap yet"}
                  </span>
                </span>
                {l.recordingUrl && (
                  <span
                    aria-label="Has a recording"
                    className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-ink text-white"
                  >
                    <Play className="h-[11px] w-[11px] fill-current" aria-hidden />
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
