import { Fragment } from "react";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import {
  Empty,
  ListPane,
  SegmentedLinks,
  SubjectDot,
  buttonVariants,
} from "@/components/admin/ui";
import { classDisplayName } from "@/lib/class-display";
import { formatDateLong, formatDateShort, formatTime, formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceQueue as QueueData, QueueItem } from "../_lib/queue";
import {
  QUEUE_VIEWS,
  QUEUE_VIEW_LABEL,
  groupByTutor,
  queueQueryString,
  type QueueView,
} from "../_lib/queue-logic";
import { DayPicker } from "./day-picker";

const EMPTY_TEXT = {
  to_mark: { day: "Nothing to mark on this day.", range: "Every lesson is marked." },
  notes: { day: "No notes missing on this day.", range: "Every lesson has its notes." },
  marked: { day: "No marked lessons on this day.", range: "No marked lessons in this period." },
  upcoming: { day: "No upcoming lessons on this day.", range: "No upcoming lessons." },
} as const;

function stateLabel(item: QueueItem, view: QueueView, today: string) {
  if (view === "notes") return { text: `${item.notesMissing} to write`, tone: "text-warn" };
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
  const { filters, items, counts, today, classLabel } = queue;
  const Heading = headingLevel;
  const query = queueQueryString(filters);

  return (
    <ListPane
      labelledBy="attendance-queue-heading"
      className={className}
      header={
        <>
        <Heading
          id="attendance-queue-heading"
          className="text-[20px] font-extrabold leading-tight text-ink"
        >
          Lessons
        </Heading>
        {classLabel && (
          <p className="flex min-h-11 items-center justify-between gap-2 rounded-[12px] bg-[#F6F7FA] py-1 pl-3 pr-1 text-[13px] font-bold text-ink">
            <span className="min-w-0 truncate">{classLabel}</span>
            <Link
              href={`${basePath}${queueQueryString({ ...filters, classId: null })}`}
              aria-label="Show every class"
              title="Show every class"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-muted transition-colors hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <X className="h-4 w-4" aria-hidden />
            </Link>
          </p>
        )}
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
        </>
      }
    >
        {items.length === 0 ? (
          <Empty>{EMPTY_TEXT[filters.view][filters.date ? "day" : "range"]}</Empty>
        ) : filters.view === "notes" ? (
          // Grouped by tutor: notes are the tutor's to write, so the admin
          // chases each tutor once, from the same place.
          <div className="flex flex-col gap-3">
            {groupByTutor(items).map((group) => (
              <section key={group.tutorId} aria-label={group.tutorName} className="flex flex-col gap-0.5">
                <div className="flex min-h-10 items-center gap-2 px-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink">
                    {group.tutorName}
                    <span className="font-semibold text-muted">
                      {" · "}
                      {group.items.length} {group.items.length === 1 ? "lesson" : "lessons"}
                    </span>
                  </span>
                  <Link
                    href={`/admin/messages/with/${group.tutorId}`}
                    className={cn(buttonVariants({ variant: "glass", size: "sm" }), "shrink-0")}
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    Message
                    <span className="sr-only"> {group.tutorName}</span>
                  </Link>
                </div>
                <QueueList
                  items={group.items}
                  view={filters.view}
                  today={today}
                  query={query}
                  currentLessonId={currentLessonId}
                  showTutor={false}
                />
              </section>
            ))}
          </div>
        ) : (
          <QueueList
            items={items}
            view={filters.view}
            today={today}
            query={query}
            currentLessonId={currentLessonId}
            showTutor
          />
        )}
    </ListPane>
  );
}

function QueueList({
  items,
  view,
  today,
  query,
  currentLessonId,
  showTutor,
}: {
  items: QueueItem[];
  view: QueueView;
  today: string;
  query: string;
  currentLessonId?: string;
  showTutor: boolean;
}) {
  // A list that runs over more than one month gets month headings, since
  // each row shows only the weekday and day.
  const monthBreaks = showTutor && new Set(items.map((item) => item.date.slice(0, 7))).size > 1;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item, index) => {
        const current = item.id === currentLessonId;
        const label = stateLabel(item, view, today);
        const newMonth =
          monthBreaks && (index === 0 || items[index - 1].date.slice(0, 7) !== item.date.slice(0, 7));
        return (
          <Fragment key={item.id}>
            {newMonth && (
              <li className="px-2.5 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted first:pt-1">
                {formatMonthYear(item.date)}
              </li>
            )}
            <li>
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
                    <SubjectDot subject={item.subjectName} color={item.subjectColor} className="h-2 w-2" />
                    <span className="truncate">
                      {classDisplayName(item.subjectName, item.className)}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-muted">
                    {showTutor
                      ? `${formatTime(item.startTime)} · ${item.tutorName}`
                      : `${formatDateShort(item.date)} · ${formatTime(item.startTime)}`}
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
          </Fragment>
        );
      })}
    </ul>
  );
}

function formatMonthYear(isoDate: string) {
  return new Date(`${isoDate.slice(0, 7)}-01T12:00:00`).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });
}
