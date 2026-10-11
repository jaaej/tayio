import Link from "next/link";
import { Empty, SegmentedLinks, SubjectDot } from "@/components/admin/ui";
import { classDisplayName } from "@/lib/class-display";
import { formatDateLong, formatTime, formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceQueue as QueueData, QueueItem } from "../_lib/queue";
import {
  QUEUE_VIEWS,
  QUEUE_VIEW_LABEL,
  queueQueryString,
} from "../_lib/queue-logic";
import { DayPicker } from "./day-picker";

const EMPTY_TEXT = {
  to_mark: { day: "Nothing to mark on this day.", range: "Every lesson is marked." },
  marked: { day: "No marked lessons on this day.", range: "No marked lessons in this period." },
  upcoming: { day: "No upcoming lessons on this day.", range: "No upcoming lessons." },
} as const;

function stateLabel(item: QueueItem, today: string) {
  switch (item.state) {
    case "to_mark":
      return { text: `${item.unmarkedCount} to mark`, tone: "text-warn" };
    case "marked":
      return { text: "Done", tone: "text-good" };
    case "cancelled":
      return { text: "Cancelled", tone: "text-muted" };
    case "upcoming":
      return item.date === today ? { text: "Today", tone: "text-ink-soft" } : null;
  }
}

/**
 * The lesson queue: one implementation shared by the queue page and every
 * lesson page, so the list, its tabs and its day filter never drift apart.
 * `basePath` is the route the tab links stay on (the queue, or the lesson
 * that is open beside it).
 */
export function AttendanceQueue({
  queue,
  basePath,
  currentLessonId,
  headingLevel = "h1",
  className,
}: {
  queue: QueueData;
  basePath: string;
  currentLessonId?: string;
  headingLevel?: "h1" | "h2";
  className?: string;
}) {
  const { filters, items, counts, today } = queue;
  const Heading = headingLevel;
  const query = queueQueryString(filters);

  return (
    <section
      aria-labelledby="attendance-queue-heading"
      className={cn(
        "glass flex min-w-0 flex-col rounded-[24px] p-1.5",
        "xl:sticky xl:top-[var(--portal-sticky-top)] xl:max-h-[calc(100dvh-var(--portal-sticky-top)-20px)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 px-2 pb-2.5 pt-2 sm:pl-3">
        <Heading
          id="attendance-queue-heading"
          className="text-[20px] font-extrabold leading-tight text-ink"
        >
          Attendance
        </Heading>
        <SegmentedLinks
          label="Show lessons"
          stretch
          items={QUEUE_VIEWS.map((view) => ({
            label: QUEUE_VIEW_LABEL[view],
            count: counts[view],
            active: filters.view === view,
            href: `${basePath}${queueQueryString({ ...filters, view })}`,
          }))}
        />
        <DayPicker />
      </div>

      <div className="panel min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.length === 0 ? (
          <Empty>{EMPTY_TEXT[filters.view][filters.date ? "day" : "range"]}</Empty>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const current = item.id === currentLessonId;
              const label = stateLabel(item, today);
              return (
                <li key={item.id}>
                  <Link
                    href={`/admin/attendance/${item.id}${query}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-[12px] p-2.5 text-ink transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
                      current ? "bg-surface-3" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="flex w-[46px] shrink-0 flex-col items-center leading-[1.1]">
                      <span className="sr-only">{formatDateLong(item.date)}</span>
                      <span aria-hidden className="text-[11px] font-extrabold uppercase text-muted">
                        {formatWeekday(item.date, "short")}
                      </span>
                      <span aria-hidden className="text-[18px] font-extrabold tabular-nums">
                        {Number(item.date.slice(8))}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold">
                        <SubjectDot subject={item.subjectName} className="h-2 w-2" />
                        <span className="truncate">
                          {classDisplayName(item.subjectName, item.className)}
                        </span>
                      </span>
                      <span className="truncate text-[12px] text-muted">
                        {formatTime(item.startTime)} · {item.tutorName}
                      </span>
                    </span>
                    {label && (
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-extrabold uppercase",
                          label.tone,
                        )}
                      >
                        {label.text}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
