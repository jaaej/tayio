/*
 * Pure rules for the tutor's student profile (/tutor/students/[id]):
 * attendance and homework summaries and the URL contract. Unit-tested on
 * its own.
 */

export type FlagTone = "bad" | "warn" | "info" | "good";

/** The params carried on every tab link: `class` is the roster the profile
 *  was opened from, so its back button keeps returning there. */
export const LIST_PARAM_KEYS = ["class"] as const;

/** Same definition as the admin profile facts: arriving late or leaving
 *  early still counts as attending. */
export const ATTENDED_STATUSES = [
  "present",
  "late",
  "left_early",
  "makeup_attended",
] as const;

/** How many recent marked lessons the attendance figure looks back over. */
export const RECENT_LESSONS = 8;

export type AttendanceSummary = {
  attended: number;
  total: number;
  percent: number | null;
};

export function attendanceSummary(statuses: readonly string[]): AttendanceSummary {
  const total = statuses.length;
  const attended = statuses.filter((s) =>
    (ATTENDED_STATUSES as readonly string[]).includes(s),
  ).length;
  return {
    attended,
    total,
    percent: total === 0 ? null : Math.round((attended / total) * 100),
  };
}

export type HomeworkState = "marked" | "to_mark" | "overdue" | "due_today" | "open";

export const HOMEWORK_STATE: Record<HomeworkState, { label: string; tone: FlagTone | "default" }> = {
  marked: { label: "Marked", tone: "good" },
  to_mark: { label: "To mark", tone: "warn" },
  overdue: { label: "Overdue", tone: "bad" },
  due_today: { label: "Due today", tone: "warn" },
  open: { label: "Not handed in", tone: "default" },
};

/**
 * Where a piece of homework stands for the tutor. `submitted` and `late` are
 * handed-in work waiting for marking (the marking queue's definition); the
 * not-handed-in statuses become overdue once the due date (a Melbourne
 * calendar date) has passed.
 */
export function homeworkState(
  status: string,
  dueDate: string,
  today: string,
): HomeworkState {
  if (status === "marked" || status === "returned") return "marked";
  if (status === "submitted" || status === "late") return "to_mark";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due_today";
  return "open";
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

/** `path` plus the list params of `source`, then any extra params. */
export function withListQuery(
  path: string,
  source: ParamSource,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  for (const key of LIST_PARAM_KEYS) {
    const value = readParam(source, key);
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
