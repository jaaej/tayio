import { lessonStartInstant } from "@/lib/tutor-cover-rules";

/*
 * Pure rules for the admin attendance queue: which tab a lesson belongs to,
 * how each tab is ordered, and which lesson "Save & next lesson" opens.
 * No database or framework imports so they can be unit tested directly.
 */

export const QUEUE_VIEWS = ["to_mark", "marked", "upcoming"] as const;
export type QueueView = (typeof QUEUE_VIEWS)[number];

export const QUEUE_VIEW_LABEL: Record<QueueView, string> = {
  to_mark: "To mark",
  marked: "Marked",
  upcoming: "Upcoming",
};

export type LessonQueueState = "to_mark" | "marked" | "upcoming" | "cancelled";

export function parseQueueView(value: string | undefined): QueueView {
  return (QUEUE_VIEWS as readonly string[]).includes(value ?? "")
    ? (value as QueueView)
    : "to_mark";
}

/**
 * A URL param is only usable as a date once it is both the right shape AND a
 * date that exists: postgres rejects `2026-13-45` at query time, so the shape
 * check alone would turn a hand-edited URL into a 500.
 */
export function dateParam(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

/**
 * Where a lesson sits in the queue. A lesson becomes markable once it has
 * started (Melbourne wall time), and stays "to mark" while any expected
 * student has no attendance row. Cancelled and rescheduled lessons need no
 * roll, so they are filed with the finished ones.
 */
export function lessonQueueState(
  lesson: {
    date: string;
    startTime: string;
    status: string;
    unmarkedCount: number;
  },
  now: Date,
): LessonQueueState {
  if (lesson.status === "cancelled" || lesson.status === "rescheduled") {
    return "cancelled";
  }
  if (lessonStartInstant(lesson.date, lesson.startTime).getTime() > now.getTime()) {
    return "upcoming";
  }
  return lesson.unmarkedCount > 0 ? "to_mark" : "marked";
}

export function viewForState(state: LessonQueueState): QueueView {
  return state === "cancelled" ? "marked" : state;
}

type Orderable = { date: string; startTime: string };

function compareStart(a: Orderable, b: Orderable): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
  return 0;
}

/**
 * Lessons for one tab, in queue order: most recent first for finished work
 * (today's roll is the one the office is chasing), soonest first for upcoming.
 */
export function buildQueue<T extends Orderable & { state: LessonQueueState }>(
  lessons: T[],
  view: QueueView,
): T[] {
  const inView = lessons.filter((lesson) => viewForState(lesson.state) === view);
  return view === "upcoming"
    ? inView.sort(compareStart)
    : inView.sort((a, b) => compareStart(b, a));
}

/**
 * The lesson "Save & next lesson" opens: the one after the current lesson in
 * queue order. If the current lesson is not in this queue (opened from a
 * link), the queue starts from the top. Null means the queue is finished.
 */
export function nextLessonId(
  queueIds: readonly string[],
  currentId: string,
): string | null {
  const index = queueIds.indexOf(currentId);
  if (index === -1) return queueIds.find((id) => id !== currentId) ?? null;
  return queueIds[index + 1] ?? null;
}

/** The queue's filter state as a query string (with leading "?" or empty). */
export function queueQueryString(filters: {
  view: QueueView;
  date: string | null;
  from: string | null;
}): string {
  const params = new URLSearchParams();
  if (filters.view !== "to_mark") params.set("view", filters.view);
  if (filters.date) params.set("date", filters.date);
  if (filters.from) params.set("from", filters.from);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
