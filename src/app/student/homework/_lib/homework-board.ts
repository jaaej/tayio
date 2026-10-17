// Pure rules for the student Homework page: the URL contract (subject, to do
// or done, search, all overdue), the subject filter, and how open work splits
// into due this week, overdue and coming up. Free of server imports so they
// can be unit tested.

import { melbourneDayKey } from "@/lib/format";
import { daysUntil, groupOf, matchesHomework, type HomeworkListItem } from "./homework-list";
import { distinctSubjects } from "@/lib/subject-label";

export type BoardShow = "todo" | "done";

export type BoardParams = {
  subject: string | null;
  show: BoardShow;
  q: string;
  /** Show every overdue item instead of the most recent few. */
  older: boolean;
};

/** How many overdue items show before "Show N older". */
export const OVERDUE_PREVIEW = 3;

type RawParams = { subject?: string; show?: string; q?: string; older?: string };

export function parseBoardParams(sp: RawParams): BoardParams {
  return {
    subject: sp.subject?.trim() || null,
    show: sp.show === "done" ? "done" : "todo",
    q: (sp.q ?? "").trim(),
    older: sp.older === "1",
  };
}

/** A board or detail URL carrying the board's filters (defaults left out). */
export function boardHref(path: string, params: Partial<BoardParams>): string {
  const qs = new URLSearchParams();
  if (params.subject) qs.set("subject", params.subject);
  if (params.show === "done") qs.set("show", "done");
  if (params.q) qs.set("q", params.q);
  if (params.older) qs.set("older", "1");
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * The subjects the student has homework in, alphabetically, for the filter.
 * By id: two subjects can share a name, and then their labels add the level.
 */
export function boardSubjects(
  items: HomeworkListItem[],
): { id: string; name: string; label: string; color: string | null }[] {
  return distinctSubjects(
    items.flatMap((i) =>
      i.subjectId && i.subjectName
        ? [{ id: i.subjectId, name: i.subjectName, yearLevel: i.subjectYearLevel, color: i.subjectColor }]
        : [],
    ),
  ).map(({ id, name, label, color }) => ({ id, name, label, color }));
}

/** Days left in the Melbourne week after today (Sunday ends the week). */
function daysLeftInWeek(now: Date): number {
  const [y, m, d] = melbourneDayKey(now).split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return weekday === 0 ? 0 : 7 - weekday;
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

export type TodoBoard<T> = {
  /** Due from now to the end of Sunday, soonest first. */
  dueThisWeek: T[];
  /** Past the due time, most recently due first. */
  overdue: T[];
  /** Due after this week, soonest first. */
  comingUp: T[];
};

export type DoneBoard<T> = {
  /** Handed in, waiting for the tutor, newest first. */
  waiting: T[];
  /** Marked or returned, newest first. */
  marked: T[];
};

function filtered<T extends HomeworkListItem>(items: T[], params: BoardParams): T[] {
  return items.filter(
    (i) => (!params.subject || i.subjectId === params.subject) && matchesHomework(i, params.q),
  );
}

/**
 * Open work split by when it is due. Past the due time on the due day counts
 * as overdue, matching `dueStatus`.
 */
export function buildTodoBoard<T extends HomeworkListItem>(
  items: T[],
  params: BoardParams,
  now: Date = new Date(),
): TodoBoard<T> {
  const weekLeft = daysLeftInWeek(now);
  const board: TodoBoard<T> = { dueThisWeek: [], overdue: [], comingUp: [] };
  for (const item of filtered(items, params)) {
    if (groupOf(item.status) !== "todo") continue;
    const due = new Date(item.dueDate);
    if (due.getTime() < now.getTime()) board.overdue.push(item);
    else if (daysUntil(due, now) <= weekLeft) board.dueThisWeek.push(item);
    else board.comingUp.push(item);
  }
  board.dueThisWeek.sort((a, b) => time(a.dueDate) - time(b.dueDate));
  board.comingUp.sort((a, b) => time(a.dueDate) - time(b.dueDate));
  board.overdue.sort((a, b) => time(b.dueDate) - time(a.dueDate));
  return board;
}

export function buildDoneBoard<T extends HomeworkListItem>(
  items: T[],
  params: BoardParams,
): DoneBoard<T> {
  const board: DoneBoard<T> = { waiting: [], marked: [] };
  for (const item of filtered(items, params)) {
    const group = groupOf(item.status);
    if (group === "waiting") board.waiting.push(item);
    else if (group === "marked") board.marked.push(item);
  }
  board.waiting.sort((a, b) => (time(b.submittedAt) || time(b.dueDate)) - (time(a.submittedAt) || time(a.dueDate)));
  board.marked.sort((a, b) => (time(b.markedAt) || time(b.dueDate)) - (time(a.markedAt) || time(a.dueDate)));
  return board;
}

/** How long ago overdue work was due: "Today", "1 day", "5 days", "10 weeks". */
export function overdueAge(due: Date, now: Date = new Date()): string {
  const days = -daysUntil(due, now);
  if (days <= 0) return "Today";
  if (days < 14) return days === 1 ? "1 day" : `${days} days`;
  return `${Math.floor(days / 7)} weeks`;
}

/**
 * The one tutor to ask about overdue work, when every overdue item belongs to
 * the same tutor. Null when there are several (or none).
 */
export function soleTutor(
  items: { tutorId: string | null; tutorFirstName: string | null }[],
): { id: string; firstName: string } | null {
  const ids = new Set(items.map((i) => i.tutorId).filter(Boolean));
  if (ids.size !== 1) return null;
  const first = items.find((i) => i.tutorId && i.tutorFirstName);
  return first?.tutorId && first.tutorFirstName
    ? { id: first.tutorId, firstName: first.tutorFirstName }
    : null;
}
