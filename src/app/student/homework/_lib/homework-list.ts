// Pure rules for the student Homework split view: which group a homework
// belongs to, the order inside each group, the list views, search, due-date
// wording and the URL contract. Kept free of server imports so the client list
// pane and the server detail page share them.

import { melbourneDayKey } from "@/lib/format";

export type HomeworkGroupKey = "todo" | "waiting" | "marked";
export type HomeworkView = "all" | "todo" | "submitted" | "marked";

export const HOMEWORK_VIEWS: { value: HomeworkView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "submitted", label: "Submitted" },
  { value: "marked", label: "Marked" },
];

export const HOMEWORK_GROUP_LABEL: Record<HomeworkGroupKey, string> = {
  todo: "To do",
  waiting: "Waiting for marking",
  marked: "Marked",
};

const VIEW_GROUP: Record<Exclude<HomeworkView, "all">, HomeworkGroupKey> = {
  todo: "todo",
  submitted: "waiting",
  marked: "marked",
};

export function parseHomeworkView(value: string | null | undefined): HomeworkView {
  return value === "todo" || value === "submitted" || value === "marked" ? value : "all";
}

export type HomeworkListItem = {
  id: string;
  title: string;
  className: string | null;
  subjectName: string | null;
  status: string;
  /** ISO timestamps, so the list can cross the server/client boundary. */
  dueDate: string;
  submittedAt: string | null;
  markedAt: string | null;
  /** A percentage, as stored ("85.00"). */
  score: string | null;
};

/**
 * "late" is a submission that came in after the due date (the submit route
 * sets it), so it waits for marking like any other. A resubmission request
 * puts the work back in the student's hands.
 */
export function groupOf(status: string): HomeworkGroupKey {
  if (status === "marked" || status === "returned") return "marked";
  if (status === "submitted" || status === "late") return "waiting";
  return "todo";
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

/**
 * The list's groups in reading order: To do soonest due first (so overdue
 * work leads), then work waiting for marking and marked work, newest first.
 * Empty groups are left out.
 */
export function groupHomework<T extends HomeworkListItem>(
  items: T[],
  view: HomeworkView = "all",
): { key: HomeworkGroupKey; label: string; items: T[] }[] {
  const keys: HomeworkGroupKey[] =
    view === "all" ? ["todo", "waiting", "marked"] : [VIEW_GROUP[view]];
  return keys
    .map((key) => {
      const inGroup = items.filter((i) => groupOf(i.status) === key);
      const recency = (i: T) =>
        time(key === "marked" ? i.markedAt : i.submittedAt) || time(i.dueDate);
      inGroup.sort((a, b) =>
        key === "todo" ? time(a.dueDate) - time(b.dueDate) : recency(b) - recency(a),
      );
      return { key, label: HOMEWORK_GROUP_LABEL[key], items: inGroup };
    })
    .filter((g) => g.items.length > 0);
}

/** Case-insensitive match on the title, class or subject. */
export function matchesHomework(item: HomeworkListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.title, item.className, item.subjectName].some((f) =>
    f?.toLowerCase().includes(q),
  );
}

/** A list or detail URL, carrying the list's view and search along. */
export function homeworkHref(
  path: string,
  list: { view?: HomeworkView; q?: string },
): string {
  const params = new URLSearchParams();
  if (list.view && list.view !== "all") params.set("view", list.view);
  if (list.q) params.set("q", list.q);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function dayNumber(d: Date): number {
  const [y, m, day] = melbourneDayKey(d).split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/** Whole Melbourne calendar days from `now` to `due` (negative once past). */
export function daysUntil(due: Date, now: Date = new Date()): number {
  return dayNumber(due) - dayNumber(now);
}

const shortDate = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "Fri 16 Oct" in Melbourne time (en-AU puts a comma after the weekday). */
export function formatHomeworkDate(d: Date): string {
  return shortDate.format(d).replace(",", "");
}

export type DueTone = "bad" | "warn" | "muted";

/**
 * How urgent open work is, in words, so "overdue" and "due today" survive
 * being read without relying on colour. `short` is the list row's version,
 * where the date is already beside it. Past the due time on the due day
 * still counts as overdue.
 */
export function dueStatus(
  due: Date,
  now: Date = new Date(),
): { label: string; short: string; tone: DueTone } {
  const days = daysUntil(due, now);
  if (due.getTime() < now.getTime()) {
    const label =
      days >= 0 ? "Overdue" : days === -1 ? "Overdue by 1 day" : `Overdue by ${-days} days`;
    return { label, short: "Overdue", tone: "bad" };
  }
  if (days === 0) return { label: "Due today", short: "Due today", tone: "bad" };
  if (days === 1) return { label: "Due tomorrow", short: "Tomorrow", tone: "warn" };
  if (days < 7) return { label: `Due in ${days} days`, short: `In ${days} days`, tone: "warn" };
  return { label: `Due ${formatHomeworkDate(due)}`, short: "", tone: "muted" };
}

/**
 * The original name of an uploaded submission. The submit route stores files
 * as "<student>/<homework>/<timestamp>-<name>"; drop the folders and stamp.
 */
export function submissionFileName(path: string): string {
  const last = decodeURIComponent(path.split("?")[0].split("/").pop() ?? "");
  return last.replace(/^\d{10,}-/, "") || "Your file";
}
