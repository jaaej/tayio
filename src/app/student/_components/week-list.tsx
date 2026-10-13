import Link from "next/link";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import type { WeekDay } from "../_lib/dashboard-rules";

/**
 * Monday to Sunday as rows: each day's lessons in their subject colour and
 * any homework due that day. Today is marked by a pale tint and the ink date
 * disc, so the subject colours stay the only strong colour in the list.
 * Finished lessons turn neutral so the next one stands out.
 */
export function WeekList({ days }: { days: WeekDay[] }) {
  return (
    <ol className="divide-y divide-line">
      {days.map((day) => (
        <li
          key={day.iso}
          aria-current={day.isToday ? "date" : undefined}
          className={cn(
            "flex min-h-[60px] items-center gap-3.5 px-4 py-2.5",
            day.isToday && "bg-brand-50",
          )}
        >
          <div className="flex w-10 shrink-0 flex-col items-center leading-none">
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-[0.06em]",
                day.isToday ? "text-ink" : "text-ink-soft",
              )}
            >
              {day.isToday ? "Today" : day.weekday}
            </span>
            <span
              className={cn(
                "mt-1 grid h-7 min-w-7 place-items-center rounded-full px-1 text-[16px] font-extrabold tabular-nums",
                day.isToday ? "bg-ink text-white" : day.isPast ? "text-muted" : "text-ink",
              )}
            >
              {day.dayNumber}
            </span>
          </div>

          {day.lessons.length + day.due.length > 0 && (
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {day.lessons.map((lesson) => {
                const tone = subjectTone(lesson.subjectName);
                return (
                  <span
                    key={lesson.id}
                    title={lesson.subjectName}
                    style={
                      lesson.live
                        ? { backgroundColor: tone.solid }
                        : lesson.past
                          ? undefined
                          : { backgroundColor: tone.bg, color: tone.fg }
                    }
                    className={cn(
                      "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold",
                      lesson.live && "text-white",
                      // Neutral rather than faded, so the text keeps its contrast.
                      lesson.past && "bg-surface-3 text-muted",
                    )}
                  >
                    {lesson.live && (
                      <span aria-hidden className="relative grid h-2 w-2 place-items-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                    )}
                    <span className="truncate">{lesson.label}</span>
                  </span>
                );
              })}
              {day.due.map((item) => (
                <Link
                  key={item.homeworkId}
                  href={`/student/homework/${item.homeworkId}`}
                  title={item.title}
                  className="inline-flex h-7 max-w-full items-center rounded-full bg-warn-bg px-2.5 text-[12px] font-bold text-warn transition-colors hover:bg-[#fbe6c6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <span className="truncate">Due: {item.title}</span>
                </Link>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
